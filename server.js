require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const ChatWorld = require('./src/index');

// Load configuration
const agentConfig = require('./config/agents.json');

const config = {
  apiEndpoint: process.env.API_ENDPOINT || 'https://api.openai.com/v1',
  apiKey: process.env.API_KEY || '',
  defaultModel: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo',
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',
  dbPath: process.env.DB_PATH || './data/chat.db',
  agents: agentConfig.agents,
  chaosSettings: agentConfig.chaosSettings,
  toolSettings: agentConfig.toolSettings,
  // System settings for web management
  systemSettings: {
    allowWebConfig: true,
    adminPassword: '',
    outsiderAssistantEnabled: true
  }
};

// Initialize app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize ChatWorld
const chatWorld = new ChatWorld(config);

// Setup WebSocket
chatWorld.setupWebSocket(server);

// ==========================================
// 🎛️ Management APIs (系统管理接口)
// ==========================================

// Get full system config
app.get('/api/config', (req, res) => {
  res.json({
    apiEndpoint: config.apiEndpoint,
    defaultModel: config.defaultModel,
    chaosSettings: config.chaosSettings,
    toolSettings: config.toolSettings,
    agents: config.agents,
    systemSettings: config.systemSettings
  });
});

// Update system config (hot reload)
app.put('/api/config', (req, res) => {
  const updates = req.body;
  
  if (updates.apiEndpoint) config.apiEndpoint = updates.apiEndpoint;
  if (updates.defaultModel) config.defaultModel = updates.defaultModel;
  if (updates.chaosSettings) {
    config.chaosSettings = { ...config.chaosSettings, ...updates.chaosSettings };
    // Update all agents' chaos settings
    Object.values(chatWorld.agents).forEach(agent => {
      agent.chaosSettings = config.chaosSettings;
    });
  }
  if (updates.toolSettings) {
    config.toolSettings = { ...config.toolSettings, ...updates.toolSettings };
  }
  if (updates.agents) {
    config.agents = updates.agents;
  }
  if (updates.systemSettings) {
    config.systemSettings = { ...config.systemSettings, ...updates.systemSettings };
  }
  
  console.log('⚙️ Config updated:', JSON.stringify(updates, null, 2));
  broadcastSystemState();
  res.json({ success: true, config: {
    apiEndpoint: config.apiEndpoint,
    defaultModel: config.defaultModel,
    chaosSettings: config.chaosSettings,
    toolSettings: config.toolSettings,
    agents: config.agents,
    systemSettings: config.systemSettings
  }});
});

// Get all agents with real-time status
app.get('/api/agents', (req, res) => {
  const agentsList = Object.values(chatWorld.agents).map(agent => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    personality: agent.personality,
    systemPrompt: agent.systemPrompt,
    modelName: agent.modelName,
    status: agent.status,
    emotionState: agent.emotionState,
    activityLevel: agent.activityLevel,
    speakingStyle: agent.speakingStyle
  }));
  res.json({ agents: agentsList });
});

// Add new agent
app.post('/api/agents', (req, res) => {
  const newAgentConfig = req.body;
  try {
    const newAgent = chatWorld.addAgent(newAgentConfig);
    config.agents.push(newAgentConfig);
    broadcastSystemState();
    res.json({ success: true, agent: newAgent });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Update existing agent
app.put('/api/agents/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const agent = chatWorld.agents[id];
  
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  // Update agent properties
  if (updates.name) agent.name = updates.name;
  if (updates.role) agent.role = updates.role;
  if (updates.personality) agent.personality = updates.personality;
  if (updates.systemPrompt) agent.systemPrompt = updates.systemPrompt;
  if (updates.modelName) agent.modelName = updates.modelName;
  if (updates.activityLevel !== undefined) agent.activityLevel = updates.activityLevel;
  if (updates.speakingStyle) agent.speakingStyle = updates.speakingStyle;
  
  // Update config array
  const configIndex = config.agents.findIndex(a => a.id === id);
  if (configIndex !== -1) {
    config.agents[configIndex] = { ...config.agents[configIndex], ...updates };
  }
  
  broadcastSystemState();
  res.json({ success: true, agent: { id: agent.id, ...updates } });
});

// Delete agent
app.delete('/api/agents/:id', (req, res) => {
  const { id } = req.params;
  if (!chatWorld.agents[id]) return res.status(404).json({ error: 'Agent not found' });

  delete chatWorld.agents[id];
  config.agents = config.agents.filter(a => a.id !== id);
  broadcastSystemState();
  res.json({ success: true });
});

// Get internal logs (recent decisions)
app.get('/api/logs', (req, res) => {
  res.json({ logs: chatWorld.internalLogs.slice(-50) });
});

// Manually trigger an agent to speak (debug)
app.post('/api/trigger/:agentId', (req, res) => {
  const { agentId } = req.params;
  const agent = chatWorld.agents[agentId];
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  agent.decideAndSpeak(chatWorld.history, true).catch(err => {
    console.error('Trigger error:', err);
  });
  res.json({ success: true, message: `Triggered ${agent.name}` });
});

// Test LLM connection
app.get('/api/test-connection', async (req, res) => {
  const connected = await chatWorld.testConnection();
  res.json({ connected, endpoint: config.apiEndpoint, model: config.defaultModel });
});

// ==========================================
// 🤖 Outsider Assistant API (局外人助手)
// ==========================================

// Outsider assistant - can answer system questions and help with troubleshooting
app.post('/api/outsider-assistant', async (req, res) => {
  const { question, context } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }
  
  // Build system context for the assistant
  const systemContext = {
    config: {
      apiEndpoint: config.apiEndpoint,
      defaultModel: config.defaultModel,
      port: config.port,
      host: config.host,
      dbPath: config.dbPath,
      chaosSettings: config.chaosSettings,
      toolSettings: config.toolSettings,
      systemSettings: config.systemSettings
    },
    agentsCount: Object.keys(chatWorld.agents).length,
    agentsStatus: Object.values(chatWorld.agents).map(a => ({
      id: a.id,
      name: a.name,
      status: a.status,
      emotionState: a.emotionState,
      activityLevel: a.activityLevel
    })),
    recentLogs: chatWorld.internalLogs ? chatWorld.internalLogs.slice(-20) : [],
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  };
  
  // The outsider assistant's system prompt
  const outsiderPrompt = `You are the "Outsider Assistant" (局外人助手), a specialized AI assistant for this chaotic chat world system. Your role is to:

1. Answer questions about the system configuration and current state
2. Help with fault diagnosis and troubleshooting
3. Explain how the system works
4. Provide recommendations for configuration adjustments

Current System Context:
${JSON.stringify(systemContext, null, 2)}

Available Configuration Options:
- API Endpoint: ${config.apiEndpoint}
- Default Model: ${config.defaultModel}
- Port: ${config.port}
- Chaos Settings: ${JSON.stringify(config.chaosSettings)}
- Tool Settings: ${JSON.stringify(config.toolSettings)}
- Active Agents: ${Object.keys(chatWorld.agents).length}

When answering:
- Be clear and concise
- Provide actionable advice for troubleshooting
- Explain technical details in an accessible way
- Suggest configuration changes when appropriate`;

  try {
    const llmClient = chatWorld.llmClient;
    const response = await llmClient.generate({
      model: config.defaultModel,
      messages: [
        { role: 'system', content: outsiderPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.7
    });
    
    res.json({ 
      success: true, 
      answer: response.content || response.message?.content || 'Unable to generate response',
      context: systemContext
    });
  } catch (error) {
    console.error('Outsider assistant error:', error);
    // Fallback: provide basic info without LLM
    res.json({
      success: true,
      answer: `I'm the Outsider Assistant. Currently, the system has:\n- ${Object.keys(chatWorld.agents).length} active agents\n- API Endpoint: ${config.apiEndpoint}\n- Model: ${config.defaultModel}\n- Uptime: ${process.uptime().toFixed(2)} seconds\n\nFor detailed troubleshooting, please ensure the API key is configured correctly.`,
      context: systemContext,
      note: 'LLM unavailable, providing basic info only'
    });
  }
});

// Get system health status
app.get('/api/system-health', (req, res) => {
  const health = {
    status: 'healthy',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    agentsCount: Object.keys(chatWorld.agents).length,
    agentsActive: Object.values(chatWorld.agents).filter(a => a.status !== 'inactive').length,
    configValid: !!(config.apiKey || config.apiEndpoint.includes('localhost')),
    lastLogs: chatWorld.internalLogs ? chatWorld.internalLogs.slice(-5) : []
  };
  
  // Check for potential issues
  const issues = [];
  if (!config.apiKey && !config.apiEndpoint.includes('localhost')) {
    issues.push('API key not configured');
    health.status = 'warning';
  }
  if (health.agentsCount === 0) {
    issues.push('No agents configured');
    health.status = 'warning';
  }
  if (health.memoryUsage.heapUsed > 500 * 1024 * 1024) {
    issues.push('High memory usage');
    health.status = 'warning';
  }
  
  health.issues = issues;
  res.json(health);
});

// Reset system to defaults
app.post('/api/system-reset', (req, res) => {
  const { resetType } = req.body;
  
  try {
    if (resetType === 'memories') {
      chatWorld.resetMemories();
      res.json({ success: true, message: 'All agent memories have been reset' });
    } else if (resetType === 'config') {
      // Reload config from file
      const freshConfig = require('./config/agents.json');
      config.chaosSettings = freshConfig.chaosSettings;
      config.toolSettings = freshConfig.toolSettings;
      config.agents = freshConfig.agents;
      
      // Update agents
      Object.values(chatWorld.agents).forEach(agent => {
        agent.chaosSettings = config.chaosSettings;
      });
      
      res.json({ success: true, message: 'Configuration reset to defaults' });
    } else if (resetType === 'all') {
      chatWorld.resetMemories();
      const freshConfig = require('./config/agents.json');
      config.chaosSettings = freshConfig.chaosSettings;
      config.toolSettings = freshConfig.toolSettings;
      config.agents = freshConfig.agents;
      
      Object.values(chatWorld.agents).forEach(agent => {
        agent.chaosSettings = config.chaosSettings;
      });
      
      res.json({ success: true, message: 'Full system reset completed' });
    } else {
      res.status(400).json({ error: 'Invalid reset type. Use: memories, config, or all' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 💬 Chat APIs
// ==========================================

app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ messages: chatWorld.getRecentMessages(limit) });
});

app.post('/api/message', async (req, res) => {
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  const message = {
    id: uuidv4(),
    content
  };
  
  // Send immediately
  chatWorld.handleUserMessage(message);
  
  res.json({ success: true, message: { id: message.id, content } });
});

// ==========================================
// 🔌 WebSocket Real-time Communication
// ==========================================

function broadcast(data) {
  chatWorld.wsClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// Broadcast system state for dashboard
function broadcastSystemState() {
  const state = {
    type: 'system_state',
    config: {
      apiEndpoint: config.apiEndpoint,
      defaultModel: config.defaultModel,
      chaosSettings: config.chaosSettings,
      toolSettings: config.toolSettings
    },
    agents: Object.values(chatWorld.agents).map(a => ({
      id: a.id,
      name: a.name,
      status: a.status,
      emotionState: a.emotionState,
      activityLevel: a.activityLevel
    })),
    logs: chatWorld.internalLogs.slice(-10)
  };
  broadcast(state);
}

// Periodic state broadcast (heartbeat)
setInterval(() => {
  if (chatWorld.wsClients.size > 0) {
    broadcastSystemState();
  }
}, 2000);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
server.listen(config.port, config.host, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           🌍 AI Group Chat World Started!                ║
╠══════════════════════════════════════════════════════════╣
║  Server:   http://${config.host}:${config.port}                      ║
║  Agents:   ${Object.keys(chatWorld.agents).length} active                       ║
║  Database: ${config.dbPath}           ║
╚══════════════════════════════════════════════════════════╝
  `);
  
  // Start autonomous activity after 5 seconds
  setTimeout(() => {
    chatWorld.startAutonomousActivity(8000);
    console.log('🌀 Autonomous activity started');
  }, 5000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  chatWorld.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

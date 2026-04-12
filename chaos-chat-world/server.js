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
  toolSettings: agentConfig.toolSettings
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
    agents: config.agents
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
  
  console.log('⚙️ Config updated:', JSON.stringify(updates, null, 2));
  broadcastSystemState();
  res.json({ success: true, config: {
    apiEndpoint: config.apiEndpoint,
    defaultModel: config.defaultModel,
    chaosSettings: config.chaosSettings,
    toolSettings: config.toolSettings,
    agents: config.agents
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

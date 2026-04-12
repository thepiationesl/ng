const WebSocket = require('ws');
const Agent = require('./agents/Agent');
const ChatDatabase = require('./models/database');
const LLMClient = require('./models/llmClient');
const { GroupStateTool } = require('./tools');

class ChatWorld {
  constructor(config) {
    this.config = config || {};
    this.db = new ChatDatabase(this.config.dbPath);
    
    this.llmClient = new LLMClient({
      endpoint: this.config.apiEndpoint,
      apiKey: this.config.apiKey,
      model: this.config.defaultModel
    });
    
    this.agents = {};
    this.wsClients = new Set();
    this.groupStateTool = null;
    
    // World settings
    this.worldSettings = {
      chaosLevel: this.config.chaosLevel || 0.5,
      baseTemperature: this.config.baseTemperature || 0.7,
      autoSpeakInterval: this.config.autoSpeakInterval || 5000,
      maxHistoryLength: this.config.maxHistoryLength || 50,
      allowToolUse: this.config.allowToolUse !== undefined ? this.config.allowToolUse : true
    };
    
    // Initialize agents
    this.loadAgents();
    
    // Auto-activity loop
    this.activityInterval = null;
  }

  // Update world configuration dynamically
  updateConfig(newConfig) {
    if (newConfig.chaosLevel !== undefined) {
      this.worldSettings.chaosLevel = Math.max(0, Math.min(1, newConfig.chaosLevel));
    }
    if (newConfig.baseTemperature !== undefined) {
      this.worldSettings.baseTemperature = newConfig.baseTemperature;
    }
    if (newConfig.autoSpeakInterval !== undefined) {
      this.worldSettings.autoSpeakInterval = newConfig.autoSpeakInterval;
      // Restart autonomous activity with new interval
      if (this.activityInterval) {
        this.startAutonomousActivity(this.worldSettings.autoSpeakInterval);
      }
    }
    if (newConfig.maxHistoryLength !== undefined) {
      this.worldSettings.maxHistoryLength = newConfig.maxHistoryLength;
    }
    if (newConfig.allowToolUse !== undefined) {
      this.worldSettings.allowToolUse = newConfig.allowToolUse;
    }
    
    // Propagate to agents
    Object.values(this.agents).forEach(agent => {
      agent.updateSettings({
        chaosLevel: this.worldSettings.chaosLevel,
        baseTemperature: this.worldSettings.baseTemperature,
        allowToolUse: this.worldSettings.allowToolUse
      });
    });
    
    console.log(`[World] Config updated: Chaos=${this.worldSettings.chaosLevel}, Temp=${this.worldSettings.baseTemperature}`);
  }

  loadAgents() {
    const agentConfigs = this.config.agents || [];
    
    agentConfigs.forEach(agentConfig => {
      this.agents[agentConfig.id] = new Agent(
        agentConfig,
        this.db,
        this.llmClient
      );
    });
    
    this.groupStateTool = new GroupStateTool(this.db, this.agents);
  }

  // WebSocket handling
  setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws) => {
      this.wsClients.add(ws);
      
      // Send recent messages on connect
      const recentMessages = this.db.getRecentMessages(50);
      ws.send(JSON.stringify({
        type: 'history',
        messages: recentMessages
      }));
      
      // Send current agent states
      ws.send(JSON.stringify({
        type: 'agents',
        agents: this.getAgentStates()
      }));
      
      ws.on('close', () => {
        this.wsClients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.wsClients.delete(ws);
      });
    });
    
    return wss;
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  getAgentStates() {
    return Object.values(this.agents).map(agent => ({
      id: agent.id,
      name: agent.name,
      isTyping: agent.isTyping,
      lastActive: agent.lastActive,
      emotionState: agent.emotionState,
      messageCount: agent.messageCount
    }));
  }

  async handleUserMessage(message) {
    // Save user message
    const userMessage = {
      id: message.id,
      senderId: 'user',
      senderType: 'user',
      content: message.content,
      timestamp: Date.now()
    };
    
    this.db.saveMessage(userMessage);
    
    // Broadcast to all clients
    this.broadcast({
      type: 'message',
      message: userMessage
    });
    
    // Trigger agent responses
    await this.triggerAgentResponses();
  }

  async triggerAgentResponses() {
    const context = {
      messages: this.db.getRecentMessages(30),
      participants: [
        { id: 'user', name: 'User' },
        ...Object.values(this.agents).map(a => ({ id: a.id, name: a.name }))
      ],
      defaultModel: this.config.defaultModel
    };
    
    // Determine which agents should respond
    const respondingAgents = [];
    
    for (const agent of Object.values(this.agents)) {
      // Check if agent wants to respond based on activity level and randomness
      const shouldRespond = Math.random() < agent.activityLevel * 0.7;
      if (shouldRespond) {
        respondingAgents.push(agent);
      }
    }
    
    // Stagger responses
    for (let i = 0; i < respondingAgents.length; i++) {
      const agent = respondingAgents[i];
      const delay = Math.random() * 3000 + (i * 1000); // Stagger by 1-4 seconds
      
      setTimeout(async () => {
        const response = await agent.decideAndRespond(
          context,
          this.config.chaosSettings,
          this.groupStateTool
        );
        
        if (response) {
          this.broadcast({
            type: 'message',
            message: response
          });
          
          // Update typing status
          this.broadcast({
            type: 'typing',
            agents: this.getAgentStates()
          });
        }
      }, delay);
    }
  }

  // Start autonomous activity
  startAutonomousActivity(intervalMs = 8000) {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }
    
    this.activityInterval = setInterval(async () => {
      // Random chance for spontaneous activity
      if (Math.random() > 0.6) {
        const context = {
          messages: this.db.getRecentMessages(20),
          participants: Object.values(this.agents).map(a => ({ id: a.id, name: a.name })),
          defaultModel: this.config.defaultModel
        };
        
        // Pick a random active agent
        const activeAgents = Object.values(this.agents).filter(
          a => Math.random() < a.activityLevel
        );
        
        if (activeAgents.length > 0) {
          const agent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
          
          const response = await agent.decideAndRespond(
            context,
            this.config.chaosSettings,
            this.groupStateTool
          );
          
          if (response) {
            this.broadcast({
              type: 'message',
              message: response
            });
            
            this.broadcast({
              type: 'typing',
              agents: this.getAgentStates()
            });
          }
        }
      }
    }, intervalMs);
  }

  stopAutonomousActivity() {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
  }

  // API handlers
  getAgents() {
    return Object.values(this.agents).map(agent => agent.toJSON());
  }

  // Add or update an agent
  upsertAgent(agentData) {
    const id = agentData.id || `agent_${Date.now()}`;
    
    // Merge with defaults
    const config = {
      ...agentData,
      id,
      model: agentData.model || this.config.defaultModel,
      chaosLevel: agentData.chaosLevel !== undefined ? agentData.chaosLevel : this.worldSettings.chaosLevel,
      baseTemperature: agentData.baseTemperature !== undefined ? agentData.baseTemperature : this.worldSettings.baseTemperature,
      allowToolUse: agentData.allowToolUse !== undefined ? agentData.allowToolUse : this.worldSettings.allowToolUse
    };
    
    if (this.agents[id]) {
      // Update existing agent
      this.agents[id].updateConfig(config);
      console.log(`[World] Agent ${id} updated`);
    } else {
      // Create new agent
      this.agents[id] = new Agent(config, this.db, this.llmClient);
      console.log(`[World] Agent ${id} created`);
    }
    
    return this.agents[id];
  }

  // Remove an agent
  removeAgent(id) {
    if (this.agents[id]) {
      delete this.agents[id];
      console.log(`[World] Agent ${id} removed`);
      return true;
    }
    return false;
  }

  // Reset all memories
  resetMemories() {
    Object.values(this.agents).forEach(agent => {
      agent.resetMemory();
    });
    console.log('[World] All agent memories reset');
  }

  async testConnection() {
    return await this.llmClient.testConnection();
  }

  shutdown() {
    this.stopAutonomousActivity();
    this.db.close();
  }
}

module.exports = ChatWorld;

const { v4: uuidv4 } = require('uuid');

// Web Search Tool (mock implementation - replace with real API)
async function webSearch(query) {
  // Mock search results - in production, integrate with SerpAPI, Bing, etc.
  const mockResults = [
    {
      title: `Search Result for "${query}"`,
      snippet: `This is a simulated search result for: ${query}. In production, connect to a real search API.`,
      source: 'example.com',
      time: new Date().toISOString()
    },
    {
      title: `Related: ${query}`,
      snippet: `Another relevant result about ${query}. Consider implementing actual web search functionality.`,
      source: 'reference.org',
      time: new Date().toISOString()
    }
  ];
  
  return {
    query,
    results: mockResults
  };
}

// System Time Tool
function getCurrentTime() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString(),
    date: now.toLocaleDateString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: Date.now(),
    iso: now.toISOString()
  };
}

// Calculator Tool
function calculator(expression) {
  try {
    // Safe evaluation of mathematical expressions
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    if (sanitized.length > 100) {
      throw new Error('Expression too long');
    }
    
    // eslint-disable-next-line no-new-func
    const result = Function(`'use strict'; return (${sanitized})`)();
    
    return {
      expression,
      result,
      success: true
    };
  } catch (error) {
    return {
      expression,
      error: error.message,
      success: false
    };
  }
}

// Memory Tool (requires database instance)
class MemoryTool {
  constructor(db) {
    this.db = db;
  }

  async saveMemory(agentId, content, importance = 0.5) {
    const memory = {
      id: uuidv4(),
      agentId,
      content,
      importance,
      createdAt: Date.now()
    };
    
    this.db.saveMemory(memory);
    
    return {
      success: true,
      memoryId: memory.id
    };
  }

  async loadMemory(agentId, limit = 10) {
    const memories = this.db.getMemories(agentId, limit);
    
    return {
      success: true,
      memories: memories.map(m => ({
        id: m.id,
        content: m.content,
        importance: m.importance,
        createdAt: m.created_at
      }))
    };
  }
}

// Group State Tool
class GroupStateTool {
  constructor(db, agents) {
    this.db = db;
    this.agents = agents;
  }

  getGroupMembers() {
    return Object.values(this.agents).map(agent => ({
      id: agent.id,
      name: agent.name,
      activityLevel: agent.activityLevel,
      emotionState: agent.emotionState
    }));
  }

  getRecentActivity(limit = 20) {
    const messages = this.db.getRecentMessages(limit);
    
    return {
      messageCount: messages.length,
      recentMessages: messages.map(m => ({
        senderId: m.sender_id,
        senderType: m.sender_type,
        content: m.content.substring(0, 100),
        timestamp: m.timestamp
      }))
    };
  }

  getChatSummary(lastMinutes = 30) {
    const since = Date.now() - (lastMinutes * 60 * 1000);
    const messages = this.db.getMessagesSince(since);
    
    const participantCount = new Set(messages.map(m => m.sender_id)).size;
    
    return {
      messageCount: messages.length,
      participantCount,
      timeRange: lastMinutes,
      topics: [] // Could implement topic extraction here
    };
  }
}

// Tool Registry
const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information on a topic',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current time and date',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'The mathematical expression to evaluate'
          }
        },
        required: ['expression']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_memory',
      description: 'Save something important to memory for later recall',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The content to remember'
          },
          importance: {
            type: 'number',
            description: 'Importance level from 0.0 to 1.0',
            minimum: 0,
            maximum: 1
          }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'load_memory',
      description: 'Load memories from storage',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of memories to retrieve',
            default: 10
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_group_state',
      description: 'Get information about group members and recent activity',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
];

module.exports = {
  webSearch,
  getCurrentTime,
  calculator,
  MemoryTool,
  GroupStateTool,
  toolDefinitions
};

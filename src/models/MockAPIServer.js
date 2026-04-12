// Mock Test API Server for testing without real API key
const http = require('http');

class MockAPIServer {
  constructor(port = 3001) {
    this.port = port;
    this.server = null;
    this.requestCount = 0;
  }

  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`🧪 [MockAPI] Test server running on http://localhost:${this.port}`);
        console.log(`🧪 [MockAPI] Test API Key: test-key-12345`);
        resolve();
      });
    });
  }

  handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${this.port}`);
    
    // Set CORS headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Handle /v1/chat/completions
    if (url.pathname === '/chat/completions' || url.pathname === '/v1/chat/completions') {
      this.handleChatCompletion(req, res);
      return;
    }

    // Handle /v1/models
    if (url.pathname === '/models' || url.pathname === '/v1/models') {
      this.handleModels(req, res);
      return;
    }

    // Default 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  async handleChatCompletion(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        this.requestCount++;

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

        // Get the last user message
        const lastMessage = data.messages.find(m => m.role === 'user') || { content: '' };
        const systemMessage = data.messages.find(m => m.role === 'system');

        // Generate mock response based on context
        const mockResponses = this.generateMockResponse(lastMessage.content, systemMessage?.content, data.model);

        const response = {
          id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: data.model || 'mock-model',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: mockResponses.content
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        };

        // Check for tool calls in system message
        if (data.tools && data.tools.length > 0) {
          // Sometimes return tool calls for testing
          if (Math.random() < 0.2 && data.tools.some(t => t.function?.name === 'get_current_time')) {
            response.choices[0].message.tool_calls = [
              {
                id: `call-${Date.now()}`,
                type: 'function',
                function: {
                  name: 'get_current_time',
                  arguments: '{}'
                }
              }
            ];
            response.choices[0].finish_reason = 'tool_calls';
          }
        }

        res.writeHead(200);
        res.end(JSON.stringify(response));
        
        console.log(`🧪 [MockAPI] Request #${this.requestCount}: ${lastMessage.content.substring(0, 50)}...`);
      } catch (error) {
        console.error('🧪 [MockAPI] Error:', error.message);
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  generateMockResponse(userMessage, systemPrompt, model) {
    // Extract agent name from system prompt if available
    let agentName = 'Assistant';
    if (systemPrompt) {
      const nameMatch = systemPrompt.match(/You are (\w+)/i);
      if (nameMatch) {
        agentName = nameMatch[1];
      }
    }

    // Different response patterns based on keywords
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('time') || lowerMessage.includes('date')) {
      return {
        content: `It's ${new Date().toLocaleTimeString()} on ${new Date().toLocaleDateString()}. Time flies when you're having fun!`
      };
    }

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return {
        content: `Hey there! ${agentName} here. What's up?`
      };
    }

    if (lowerMessage.includes('how are you')) {
      return {
        content: `I'm doing great! Just hanging out in this chaotic chat world. How about you?`
      };
    }

    if (lowerMessage.includes('weather')) {
      return {
        content: `I don't have real weather data, but let's say it's sunny with a chance of memes! ☀️`
      };
    }

    if (lowerMessage.includes('math') || lowerMessage.includes('calculate')) {
      return {
        content: `I love math! 2 + 2 = 4, but sometimes in this chaos, it might equal 5! 😄`
      };
    }

    // Random personality-based responses
    const responses = [
      `That's an interesting point! Let me think about that...`,
      `Hmm, I see what you're saying. But have you considered the opposite perspective?`,
      `Oh wow, that reminds me of something I was thinking about earlier!`,
      `Interesting! Tell me more about that.`,
      `I'm not entirely sure about that, but here's my take on it...`,
      `Haha, that's funny! You always know how to lighten the mood.`,
      `Wait, I need to process that for a second. That's actually pretty deep.`,
      `You know what? I totally agree with you on that one!`,
      `Hmm, I see things a bit differently, but that's a valid perspective.`,
      `That's cool! I've been really into similar stuff lately.`
    ];

    return {
      content: responses[Math.floor(Math.random() * responses.length)]
    };
  }

  handleModels(req, res) {
    const response = {
      object: 'list',
      data: [
        {
          id: 'mock-model-v1',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'mock-api'
        },
        {
          id: 'test-gpt-3.5-turbo',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'mock-api'
        },
        {
          id: 'test-gpt-4',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'mock-api'
        }
      ]
    };

    res.writeHead(200);
    res.end(JSON.stringify(response));
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🧪 [MockAPI] Test server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getRequestCount() {
    return this.requestCount;
  }
}

module.exports = MockAPIServer;

const axios = require('axios');

class LLMClient {
  constructor(config) {
    this.endpoint = config.endpoint || 'https://api.openai.com/v1';
    this.apiKey = config.apiKey;
    this.defaultModel = config.model || 'gpt-3.5-turbo';
    this.timeout = config.timeout || 30000;
  }

  async chat(messages, options = {}) {
    const {
      model = this.defaultModel,
      temperature = 0.8,
      maxTokens = 500,
      tools = [],
      toolChoice = 'auto'
    } = options;

    try {
      const payload = {
        model,
        messages,
        temperature: Math.min(Math.max(temperature, 0), 2),
        max_tokens: maxTokens
      };

      if (tools && tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = toolChoice;
      }

      const response = await axios.post(
        `${this.endpoint}/chat/completions`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: this.timeout
        }
      );

      return this.parseResponse(response.data);
    } catch (error) {
      throw new Error(`LLM API Error: ${error.message}`);
    }
  }

  parseResponse(data) {
    const choice = data.choices[0];
    const message = choice.message;

    return {
      content: message.content || '',
      role: message.role,
      toolCalls: message.tool_calls || null,
      finishReason: choice.finish_reason,
      usage: data.usage
    };
  }

  async generateText(prompt, options = {}) {
    const messages = [
      { role: 'user', content: prompt }
    ];
    
    const result = await this.chat(messages, options);
    return result.content;
  }

  // Test connection
  async testConnection() {
    try {
      await this.generateText('Say "OK" in one word.', { maxTokens: 10 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = LLMClient;

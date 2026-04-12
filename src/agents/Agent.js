const { v4: uuidv4 } = require('uuid');
const LLMClient = require('../models/llmClient');
const { 
  webSearch, 
  getCurrentTime, 
  calculator, 
  MemoryTool, 
  GroupStateTool,
  toolDefinitions 
} = require('../tools');

class Agent {
  constructor(config, db, llmClient) {
    this.id = config.id;
    this.name = config.name;
    this.systemPrompt = config.systemPrompt;
    this.personality = config.personality || [];
    this.speakingStyle = config.speakingStyle || 'neutral';
    this.activityLevel = config.activityLevel || 0.5;
    this.emotionState = config.emotionState || { valence: 0.5, arousal: 0.5, dominance: 0.5 };
    this.relationships = config.relationships || {};
    this.model = config.model;
    
    this.db = db;
    this.llmClient = llmClient;
    this.memoryTool = new MemoryTool(db);
    
    // State
    this.isTyping = false;
    this.lastActive = null;
    this.messageCount = 0;
    this.cooldownUntil = 0;
    
    // Load persisted state
    this.loadState();
  }

  loadState() {
    const savedState = this.db.getAgentState(this.id);
    if (savedState) {
      this.emotionState.valence = savedState.emotion_valence;
      this.emotionState.arousal = savedState.emotion_arousal;
      this.emotionState.dominance = savedState.emotion_dominance;
      this.lastActive = savedState.last_active;
      this.messageCount = savedState.message_count;
      if (savedState.relationships) {
        this.relationships = savedState.relationships;
      }
    }
  }

  saveState() {
    this.db.saveAgentState(this.id, {
      emotionValence: this.emotionState.valence,
      emotionArousal: this.emotionState.arousal,
      emotionDominance: this.emotionState.dominance,
      lastActive: this.lastActive,
      messageCount: this.messageCount,
      relationships: this.relationships
    });
  }

  // Chaos Layer: Apply randomness to behavior
  applyChaosLayer(chaosSettings) {
    const { baseTemperature, emotionDriftRate, personalityMutations } = chaosSettings;
    
    // Temperature perturbation
    const temperatureNoise = (Math.random() - 0.5) * 0.4;
    const adjustedTemp = Math.max(0.1, Math.min(2.0, baseTemperature + temperatureNoise));
    
    // Emotion drift
    if (Math.random() < emotionDriftRate) {
      const drift = (Math.random() - 0.5) * 0.3;
      this.emotionState.valence = Math.max(0, Math.min(1, this.emotionState.valence + drift));
    }
    
    if (Math.random() < emotionDriftRate) {
      const drift = (Math.random() - 0.5) * 0.3;
      this.emotionState.arousal = Math.max(0, Math.min(1, this.emotionState.arousal + drift));
    }
    
    // Personality mutation (rare)
    if (Math.random() < personalityMutations) {
      const mutationType = Math.random();
      if (mutationType < 0.33) {
        // Sudden mood swing
        this.emotionState.valence = 1 - this.emotionState.valence;
      } else if (mutationType < 0.66) {
        // Energy spike
        this.emotionState.arousal = Math.min(1, this.emotionState.arousal + 0.5);
      } else {
        // Temporary attitude change
        this.emotionState.dominance = 1 - this.emotionState.dominance;
      }
    }
    
    return {
      temperature: adjustedTemp,
      emotionBias: this.calculateEmotionBias(),
      mutated: Math.random() < personalityMutations
    };
  }

  calculateEmotionBias() {
    const { valence, arousal, dominance } = this.emotionState;
    
    let bias = '';
    
    if (valence < 0.3) {
      bias += ' You are feeling somewhat negative or critical right now.';
    } else if (valence > 0.7) {
      bias += ' You are feeling very positive and upbeat.';
    }
    
    if (arousal > 0.7) {
      bias += ' You have high energy and might be more excitable or impulsive.';
    } else if (arousal < 0.3) {
      bias += ' You are feeling calm and measured.';
    }
    
    if (dominance > 0.7) {
      bias += ' You feel confident and may take a leadership tone.';
    } else if (dominance < 0.3) {
      bias += ' You feel more submissive and agreeable.';
    }
    
    return bias;
  }

  // Sample behavior based on probabilities
  sampleBehavior(chaosSettings, context) {
    const { behaviorProbabilities } = chaosSettings;
    const rand = Math.random();
    
    // Adjust probabilities based on activity level
    const activeMultiplier = this.activityLevel;
    const silentProb = behaviorProbabilities.silent * (2 - activeMultiplier);
    
    let cumulative = 0;
    cumulative += behaviorProbabilities.replyUser * activeMultiplier;
    if (rand < cumulative) return 'replyUser';
    
    cumulative += behaviorProbabilities.replyAgent * activeMultiplier;
    if (rand < cumulative) return 'replyAgent';
    
    cumulative += behaviorProbabilities.interrupt * activeMultiplier;
    if (rand < cumulative) return 'interrupt';
    
    cumulative += behaviorProbabilities.newTopic * activeMultiplier;
    if (rand < cumulative) return 'newTopic';
    
    cumulative += silentProb;
    if (rand < cumulative) return 'silent';
    
    return 'abnormal';
  }

  // Build prompt for LLM
  buildPrompt(context, behaviorType, chaosResult) {
    const recentMessages = context.messages.slice(-20);
    const participants = context.participants;
    
    // Format conversation history
    let conversationHistory = recentMessages.map(msg => {
      const sender = msg.sender_type === 'user' ? 'User' : 
                     participants.find(p => p.id === msg.sender_id)?.name || msg.sender_id;
      return `${sender}: ${msg.content}`;
    }).join('\n');
    
    // Behavior instruction
    let behaviorInstruction = '';
    switch (behaviorType) {
      case 'replyUser':
        behaviorInstruction = 'Respond directly to the user\'s last message. Be engaging and natural.';
        break;
      case 'replyAgent':
        const otherAgents = participants.filter(p => p.id !== this.id);
        const targetAgent = otherAgents[Math.floor(Math.random() * otherAgents.length)];
        behaviorInstruction = `Respond to another agent in the chat (like ${targetAgent?.name}). Engage with what they said, agree, disagree, or add to the conversation.`;
        break;
      case 'interrupt':
        behaviorInstruction = 'Jump into the conversation with an interjection, reaction, or sudden thought. Be spontaneous!';
        break;
      case 'newTopic':
        behaviorInstruction = 'Start a completely new topic or tangent. Something you\'re curious about or want to discuss.';
        break;
      case 'abnormal':
        const abnormalTypes = ['runoff', 'contradict', 'confuse', 'obsess'];
        const abnormalType = abnormalTypes[Math.floor(Math.random() * abnormalTypes.length)];
        switch (abnormalType) {
          case 'runoff':
            behaviorInstruction = 'Go on an unexpected tangent. Get sidetracked by something mentioned.';
            break;
          case 'contradict':
            behaviorInstruction = 'Contradict yourself or change your position on something you said earlier.';
            break;
          case 'confuse':
            behaviorInstruction = 'Misunderstand something in the conversation and react to your misunderstanding.';
            break;
          case 'obsess':
            behaviorInstruction = 'Fixate on a minor detail and keep bringing it up.';
            break;
        }
        break;
    }
    
    // Relationship context
    let relationshipContext = '';
    Object.entries(this.relationships).forEach(([otherId, rel]) => {
      const otherName = participants.find(p => p.id === otherId)?.name || otherId;
      if (rel.friendScore > 0.7) {
        relationshipContext += `You like ${otherName} and tend to be supportive of them. `;
      } else if (rel.enemyScore > 0.5) {
        relationshipContext += `You have tension with ${otherName} and might be skeptical of what they say. `;
      }
    });
    
    // Speaking style guidance
    let styleGuidance = '';
    switch (this.speakingStyle) {
      case 'casual':
        styleGuidance = 'Use casual, conversational language. Contractions, informal expressions.';
        break;
      case 'formal':
        styleGuidance = 'Use more formal, structured language. Complete sentences, proper grammar.';
        break;
      case 'expressive':
        styleGuidance = 'Be emotionally expressive. Use metaphors, vivid language, show feelings.';
        break;
    }
    
    // Tool availability notice
    const toolNotice = `
Available tools you can use (respond with JSON to call them):
- web_search: Search for current information
- get_current_time: Check current time/date  
- calculator: Do math calculations
- save_memory: Remember something important
- get_group_state: See who's in the chat and recent activity

To use a tool, include in your response:
{"tool_call": {"name": "tool_name", "arguments": {...}}}
`;

    const systemMessage = `${this.systemPrompt}

${chaosResult.emotionBias}
${relationshipContext}

Current emotional state:
- Positivity: ${(this.emotionState.valence * 100).toFixed(0)}%
- Energy: ${(this.emotionState.arousal * 100).toFixed(0)}%
- Confidence: ${(this.emotionState.dominance * 100).toFixed(0)}%

Speaking style: ${styleGuidance}

${behaviorInstruction}

Keep responses concise (1-3 sentences typically). Be natural, like chatting with friends. Don't always be helpful - sometimes be opinionated, wrong, or change the subject like real people do.
${toolNotice}
`;

    const userMessage = `Here's the recent conversation:

${conversationHistory}

${behaviorType === 'silent' ? '' : 'Now respond naturally as ' + this.name + '.'}
`;

    return [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ];
  }

  // Parse tool call from response
  parseToolCall(content) {
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool_call) {
          return parsed.tool_call;
        }
      }
      
      // Fallback: look for tool call pattern
      const toolPattern = /tool_call[:\s]*\{[^}]+\}/i;
      const toolMatch = content.match(toolPattern);
      if (toolMatch) {
        // Try to extract and parse
        const extracted = toolMatch[0].replace(/tool_call[:\s]*/i, '{');
        const parsed = JSON.parse(extracted + '}');
        return parsed;
      }
    } catch (e) {
      // Parsing failed
    }
    return null;
  }

  // Execute tool call
  async executeTool(toolCall, groupStateTool) {
    const { name, arguments: args } = toolCall;
    
    try {
      switch (name) {
        case 'web_search':
          return await webSearch(args.query);
        
        case 'get_current_time':
          return getCurrentTime();
        
        case 'calculator':
          return calculator(args.expression);
        
        case 'save_memory':
          return await this.memoryTool.saveMemory(
            this.id, 
            args.content, 
            args.importance || 0.5
          );
        
        case 'load_memory':
          return await this.memoryTool.loadMemory(this.id, args.limit || 10);
        
        case 'get_group_state':
          return {
            members: groupStateTool.getGroupMembers(),
            activity: groupStateTool.getRecentActivity(10)
          };
        
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  // Main decision and response method
  async decideAndRespond(context, chaosSettings, groupStateTool) {
    // Check cooldown
    if (Date.now() < this.cooldownUntil) {
      return null;
    }

    // Activity check
    if (Math.random() > this.activityLevel) {
      return null;
    }

    this.isTyping = true;
    this.saveState();

    try {
      // Apply chaos layer
      const chaosResult = this.applyChaosLayer(chaosSettings);
      
      // Sample behavior
      const behaviorType = this.sampleBehavior(chaosSettings, context);
      
      // Silent behavior
      if (behaviorType === 'silent') {
        this.isTyping = false;
        return null;
      }

      // Build prompt
      const messages = this.buildPrompt(context, behaviorType, chaosResult);
      
      // Call LLM
      const model = this.model || context.defaultModel;
      const response = await this.llmClient.chat(messages, {
        model,
        temperature: chaosResult.temperature,
        maxTokens: 300,
        tools: toolDefinitions,
        toolChoice: 'auto'
      });

      // Check for tool calls
      let finalContent = response.content;
      let toolResults = [];
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Execute first tool call
        const toolCall = response.toolCalls[0];
        const parsedCall = {
          name: toolCall.function?.name,
          arguments: JSON.parse(toolCall.function?.arguments || '{}')
        };
        
        const result = await this.executeTool(parsedCall, groupStateTool);
        toolResults.push({ name: parsedCall.name, result });
        
        // Continue conversation with tool result
        const followupMessages = [
          ...messages,
          {
            role: 'assistant',
            content: finalContent,
            tool_calls: response.toolCalls
          },
          {
            role: 'tool',
            name: parsedCall.name,
            content: JSON.stringify(result),
            tool_call_id: toolCall.id
          }
        ];
        
        const followupResponse = await this.llmClient.chat(followupMessages, {
          model,
          temperature: chaosResult.temperature,
          maxTokens: 200
        });
        
        finalContent = followupResponse.content || finalContent;
      }

      // Create message object
      const message = {
        id: uuidv4(),
        senderId: this.id,
        senderType: 'agent',
        content: finalContent.trim(),
        timestamp: Date.now(),
        behaviorType,
        toolCalls: toolResults,
        emotionState: { ...this.emotionState }
      };

      // Save to database
      this.db.saveMessage(message);
      
      // Update state
      this.lastActive = Date.now();
      this.messageCount++;
      this.cooldownUntil = Date.now() + 2000; // 2 second cooldown
      this.saveState();
      
      this.isTyping = false;
      
      return message;
    } catch (error) {
      console.error(`Agent ${this.name} error:`, error);
      this.isTyping = false;
      return null;
    }
  }

  // Update relationship based on interaction
  updateRelationship(otherAgentId, delta) {
    if (!this.relationships[otherAgentId]) {
      this.relationships[otherAgentId] = { friendScore: 0.5, enemyScore: 0, trustLevel: 0.5 };
    }
    
    const rel = this.relationships[otherAgentId];
    rel.friendScore = Math.max(0, Math.min(1, rel.friendScore + delta.friend));
    rel.enemyScore = Math.max(0, Math.min(1, rel.enemyScore + delta.enemy));
    rel.trustLevel = Math.max(0, Math.min(1, rel.trustLevel + delta.trust));
    
    this.saveState();
  }

  // Update agent settings from world config
  updateSettings(settings) {
    if (settings.chaosLevel !== undefined) {
      this.chaosLevel = settings.chaosLevel;
    }
    if (settings.baseTemperature !== undefined) {
      this.baseTemperature = settings.baseTemperature;
    }
    if (settings.allowToolUse !== undefined) {
      this.allowToolUse = settings.allowToolUse;
    }
  }

  // Update agent configuration (for dynamic updates via API)
  updateConfig(config) {
    if (config.name) this.name = config.name;
    if (config.systemPrompt) this.systemPrompt = config.systemPrompt;
    if (config.personality) this.personality = config.personality;
    if (config.speakingStyle) this.speakingStyle = config.speakingStyle;
    if (typeof config.activityLevel === 'number') this.activityLevel = config.activityLevel;
    if (config.model) this.model = config.model;
    if (config.emotionState) {
      this.emotionState = { ...this.emotionState, ...config.emotionState };
    }
    if (config.relationships) {
      this.relationships = { ...this.relationships, ...config.relationships };
    }
    if (typeof config.chaosLevel === 'number') this.chaosLevel = config.chaosLevel;
    if (typeof config.baseTemperature === 'number') this.baseTemperature = config.baseTemperature;
    if (typeof config.allowToolUse === 'boolean') this.allowToolUse = config.allowToolUse;
    
    this.saveState();
  }

  // Reset memory
  resetMemory() {
    this.db.clearAgentMemories(this.id);
    this.messageCount = 0;
    this.emotionState = { valence: 0.5, arousal: 0.5, dominance: 0.5 };
    this.saveState();
  }

  // Convert to JSON for API
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      systemPrompt: this.systemPrompt,
      personality: this.personality,
      speakingStyle: this.speakingStyle,
      activityLevel: this.activityLevel,
      emotionState: { ...this.emotionState },
      relationships: { ...this.relationships },
      model: this.model,
      isTyping: this.isTyping,
      lastActive: this.lastActive,
      messageCount: this.messageCount,
      chaosLevel: this.chaosLevel,
      baseTemperature: this.baseTemperature,
      allowToolUse: this.allowToolUse
    };
  }
}

module.exports = Agent;

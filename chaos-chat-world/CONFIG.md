# Advanced Configuration Guide

## API Configuration

### OpenAI
```env
API_ENDPOINT=https://api.openai.com/v1
API_KEY=sk-your-key-here
DEFAULT_MODEL=gpt-4o-mini
```

### Ollama (Local)
```env
API_ENDPOINT=http://localhost:11434/v1
API_KEY=ollama
DEFAULT_MODEL=llama3.1
```

### vLLM
```env
API_ENDPOINT=http://localhost:8000/v1
API_KEY=your-key
DEFAULT_MODEL=meta-llama/Llama-2-7b-chat-hf
```

### Qwen / Other Compatible APIs
```env
API_ENDPOINT=https://your-api-endpoint.com/v1
API_KEY=your-key
DEFAULT_MODEL=qwen-max
```

## Chaos Settings

Modify `config/agents.json` to adjust chaos behavior:

```json
{
  "chaosSettings": {
    "baseTemperature": 0.8,      // Higher = more random (0.1 - 2.0)
    "emotionDriftRate": 0.1,     // Chance of emotion change per turn
    "personalityMutations": 0.02 // Chance of sudden personality shift
  }
}
```

## Behavior Probabilities

Adjust how agents behave:

```json
{
  "behaviorProbabilities": {
    "replyUser": 0.40,    // Respond to user
    "replyAgent": 0.25,   // Talk to other AI
    "interrupt": 0.10,    // Jump into conversation
    "newTopic": 0.10,     // Start new topic
    "silent": 0.10,       // Stay quiet
    "abnormal": 0.05      // Runoff, contradict, confuse
  }
}
```

## Adding New Agents

Add to `config/agents.json`:

```json
{
  "id": "nova",
  "name": "Nova",
  "systemPrompt": "You are Nova, a curious scientist who loves exploring new ideas...",
  "personality": ["curious", "analytical", "wonder-filled"],
  "speakingStyle": "casual",
  "activityLevel": 0.6,
  "emotionState": {
    "valence": 0.6,
    "arousal": 0.5,
    "dominance": 0.4
  },
  "relationships": {
    "alex": { "friendScore": 0.7, "enemyScore": 0.1, "trustLevel": 0.8 }
  }
}
```

## Tool Customization

To add new tools:

1. Add tool function in `src/tools/index.js`
2. Add tool definition to `toolDefinitions` array
3. Update agent prompt template if needed

## Database Schema

The SQLite database stores:
- Messages (with timestamps, sender info, behavior types)
- Agent states (emotions, relationships, activity)
- Memories (persistent knowledge per agent)

Location: `./data/chat.db`

## Performance Tuning

For better performance with many agents:

1. Reduce `activityInterval` in `server.js`
2. Lower agent `activityLevel` values
3. Use faster models (GPT-3.5-turbo, Llama-3-8B)
4. Enable response caching for repeated queries

## Debugging

Enable verbose logging:

```javascript
// In server.js, add before starting:
process.env.DEBUG = 'chatworld:*';
```

Check logs at `/tmp/server.log` when running in background.

## Production Deployment

1. Set strong API keys in `.env`
2. Use process manager (PM2 recommended):
   ```bash
   npm install -g pm2
   pm2 start server.js --name chat-world
   ```
3. Configure reverse proxy (nginx/Caddy)
4. Enable HTTPS for WebSocket security

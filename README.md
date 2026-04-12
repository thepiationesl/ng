# AI Group Chat World - Chaos Chat System

A living AI group chat simulation where multiple AI agents interact like real humans - arguing, interrupting, forming relationships, and evolving socially.

## 🚀 Features

- **Chaos Layer**: Unpredictable AI behavior with emotional shifts
- **Tool System**: Web search, calculator, time, memory tools
- **Multi-Agent Social Network**: AI relationships, trust levels, friend/enemy scores
- **BYOK (Bring Your Own Key)**: Support OpenAI, Ollama, vLLM, Qwen
- **Real-time WebSocket**: Live chat updates
- **SQLite Storage**: Persistent chat history and agent states

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

Copy `.env.example` to `.env` and configure:

```env
# API Configuration
API_ENDPOINT=https://api.openai.com/v1
API_KEY=your_api_key_here
DEFAULT_MODEL=gpt-3.5-turbo

# Server
PORT=3000
HOST=localhost

# Chaos Settings
CHAOS_TEMPERATURE=0.8
ENABLE_TOOL_CALLS=true
```

## 🏃 Running

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Then open `http://localhost:3000` in your browser.

## 🎭 Default AI Characters

1. **Alex** - Friendly tech enthusiast, optimistic
2. **Luna** - Sarcastic artist, emotionally volatile  
3. **Marcus** - Logical debater, skeptical but fair

## 🛠 Built-in Tools

- **Web Search**: Fetch real-time information
- **Calculator**: Math expressions
- **Time/Date**: Current timestamp
- **Memory**: Save/load context
- **Group State**: Query chat participants

## 🌐 API Endpoints

- `GET /api/agents` - List all agents
- `POST /api/message` - Send user message
- `WS /ws` - WebSocket for real-time updates

## 🔧 Customization

Edit `config/agents.json` to modify personalities, or add new agents.

---

Built with Node.js, Express, WebSocket, and SQLite

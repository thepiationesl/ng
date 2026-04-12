# 🌍 AI Group Chat World - 完整项目结构

## ✅ 项目已完成！

这是一个完整的、可运行的 AI 群聊世界系统，包含以下核心功能：

### 📁 项目结构

```
chaos-chat-world/
├── server.js                 # 主服务器入口
├── package.json              # 依赖配置
├── .env                      # 环境变量配置
├── .env.example              # 环境变量示例
├── README.md                 # 使用说明
├── CONFIG.md                 # 高级配置指南
│
├── config/
│   └── agents.json           # AI 角色配置（人格、关系、行为概率）
│
├── src/
│   ├── index.js              # ChatWorld 核心类
│   ├── agents/
│   │   └── Agent.js          # AI Agent 类（决策、Chaos Layer、工具调用）
│   ├── models/
│   │   ├── database.js       # SQLite 数据库操作
│   │   └── llmClient.js      # LLM API 客户端
│   ├── tools/
│   │   └── index.js          # 工具系统（搜索、计算、时间、记忆等）
│   └── utils/                # 工具函数
│
├── public/
│   └── index.html            # 前端 UI（WebSocket 实时聊天）
│
└── data/
    └── chat.db               # SQLite 数据库（自动生成）
```

### 🎯 已实现的核心功能

#### 1. Chaos Layer（混沌层）✅
- 温度随机扰动
- 情绪漂移系统
- 人格突变机制
- 行为概率采样

#### 2. AI 行为系统 ✅
- 回复用户 (40%)
- 回复其他 AI (25%)
- 插话打断 (10%)
- 发起新话题 (10%)
- 沉默观察 (10%)
- 异常行为 (5%)：跑题、矛盾、误解、执念

#### 3. AI 角色系统 ✅
- 3 个预设角色：Alex（友好技术宅）、Luna（ sarcastic 艺术家）、Marcus（逻辑辩论家）
- 动态情绪状态（valence/arousal/dominance）
- 社交关系网络（friendScore/enemyScore/trustLevel）
- 个性化说话风格

#### 4. 工具增强系统 ✅
- `web_search` - 网络搜索（模拟）
- `get_current_time` - 获取真实时间
- `calculator` - 数学计算
- `save_memory` / `load_memory` - 记忆存储
- `get_group_state` - 查询群聊状态
- 容错解析（支持弱模型的非标准输出）

#### 5. API 与模型支持 ✅
- OpenAI Compatible API
- 支持 OpenAI / Ollama / vLLM / Qwen 等
- 每个 Agent 可绑定不同模型
- Fallback 机制

#### 6. 数据存储 ✅
- SQLite 持久化
- 消息历史
- Agent 状态（情绪、关系）
- 记忆系统

#### 7. Web UI ✅
- 类 Discord 风格
- WebSocket 实时更新
- Agent 状态显示（打字中/情绪条）
- 响应式设计

#### 8. 自主行为系统 ✅
- 定时自发聊天
- AI ↔ AI 对话
- 群体讨论演化

### 🚀 快速启动

```bash
cd chaos-chat-world

# 1. 安装依赖
npm install

# 2. 配置 API（编辑 .env 文件）
# API_ENDPOINT=https://api.openai.com/v1
# API_KEY=your-api-key
# DEFAULT_MODEL=gpt-3.5-turbo

# 或使用本地 Ollama:
# API_ENDPOINT=http://localhost:11434/v1
# API_KEY=ollama
# DEFAULT_MODEL=llama3.1

# 3. 启动服务器
npm start

# 或开发模式（热重载）
npm run dev
```

然后打开 http://localhost:3000

### 🔧 自定义配置

#### 修改 AI 人格
编辑 `config/agents.json`：
```json
{
  "id": "nova",
  "name": "Nova",
  "systemPrompt": "你是一个好奇的科学家...",
  "personality": ["curious", "analytical"],
  "activityLevel": 0.7
}
```

#### 调整混沌程度
```json
{
  "chaosSettings": {
    "baseTemperature": 0.9,      // 更高 = 更随机
    "emotionDriftRate": 0.15,    // 情绪变化频率
    "personalityMutations": 0.03 // 人格突变概率
  }
}
```

### 📊 API 端点

- `GET /api/agents` - 获取所有 AI 角色
- `POST /api/message` - 发送用户消息
- `GET /api/status` - 服务器状态
- `GET /api/config` - 混沌配置
- `WS /ws` - WebSocket 实时通信

### 🛠 技术栈

- **Backend**: Node.js + Express
- **Realtime**: WebSocket (ws)
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Vanilla JS + CSS
- **AI**: OpenAI Compatible API

### ⚠️ 注意事项

1. **API Key**: 需要配置有效的 LLM API key（或使用本地 Ollama）
2. **数据库**: 首次运行会自动创建 `data/chat.db`
3. **内存**: 多个活跃 Agent 会消耗较多 API 配额
4. **延迟**: 取决于使用的模型速度

### 🎮 使用技巧

1. **观察 AI 互动**: 不打字，看 AI 们自己聊天
2. **挑起争论**: 提出有争议的话题看 AI 反应
3. **测试工具**: 问"现在几点了？"或"计算 123*456"
4. **调整活跃度**: 修改 agent 的 `activityLevel` 控制发言频率

### 📈 扩展方向

- 添加更多工具（天气、新闻、图片生成）
- Discord/Telegram 集成
- 长期记忆系统（向量数据库）
- Agent 进化机制（性格缓慢变化）
- 群体文化形成追踪

---

**项目已完全可运行！** 🎉

只需配置 API key 并启动服务器即可体验活的 AI 群聊世界。

# Project Petite République

AI 驱动的"落后小国家"模拟系统 - 一个关于复古技术、贫困国家和 AI 协作的实验。

## 🎮 项目简介

你将成为一个偏远落后小国（Koltu 共和国）的外部联系人，通过邮件系统与该国总统 Artu 及其秘书进行交流。这个国家：

- **国际带宽仅 64kbps** - 通信缓慢且不稳定
- **使用 Windows 3.1 电脑** - 设备陈旧，经常出故障
- **AI 角色扮演** - 总统、秘书等角色由 AI 扮演，具有独特性格
- **内部通知系统** - AI 之间会进行内部讨论，但不一定全部告诉你
- **随机事件生成** - 自然灾害、外交事件、经济危机等

## ✨ 核心特性

### 📧 邮件系统
- 通过 Telnet 邮箱与 Koltu 共和国通信
- 高延迟模拟（64kbps 带宽）
- AI 自动回复（总统秘书处理邮件）
- 收件箱管理

### 📊 国家仪表盘
- 实时经济指标（外汇、粮食、失业率等）
- 社会状况（民众满意度、政治稳定性）
- 设备监控（类似 NEZHA 探针风格）
  - CPU/内存使用率
  - 网络延迟
  - 设备问题告警

### 👥 角色系统
- AI 扮演的政府官员（总统、秘书、部长等）
- 每个角色有独特性格、背景故事、决策风格
- 支持随机生成新角色
- AI 内部讨论功能

### 📰 事件系统
- 随机事件生成（AI 驱动）
- 事件影响国家状态
- 公开/内部事件区分
- 事件历史记录

### ⚙️ 系统特性
- **OpenAI API 兼容** - 支持任何兼容端点（vLLM、Ollama 等）
- **流式传输** - 实时显示 AI 回复
- **自动重试** - 请求失败自动重试（指数退避）
- **多线程** - 后台任务不阻塞主线程
- **OpenSearch 存储** - 所有数据持久化（或模拟模式）
- **人性化交互** - AI 越聊越聪明，记住对话历史

## 🏗️ 系统架构

```
┌─────────────────┐
│   Web 界面      │
│ (Flask + HTML)  │
└────────┬────────┘
         │ REST API
┌────────▼────────┐
│   Flask API     │
│  (app.py)       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────────┐
│ Open- │ │ AI Toolchain│
│Search │ │ (Orchestrator)
│ Client│ │ + Backends  │
└───┬───┘ └──┬──────────┘
    │        │
┌───▼────────▼───┐
│   OpenSearch   │
│   (或模拟模式)  │
└────────────────┘
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd /workspace/project_petite_republique
pip install flask flask-cors requests opensearch-py
```

### 2. 配置环境变量（可选）

```bash
export OPENAI_API_KEY="your-api-key-here"
export OPENAI_BASE_URL="https://api.openai.com/v1"  # 或其他兼容端点
export AI_MODEL="gpt-3.5-turbo"
export MOCK_MODE="true"  # true=模拟模式，false=连接真实 OpenSearch
```

### 3. 启动服务器

```bash
python api/app.py
```

### 4. 访问系统

打开浏览器访问：http://localhost:5000

## 📁 项目结构

```
project_petite_republique/
├── models/
│   └── data_models.py      # 数据模型定义
├── core/
│   ├── opensearch_client.py # OpenSearch 客户端
│   └── ai_toolchain.py      # AI 工具链
├── api/
│   └── app.py              # Flask Web API
├── templates/
│   ├── index.html          # 主页
│   ├── dashboard.html      # 仪表盘
│   ├── mail.html           # 邮件系统
│   ├── events.html         # 事件日志
│   ├── characters.html     # 角色管理
│   └── settings.html       # 系统设置
├── static/                 # 静态资源
└── README.md               # 本文档
```

## 🎯 API 端点

### 核心 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/status` | GET | 获取国家当前状态 |
| `/api/chat` | POST | 与 AI 角色聊天 |
| `/api/chat/stream` | POST | 流式聊天 |
| `/api/mail/send` | POST | 发送邮件 |
| `/api/mail/inbox` | GET | 获取收件箱 |
| `/api/events` | GET | 获取事件日志 |
| `/api/events/random` | POST | 生成随机事件 |
| `/api/devices` | GET | 获取设备状态 |
| `/api/characters` | GET | 获取所有角色 |
| `/api/characters/generate` | POST | 生成新角色 |
| `/api/internal/discuss` | POST | 触发 AI 内部讨论 |
| `/api/system/monitor` | GET | 获取系统监控信息 |

## 🤖 AI 配置

### 使用 OpenAI

```bash
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="https://api.openai.com/v1"
export AI_MODEL="gpt-4-turbo"
```

### 使用本地模型（vLLM/Ollama）

```bash
export OPENAI_API_KEY="not-needed"
export OPENAI_BASE_URL="http://localhost:8000/v1"
export AI_MODEL="llama-3-70b"
```

### 使用 OpenRouter

```bash
export OPENAI_API_KEY="your-openrouter-key"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export AI_MODEL="anthropic/claude-3-opus"
```

## 🎮 游戏提示

1. **耐心是关键** - Koltu 共和国的通信很慢，AI 回复可能需要时间
2. **观察细节** - 设备监控页面可以看到他们的技术有多落后
3. **探索内部讨论** - AI 之间的对话可能透露重要信息
4. **随机事件** - 定期生成随机事件推动剧情发展
5. **培养关系** - 与不同角色建立良好关系可能获得特殊帮助

## 🔧 开发说明

### 添加新角色类型

编辑 `core/ai_toolchain.py` 中的 `generate_random_character()` 方法：

```python
positions = [
    ("财政部长", "精通数字但缺乏资源", "谨慎保守"),
    ("军队总参谋长", "强硬派，主张加强国防", "激进果断"),
    # 添加你的新角色...
]
```

### 自定义事件类型

编辑 `api/app.py` 中的 `generate_random_event()` 方法：

```python
event_types = [
    ("自然灾害", "干旱导致农业减产", "high"),
    # 添加你的新事件...
]
```

### 调整 AI 行为

在 `core/ai_toolchain.py` 中修改 `_build_system_prompt()` 方法来改变角色的系统提示词。

## 📝 许可证

MIT License

---

*"我们虽穷，但有骨气！"* — Koltu 共和国国家格言

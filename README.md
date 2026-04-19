# 随机国家邮件 RP 系统

一个由 Faker.js 驱动的随机世界生成与交互系统，玩家通过 Fake Email 界面进行唯一的读写交互。

## 项目特点

- 🎭 **动态角色生成**：使用 Faker.js 实时生成角色，无预设 NPC
- 📧 **唯一交互接口**：玩家只能通过 Fake Email 阅读和发送邮件
- 🌍 **濒临崩溃的世界**：所有初始设备处于"快坏掉"状态
- 🤖 **AI 驱动**：支持 OpenAI API 兼容配置
- 💾 **持久化存储**：使用 OpenSearch/SQLite 存储世界状态

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装

```bash
npm install
```

### 配置

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
PORT=3000
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
MODEL=gpt-4o-mini
DB_PATH=./data/database.sqlite
```

### 运行

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

访问 http://localhost:3000/setup 开始配置

## 系统架构

```
Setup 页面（初始配置）
        ↓
Faker.js 生成引擎（国家/角色/事件）
        ↓
Fake Email 交互（玩家唯一输入口）
        ↓
内部群组讨论生成（只读展示）
        ↓
OpenSearch/SQLite 类脑知识库（持久化）
        ↓
管理后台（运维与监控）
```

## 核心功能模块

### 1. Setup 页面 (`/setup`)
- OpenAI API Key 配置
- API Endpoint 设置
- 模型选择
- 风格权重调节
- 随机种子设置

### 2. Fake Email 界面 (`/email`)
- 异步邮件通信
- 延迟与丢包模拟
- 流式输出（打字机效果）
- 支持多模态内容（日志、报错、乱码等）

### 3. 内部讨论界面 (`/discussions`)
- 多角色群组聊天视图（只读）
- 展示决策过程
- 意见冲突与妥协

### 4. 管理后台 (`/admin`)
- 查看所有对话记录
- 查看角色/设备/国家状态
- 手动触发随机事件
- 数据导出

### 5. 设备状态面板 (`/devices`)
- 展示濒临崩溃的设备状态
- 实时故障模拟

### 6. 国家概况 (`/country`)
- 随机生成的国家信息
- 天气与随机事件

## 初始设备清单

所有设备默认处于"濒临崩溃"状态：

- ☀️ 快烂掉的太阳能板
- 🔋 快坏掉的户外移动电源
- 💻 Windows 3.1 电脑
- 🧱 BASIC 电脑
- 📠 垃圾调制解调器
- ☎️ 垃圾电话
- 🔌 垃圾插排

**故障标准**：一天没坏 12 次，说明还不够烂！

## 动态角色生成规则

角色不是预设的，而是根据玩家邮件内容实时生成：

```
玩家提及"财政部" 
  → 系统立即生成"财政部长"角色
  → 赋予技术认知、性格、设备属性
  → 存入数据库
  → 后续邮件中永久复用
```

## 开发注意事项

- ❌ 禁止预设固定角色表
- ❌ 禁止构建"正常现代化国家"
- ✅ 世界应呈现：拼凑感、不稳定性、技术代差、荒诞但自洽的逻辑
- ✅ 如果代码看起来"过于优雅和稳定"，请引入更多随机故障

## MVP 第一阶段范围

1. ✅ Setup 页面（API 配置）
2. ✅ Fake Email 界面（读写功能）
3. ✅ 初始"快坏设备"环境加载
4. ✅ Faker.js 动态角色生成逻辑
5. ✅ 内部群组讨论界面（只读）
6. ✅ 第一封入站邮件生成
7. ✅ SQLite 数据存储链路
8. ✅ 最简管理后台（查看功能）

## 项目结构

```
├── src/
│   ├── routes/          # 路由定义
│   ├── controllers/     # 控制器
│   ├── services/        # 业务逻辑
│   ├── models/          # 数据模型
│   ├── middleware/      # 中间件
│   └── utils/           # 工具函数
├── public/
│   ├── css/             # 样式文件
│   └── js/              # 前端脚本
├── views/               # HTML 模板
├── data/                # 数据库文件
├── .env.example         # 环境变量示例
├── package.json
└── README.md
```

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3) / OpenSearch
- **AI**: OpenAI API 兼容接口
- **数据生成**: Faker.js
- **前端**: 原生 HTML/CSS/JavaScript

## License

ISC

const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const DatabaseService = require('./models/database');
const FakerService = require('./services/fakerService');
const AIService = require('./services/aiService');

// 路由
const setupRoutes = require('./routes/setup');
const emailRoutes = require('./routes/email');
const discussionRoutes = require('./routes/discussions');
const deviceRoutes = require('./routes/devices');
const countryRoutes = require('./routes/country');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 初始化服务
const dbPath = process.env.DB_PATH || './data/database.sqlite';
const db = new DatabaseService(dbPath);
const fakerService = new FakerService();
const aiService = new AIService(
  process.env.OPENAI_API_KEY,
  process.env.OPENAI_BASE_URL,
  process.env.MODEL
);

// 将服务注入到请求对象
app.use((req, res, next) => {
  req.db = db;
  req.fakerService = fakerService;
  req.aiService = aiService;
  next();
});

// 路由注册
app.use('/api/setup', setupRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/country', countryRoutes);
app.use('/api/admin', adminRoutes);

// 页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html'));
});

app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/setup.html'));
});

app.get('/email', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/email.html'));
});

app.get('/discussions', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/discussions.html'));
});

app.get('/devices', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/devices.html'));
});

app.get('/country', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/country.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin.html'));
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      ai: aiService.isConfigured() ? 'configured' : 'not_configured',
      faker: 'ready'
    }
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: '这个页面可能已经随着设备一起坏掉了',
    suggestion: '试试访问 /setup 或 /email'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  
  // 模拟设备故障风格的错误信息
  constfailureMessages = [
    '系统发生错误，就像太阳能板突然被雷击了一样',
    'Something went wrong. 我们的调制解调器可能在传输过程中丢包了',
    '错误已记录（如果日志系统还没崩溃的话）',
    '别担心，这种故障在我们这里很常见'
  ];

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    detail: failureMessages[Math.floor(Math.random() * failureMessages.length)],
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   随机国家邮件 RP 系统 - 已启动                          ║
║                                                          ║
║   访问地址：http://localhost:${PORT}                      ║
║                                                          ║
║   可用页面：                                             ║
║   - /setup     初始配置                                  ║
║   - /email     邮件交互（主界面）                        ║
║   - /discussions 内部讨论（只读）                        ║
║   - /devices   设备状态                                  ║
║   - /country   国家概况                                  ║
║   - /admin     管理后台                                  ║
║                                                          ║
║   ⚠️ 警告：所有设备都处于濒临崩溃状态                    ║
║   一天没坏 12 次，说明还不够烂。                           ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  db.close();
  process.exit(0);
});

module.exports = app;

const OpenAI = require('openai');

class AIService {
  constructor(apiKey, baseUrl, model) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model || 'gpt-4o-mini';
    
    if (apiKey && apiKey !== 'your_api_key_here') {
      this.client = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl || 'https://api.openai.com/v1'
      });
    } else {
      this.client = null;
    }
  }

  updateConfig(apiKey, baseUrl, model) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model || 'gpt-4o-mini';
    
    if (apiKey && apiKey !== 'your_api_key_here') {
      this.client = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl || 'https://api.openai.com/v1'
      });
    } else {
      this.client = null;
    }
  }

  isConfigured() {
    return this.client !== null;
  }

  // 生成邮件回复
  async generateEmailReply(context, playerEmail, character) {
    if (!this.client) {
      return this._generateFallbackReply(playerEmail, character);
    }

    try {
      const prompt = `你是一个来自濒临崩溃的随机国家的${character.title}（${character.name}）。
你的性格：${character.personality}
技术能力：${character.technical_knowledge}

当前国家处于不稳定状态，所有设备都随时可能故障。

玩家发来的邮件：
---
${playerEmail}
---

请以角色的身份回复这封邮件。要求：
1. 保持角色的性格特点
2. 体现世界的破碎感和不稳定性
3. 可以适当提及设备故障、网络问题等
4. 回复长度适中（100-300 字）
5. 使用中文回复`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: '你是一个生活在技术崩溃边缘世界的政府官员，负责与外部联络。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('AI 生成失败:', error.message);
      return this._generateFallbackReply(playerEmail, character);
    }
  }

  // 生成内部讨论
  async generateDiscussion(topic, characters) {
    if (!this.client) {
      return this._generateFallbackDiscussion(topic, characters);
    }

    try {
      const characterList = characters.map(c => `${c.name}（${c.title}）- ${c.personality}`).join('\n');
      
      const prompt = `以下是参与讨论的角色：
${characterList}

讨论主题：${topic}

请生成一段多角色讨论，要求：
1. 每个角色都要发言，体现各自的性格
2. 展现意见分歧和妥协过程
3. 体现世界的混乱和不稳定
4. 最后有一个简短的总结
5. 使用中文`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: '你是一个叙事引擎，负责生成多角色讨论场景。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 800
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('AI 讨论生成失败:', error.message);
      return this._generateFallbackDiscussion(topic, characters);
    }
  }

  // 分析邮件内容，检测是否需要生成新角色
  analyzeEmailForTriggers(emailBody) {
    const triggerPatterns = {
      '财政部': ['财政', '预算', '资金', '钱', '税收', '经济', '支出'],
      '国防部': ['国防', '军事', '安全', '边境', '军队', '防御'],
      '科技部': ['科技', '技术', '设备', '系统', '网络', '电脑', '软件'],
      '外交部': ['外交', '国际', '外国', '条约', '谈判', '关系'],
      '卫生部': ['卫生', '医疗', '健康', '疾病', '医院', '药品'],
      '教育部': ['教育', '学校', '学习', '课程', '教师', '学生'],
      '能源部': ['能源', '电力', '太阳能', '电池', '供电', '燃料'],
      '通信部': ['通信', '邮件', '电话', '网络', '信号', '联络']
    };

    const triggers = [];
    const lowerBody = emailBody.toLowerCase();

    for (const [department, keywords] of Object.entries(triggerPatterns)) {
      for (const keyword of keywords) {
        if (lowerBody.includes(keyword.toLowerCase())) {
          triggers.push(department);
          break;
        }
      }
    }

    return [...new Set(triggers)]; // 去重
  }

  // 降级方案：当 AI 不可用时的备用回复
  _generateFallbackReply(playerEmail, character) {
    const fallbacks = [
      `【系统通知：AI 服务暂时不可用】\n\n${character.name} 回复：\n收到你的邮件了。现在的情况你也知道，我们的 AI 助手也罢工了。\n\n但我会尽力回复你——毕竟这是我们为数不多还能用的沟通方式。`,
      
      `【自动回复：智能生成系统离线】\n\n你好，我是${character.name}。\n\n由于${['电力不足', '网络中断', '设备故障', '系统崩溃'][Math.floor(Math.random() * 4)]}，我无法使用智能助手来帮你写回复。\n\n不过我本人就在这里，有什么事直说吧。`,
      
      `[${character.name} 的手动回复]\n\n邮件已收到。（这是我自己打的字，不是 AI 生成的——那玩意儿又坏了）\n\n说正事吧，你需要什么？`
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // 降级方案：备用讨论生成
  _generateFallbackDiscussion(topic, characters) {
    const lines = [`【讨论主题：${topic}】\n`];
    
    const opinions = [
      '我认为我们应该优先考虑稳定性...',
      '但是设备撑不了多久了！',
      '有没有更便宜的替代方案？',
      '上次这样搞差点让整个系统崩溃...',
      '我同意，但我们没有选择了',
      '让我查查手册...哦等等，手册也丢了',
      '能不能用胶带先固定一下？',
      '这个方案风险太大了'
    ];

    for (const character of characters.slice(0, 5)) {
      lines.push(`[${character.name} - ${character.title}]: ${opinions[Math.floor(Math.random() * opinions.length)]}`);
    }

    lines.push('\n【讨论总结】各方意见不一，决定暂缓决策，等待设备状态好转。');

    return lines.join('\n');
  }
}

module.exports = AIService;

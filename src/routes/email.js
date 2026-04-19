const express = require('express');
const router = express.Router();

// 获取邮件列表
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const emails = req.db.getEmails(null, limit);
    
    // 模拟网络延迟
    const networkCondition = req.fakerService.simulateNetworkCondition();
    
    setTimeout(() => {
      if (networkCondition.is_dropped) {
        res.status(503).json({
          success: false,
          error: 'network_lost',
          message: '邮件传输失败，连接中断'
        });
      } else {
        res.json({
          success: true,
          emails: emails.map(email => ({
            ...email,
            metadata: email.metadata ? JSON.parse(email.metadata) : null
          })),
          network_quality: networkCondition.quality
        });
      }
    }, networkCondition.delay_ms);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 发送玩家邮件
router.post('/send', async (req, res) => {
  try {
    const { subject, body, recipient } = req.body;
    
    if (!body) {
      return res.status(400).json({ success: false, error: '邮件内容不能为空' });
    }
    
    // 保存玩家邮件
    const emailData = {
      sender: 'player@external.net',
      recipient: recipient || 'gov@gov.broken.net',
      subject: subject || '(无主题)',
      body,
      is_read: 1,
      is_player_sent: 1,
      metadata: JSON.stringify({
        sent_at: new Date().toISOString(),
        network_condition: req.fakerService.simulateNetworkCondition()
      })
    };
    
    req.db.insert('emails', emailData);
    
    // 分析邮件内容，检测是否需要生成新角色
    const triggers = req.aiService.analyzeEmailForTriggers(body);
    const newCharacters = [];
    
    for (const department of triggers) {
      const existingCharacter = req.db.getCharacterByDepartment(department);
      
      if (!existingCharacter) {
        // 动态生成新角色
        const characterData = req.fakerService.generateCharacter(department, body);
        req.db.insert('characters', characterData);
        newCharacters.push(characterData);
      }
    }
    
    // 获取或创建默认回复角色
    let replyCharacter = req.db.selectOne('characters', {});
    if (!replyCharacter) {
      // 创建一个默认的通信官员
      replyCharacter = req.fakerService.generateCharacter('通信部', body);
      req.db.insert('characters', replyCharacter);
    }
    
    // 生成 AI 回复（异步，不阻塞响应）
    setImmediate(async () => {
      try {
        const replyBody = await req.aiService.generateEmailReply({}, body, replyCharacter);
        
        const replyEmail = {
          sender: replyCharacter.email,
          recipient: 'player@external.net',
          subject: `Re: ${subject || '(无主题)'}`,
          body: replyBody,
          is_read: 0,
          is_player_sent: 0,
          metadata: JSON.stringify({
            reply_to: 'player@external.net',
            character_id: replyCharacter.id,
            generated_at: new Date().toISOString()
          })
        };
        
        req.db.insert('emails', replyEmail);
        
        // 如果有新角色生成，触发内部讨论
        if (newCharacters.length > 0) {
          const allCharacters = req.db.getAllCharacters();
          const discussion = req.fakerService.generateDiscussion(
            allCharacters,
            `新联络人提及：${subject || '未知事项'}`
          );
          
          req.db.insert('discussions', {
            participants: discussion.participants,
            topic: discussion.topic,
            content: discussion.content,
            summary: discussion.summary
          });
        }
      } catch (error) {
        console.error('生成回复失败:', error);
      }
    });
    
    // 模拟网络延迟后返回
    const networkCondition = req.fakerService.simulateNetworkCondition();
    
    setTimeout(() => {
      res.json({
        success: true,
        message: '邮件已发送（可能已丢失）',
        new_characters: newCharacters,
        network_delay: networkCondition.delay_ms
      });
    }, networkCondition.delay_ms);
    
  } catch (error) {
    console.error('发送邮件失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 标记邮件为已读
router.put('/read/:id', (req, res) => {
  try {
    const emailId = req.params.id;
    req.db.update('emails', { is_read: 1 }, { id: emailId });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除邮件
router.delete('/:id', (req, res) => {
  try {
    const emailId = req.params.id;
    req.db.delete('emails', { id: emailId });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

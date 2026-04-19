const express = require('express');
const router = express.Router();

// 获取讨论列表
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const countryId = req.query.country_id;
    
    const discussions = req.db.getDiscussions(countryId ? parseInt(countryId) : null, limit);
    
    res.json({
      success: true,
      discussions: discussions.map(discussion => ({
        ...discussion,
        participants: discussion.participants ? JSON.parse(discussion.participants) : []
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个讨论详情
router.get('/:id', (req, res) => {
  try {
    const discussionId = req.params.id;
    const discussions = req.db.select('discussions', { id: discussionId }, 1);
    
    if (discussions.length === 0) {
      return res.status(404).json({ success: false, error: '讨论不存在' });
    }
    
    const discussion = discussions[0];
    res.json({
      success: true,
      discussion: {
        ...discussion,
        participants: discussion.participants ? JSON.parse(discussion.participants) : []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 触发新的内部讨论（管理员功能）
router.post('/trigger', (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic) {
      return res.status(400).json({ success: false, error: '话题不能为空' });
    }
    
    // 获取所有角色
    const characters = req.db.getAllCharacters();
    
    if (characters.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '没有可用角色，请先通过邮件互动生成角色' 
      });
    }
    
    // 生成讨论
    const discussion = req.fakerService.generateDiscussion(characters, topic);
    
    req.db.insert('discussions', {
      participants: discussion.participants,
      topic: discussion.topic,
      content: discussion.content,
      summary: discussion.summary
    });
    
    res.json({
      success: true,
      message: '讨论已生成',
      discussion
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

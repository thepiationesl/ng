const express = require('express');
const router = express.Router();

// 获取国家信息
router.get('/', (req, res) => {
  try {
    const sessionState = req.db.getSessionState();
    
    if (!sessionState || !sessionState.current_country_id) {
      return res.status(404).json({ 
        success: false, 
        error: '国家尚未生成，请先完成 Setup' 
      });
    }
    
    const countries = req.db.select('countries', { id: sessionState.current_country_id }, 1);
    
    if (countries.length === 0) {
      return res.status(404).json({ success: false, error: '国家数据丢失' });
    }
    
    const country = countries[0];
    
    // 获取该国的事件
    const events = req.db.getEvents(sessionState.current_country_id, 5);
    
    res.json({
      success: true,
      country: {
        ...country,
        recent_events: events
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 触发随机事件（管理员功能）
router.post('/events/trigger', (req, res) => {
  try {
    const sessionState = req.db.getSessionState();
    
    if (!sessionState || !sessionState.current_country_id) {
      return res.status(400).json({ success: false, error: '没有活跃的国家' });
    }
    
    const eventData = req.fakerService.generateEvent(sessionState.current_country_id);
    req.db.insert('events', eventData);
    
    res.json({
      success: true,
      message: '随机事件已触发',
      event: eventData
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取历史事件
router.get('/events', (req, res) => {
  try {
    const sessionState = req.db.getSessionState();
    const limit = parseInt(req.query.limit) || 10;
    
    const events = req.db.getEvents(
      sessionState ? sessionState.current_country_id : null, 
      limit
    );
    
    res.json({
      success: true,
      events
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

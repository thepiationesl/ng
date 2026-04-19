const express = require('express');
const router = express.Router();

// 获取系统总览
router.get('/overview', (req, res) => {
  try {
    const sessionState = req.db.getSessionState();
    const config = req.db.getApiConfig();
    
    // 统计数据
    const countries = req.db.select('countries', {}, 10);
    const characters = req.db.getAllCharacters();
    const devices = req.db.getAllDevices();
    const emails = req.db.getEmails(null, 100);
    const discussions = req.db.getDiscussions(null, 50);
    const events = req.db.getEvents(null, 20);
    
    res.json({
      success: true,
      overview: {
        setup_completed: sessionState ? sessionState.setup_completed : 0,
        current_country_id: sessionState ? sessionState.current_country_id : null,
        api_configured: config && config.api_key && config.api_key !== 'your_api_key_here',
        stats: {
          countries: countries.length,
          characters: characters.length,
          devices: devices.length,
          emails: emails.length,
          discussions: discussions.length,
          events: events.length
        },
        device_health: {
          working: devices.filter(d => d.status === 'working').length,
          broken: devices.filter(d => d.status === 'broken').length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 查看所有角色
router.get('/characters', (req, res) => {
  try {
    const characters = req.db.getAllCharacters();
    
    res.json({
      success: true,
      characters: characters.map(c => ({
        ...c,
        metadata: c.metadata ? JSON.parse(c.metadata) : null
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 查看所有邮件
router.get('/emails', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const emails = req.db.getEmails(null, limit);
    
    res.json({
      success: true,
      emails: emails.map(e => ({
        ...e,
        metadata: e.metadata ? JSON.parse(e.metadata) : null
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重置系统（危险操作）
router.post('/reset', (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'YES_RESET_EVERYTHING') {
      return res.status(400).json({ 
        success: false, 
        error: '请确认重置操作，设置 confirm: "YES_RESET_EVERYTHING"' 
      });
    }
    
    // 删除所有数据
    req.db.delete('events', {});
    req.db.delete('discussions', {});
    req.db.delete('emails', {});
    req.db.delete('devices', {});
    req.db.delete('characters', {});
    req.db.delete('countries', {});
    req.db.delete('session_state', {});
    
    res.json({
      success: true,
      message: '系统已完全重置。世界重新开始了。'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出数据
router.get('/export', (req, res) => {
  try {
    const data = {
      exported_at: new Date().toISOString(),
      countries: req.db.select('countries', {}),
      characters: req.db.getAllCharacters(),
      devices: req.db.getAllDevices(),
      emails: req.db.getEmails(null, 1000),
      discussions: req.db.getDiscussions(null, 100),
      events: req.db.getEvents(null, 100)
    };
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

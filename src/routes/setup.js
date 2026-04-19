const express = require('express');
const router = express.Router();

// 获取当前配置
router.get('/config', (req, res) => {
  try {
    const config = req.db.getApiConfig();
    res.json({
      success: true,
      config: config || {
        api_key: '',
        base_url: '',
        model: '',
        style_weight: 0.5
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存配置
router.post('/config', (req, res) => {
  try {
    const { api_key, base_url, model, style_weight, random_seed } = req.body;
    
    // 检查是否已有配置
    const existing = req.db.selectOne('api_config', { id: 1 });
    
    if (existing) {
      req.db.update('api_config', {
        api_key,
        base_url,
        model,
        style_weight: style_weight || 0.5,
        random_seed,
        updated_at: new Date().toISOString()
      }, { id: 1 });
    } else {
      req.db.insert('api_config', {
        id: 1,
        api_key,
        base_url,
        model,
        style_weight: style_weight || 0.5,
        random_seed
      });
    }
    
    // 更新 AI 服务配置
    req.aiService.updateConfig(api_key, base_url, model);
    
    res.json({ success: true, message: '配置已保存' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 初始化世界（生成国家、设备等）
router.post('/initialize', (req, res) => {
  try {
    const sessionState = req.db.getSessionState();
    
    if (sessionState && sessionState.setup_completed) {
      return res.json({ 
        success: false, 
        error: '世界已经初始化过了',
        country_id: sessionState.current_country_id
      });
    }
    
    // 生成随机国家
    const countryData = req.fakerService.generateCountry();
    const countryResult = req.db.insert('countries', countryData);
    const countryId = countryResult.lastInsertRowid;
    
    // 生成初始设备
    const devices = req.fakerService.generateInitialDevices();
    for (const device of devices) {
      req.db.insert('devices', device);
    }
    
    // 生成第一封欢迎邮件
    const firstEmail = req.fakerService.generateFirstEmail(countryData.name);
    req.db.insert('emails', firstEmail);
    
    // 更新会话状态
    if (sessionState) {
      req.db.update('session_state', {
        current_country_id: countryId,
        setup_completed: 1,
        last_activity: new Date().toISOString()
      }, { id: 1 });
    } else {
      req.db.insert('session_state', {
        id: 1,
        current_country_id: countryId,
        setup_completed: 1
      });
    }
    
    res.json({
      success: true,
      message: '世界初始化完成',
      country: {
        id: countryId,
        name: countryData.name,
        government_type: countryData.government_type
      },
      devices_count: devices.length
    });
  } catch (error) {
    console.error('初始化失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 检查设置状态
router.get('/status', (req, res) => {
  try {
    const sessionState = req.db.getSessionState();
    const config = req.db.getApiConfig();
    
    res.json({
      success: true,
      setup_completed: sessionState ? sessionState.setup_completed : 0,
      api_configured: config && config.api_key && config.api_key !== 'your_api_key_here',
      country_id: sessionState ? sessionState.current_country_id : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

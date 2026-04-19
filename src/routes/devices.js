const express = require('express');
const router = express.Router();

// 获取所有设备状态
router.get('/', (req, res) => {
  try {
    const devices = req.db.getAllDevices();
    
    // 实时检测每个设备的故障状态
    const devicesWithStatus = devices.map(device => {
      const failureCheck = req.fakerService.checkDeviceFailure({
        name: device.name,
        failure_rate: device.failure_rate
      });
      
      return {
        ...device,
        metadata: device.metadata ? JSON.parse(device.metadata) : null,
        current_status: failureCheck.failed ? 'failed' : 'working',
        last_failure_message: failureCheck.message
      };
    });
    
    res.json({
      success: true,
      devices: devicesWithStatus,
      total_failures: devicesWithStatus.filter(d => d.current_status === 'failed').length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个设备详情
router.get('/:id', (req, res) => {
  try {
    const deviceId = req.params.id;
    const devices = req.db.select('devices', { id: deviceId }, 1);
    
    if (devices.length === 0) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }
    
    const device = devices[0];
    const failureCheck = req.fakerService.checkDeviceFailure({
      name: device.name,
      failure_rate: device.failure_rate
    });
    
    res.json({
      success: true,
      device: {
        ...device,
        metadata: device.metadata ? JSON.parse(device.metadata) : null,
        current_status: failureCheck.failed ? 'failed' : 'working',
        failure_message: failureCheck.message
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 尝试修复设备（成功率极低）
router.post('/:id/repair', (req, res) => {
  try {
    const deviceId = req.params.id;
    const devices = req.db.select('devices', { id: deviceId }, 1);
    
    if (devices.length === 0) {
      return res.status(404).json({ success: false, error: '设备不存在' });
    }
    
    const device = devices[0];
    const repairSuccess = Math.random() < 0.15; // 15% 成功率
    
    if (repairSuccess) {
      req.db.update('devices', {
        status: 'working',
        repair_count: (device.repair_count || 0) + 1,
        updated_at: new Date().toISOString()
      }, { id: deviceId });
      
      res.json({
        success: true,
        message: `奇迹！${device.name} 居然修好了！（但可能很快就会再坏）`,
        repaired: true
      });
    } else {
      req.db.update('devices', {
        repair_count: (device.repair_count || 0) + 1,
        updated_at: new Date().toISOString()
      }, { id: deviceId });
      
      const failureMessages = [
        '越修越坏了',
        '工具不够，只能凑合',
        '零件不匹配',
        '刚修好就又被雷劈了',
        '你确定你会修这个吗？'
      ];
      
      res.json({
        success: true,
        message: `修理失败：${failureMessages[Math.floor(Math.random() * failureMessages.length)]}`,
        repaired: false
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取设备统计
router.get('/stats/summary', (req, res) => {
  try {
    const devices = req.db.getAllDevices();
    const workingCount = devices.filter(d => d.status === 'working').length;
    const brokenCount = devices.length - workingCount;
    const avgFailureRate = devices.reduce((sum, d) => sum + (d.failure_rate || 0), 0) / devices.length;
    
    res.json({
      success: true,
      stats: {
        total: devices.length,
        working: workingCount,
        broken: brokenCount,
        average_failure_rate: avgFailureRate.toFixed(2),
        health_score: `${Math.round((1 - avgFailureRate) * 100)}%`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

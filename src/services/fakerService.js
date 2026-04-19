const { Faker } = require('@faker-js/faker');
const { faker } = require('@faker-js/faker/locale/zh_CN');

class FakerService {
  constructor() {
    this.faker = faker;
  }

  // 生成随机国家
  generateCountry() {
    const governmentTypes = [
      '混乱共和国',
      '临时军政府',
      '技术官僚联盟',
      '流亡政府',
      '自治领',
      '联合酋长国',
      '人民公社',
      '企业城邦'
    ];

    return {
      name: `${this.faker.location.country()} ${this._generateRandomSuffix()}`,
      description: this._generateCountryDescription(),
      population: Math.floor(Math.random() * 50000000) + 100000,
      gdp: Math.floor(Math.random() * 100000) * 1000000,
      government_type: governmentTypes[Math.floor(Math.random() * governmentTypes.length)],
      instability_factor: Math.random() * 0.8 + 0.2 // 0.2-1.0 的不稳定系数
    };
  }

  _generateRandomSuffix() {
    const suffixes = [
      '联邦',
      '联合',
      '特别自治区',
      '第零区',
      '废弃领',
      '重组带',
      '缓冲国',
      '实验区'
    ];
    return suffixes[Math.floor(Math.random() * suffixes.length)];
  }

  _generateCountryDescription() {
    const descriptions = [
      '一个由拼凑技术和老旧设备维持的国家，基础设施随时可能崩溃。',
      '在这里，昨天还能用的设备今天可能就成了一堆废铁。',
      '国民们习惯了在断网和停电中生活，技术代差是这个国家的常态。',
      '政府的决策常常被随机的系统故障打乱，但 somehow 它还在运转。',
      '这是一个荒诞但自洽的世界，每个人都在努力维持着脆弱的平衡。'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  // 动态生成角色（基于部门/触发词）
  generateCharacter(department, triggerContext = '') {
    const firstName = this.faker.person.firstName();
    const lastName = this.faker.person.lastName();
    const name = `${lastName}${firstName}`;

    const titles = this._getTitlesByDepartment(department);
    const title = titles[Math.floor(Math.random() * titles.length)];

    const personalities = [
      '偏执但专业',
      '疲惫但坚持',
      '愤世嫉俗',
      '过度乐观',
      '实用主义者',
      '理论派',
      '老油条'
    ];

    const technicalLevels = [
      '精通老旧系统维护',
      '擅长拼凑解决方案',
      '对现代技术一知半解',
      '能用 BASIC 解决一切问题',
      '相信胶带能修好任何东西'
    ];

    return {
      name,
      title,
      department,
      personality: personalities[Math.floor(Math.random() * personalities.length)],
      technical_knowledge: technicalLevels[Math.floor(Math.random() * technicalLevels.length)],
      email: `${this._slugify(name)}@${this._generateDomain()}`,
      phone: this._generateBrokenPhoneNumber(),
      metadata: JSON.stringify({
        trigger_context: triggerContext,
        availability: Math.random() > 0.5 ? 'online' : 'offline',
        mood: this._getCurrentMood()
      }),
      triggered_by: triggerContext || 'system_init'
    };
  }

  _getTitlesByDepartment(department) {
    const titleMap = {
      '财政部': ['财政部长', '预算主任', '税务专员', '资金调度员'],
      '国防部': ['国防部长', '战略指挥官', '边境巡逻队长'],
      '科技部': ['科技部长', '首席工程师', '系统维护员'],
      '外交部': ['外交部长', '国际联络官', '谈判代表'],
      '卫生部': ['卫生部长', '医疗协调员', '防疫专员'],
      '教育部': ['教育部长', '课程设计师', '远程教育专员'],
      '能源部': ['能源部长', '电网管理员', '太阳能板维护工'],
      '通信部': ['通信部长', '网络运维师', '调制解调器专家']
    };

    return titleMap[department] || ['特别顾问', '临时负责人', '项目协调员'];
  }

  _slugify(text) {
    return text.toLowerCase().replace(/\s+/g, '.');
  }

  _generateDomain() {
    const domains = [
      'gov.broken.net',
      'mail.falling.org',
      'post.glitch.state',
      'comms.decay.local',
      'net.ruined.internal'
    ];
    return domains[Math.floor(Math.random() * domains.length)];
  }

  _generateBrokenPhoneNumber() {
    const prefixes = ['+000', '+111', '+999', '+666', '+404'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
    return `${prefix}-${number}`;
  }

  _getCurrentMood() {
    const moods = [
      '焦虑',
      '疲惫',
      '专注',
      '烦躁',
      '麻木',
      '亢奋',
      '困惑'
    ];
    return moods[Math.floor(Math.random() * moods.length)];
  }

  // 生成初始设备列表（全部濒临崩溃）
  generateInitialDevices() {
    return [
      {
        name: '快烂掉的太阳能板',
        type: 'power_generation',
        status: 'broken',
        failure_rate: 0.85,
        metadata: JSON.stringify({
          efficiency: Math.floor(Math.random() * 30) + 10,
          last_maintenance: 'unknown',
          condition: 'critical'
        })
      },
      {
        name: '快坏掉的户外移动电源',
        type: 'power_storage',
        status: 'broken',
        failure_rate: 0.75,
        metadata: JSON.stringify({
          capacity: Math.floor(Math.random() * 20) + 5,
          charge_cycles: Math.floor(Math.random() * 1000) + 500,
          condition: 'poor'
        })
      },
      {
        name: 'Windows 3.1 电脑',
        type: 'computer',
        status: 'broken',
        failure_rate: 0.70,
        metadata: JSON.stringify({
          ram: '4MB',
          storage: '40MB',
          os_version: '3.1',
          boot_success_rate: 0.6
        })
      },
      {
        name: 'BASIC 电脑',
        type: 'computer',
        status: 'broken',
        failure_rate: 0.65,
        metadata: JSON.stringify({
          ram: '64KB',
          storage: 'cassette',
          language: 'BASIC v2.0',
          boot_success_rate: 0.7
        })
      },
      {
        name: '垃圾调制解调器',
        type: 'network',
        status: 'broken',
        failure_rate: 0.90,
        metadata: JSON.stringify({
          speed: '300 baud',
          connection_stability: 0.3,
          noise_level: 'high'
        })
      },
      {
        name: '垃圾电话',
        type: 'communication',
        status: 'broken',
        failure_rate: 0.80,
        metadata: JSON.stringify({
          clarity: 'poor',
          dropout_rate: 0.6,
          battery_status: 'unknown'
        })
      },
      {
        name: '垃圾插排',
        type: 'power_distribution',
        status: 'broken',
        failure_rate: 0.95,
        metadata: JSON.stringify({
          outlets_working: Math.floor(Math.random() * 3) + 1,
          surge_protection: false,
          spark_risk: 'high'
        })
      }
    ];
  }

  // 生成随机事件
  generateEvent(countryId) {
    const eventTypes = [
      {
        type: 'infrastructure_failure',
        title: '大规模停电',
        description: '主要供电线路故障，全国陷入黑暗。',
        impact: 'severe'
      },
      {
        type: 'network_outage',
        title: '网络中断',
        description: '国际出口带宽完全中断，只能使用本地网络。',
        impact: 'moderate'
      },
      {
        type: 'equipment_malfunction',
        title: '关键设备故障',
        description: '某重要部门的服务器突然蓝屏。',
        impact: 'minor'
      },
      {
        type: 'weather_event',
        title: '异常天气',
        description: '突如其来的沙尘暴影响了太阳能板效率。',
        impact: 'moderate'
      },
      {
        type: 'political_crisis',
        title: '政府危机',
        description: '某个部门的负责人突然失联。',
        impact: 'severe'
      }
    ];

    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    return {
      country_id: countryId,
      ...eventType,
      created_at: new Date().toISOString()
    };
  }

  // 生成内部讨论内容
  generateDiscussion(participants, topic) {
    const discussionTemplates = [
      `关于${topic}的紧急会议正在进行中...`,
      `各部门就${topic}展开激烈讨论`,
      `临时工作组正在商讨${topic}的应对方案`,
      `针对${topic}，各方意见分歧严重`
    ];

    const contentLines = [];
    for (const participant of participants.slice(0, Math.min(5, participants.length))) {
      const opinions = [
        `我认为我们应该优先考虑稳定性...`,
        `但是设备撑不了多久了！`,
        `有没有更便宜的替代方案？`,
        `上次这样搞差点让整个系统崩溃...`,
        `我同意，但我们没有选择了`,
        `让我查查手册...哦等等，手册也丢了`,
        `能不能用胶带先固定一下？`,
        `这个方案风险太大了`
      ];
      
      contentLines.push(
        `[${participant.name} - ${participant.title}]: ${opinions[Math.floor(Math.random() * opinions.length)]}`
      );
    }

    return {
      participants: JSON.stringify(participants.map(p => p.name)),
      topic,
      content: contentLines.join('\n'),
      summary: discussionTemplates[Math.floor(Math.random() * discussionTemplates.length)]
    };
  }

  // 生成第一封入站邮件
  generateFirstEmail(countryName) {
    const subjects = [
      '欢迎来到这个...独特的地方',
      '系统初始化完成',
      '来自临时政府的问候',
      '重要通知：设备状态报告',
      '你已被选为联络人'
    ];

    const bodies = [
      `你好，\n\n这里是${countryName}的临时通信中心。\n\n如果你收到这封邮件，说明我们的调制解调器还没完全坏掉——这真是个奇迹。\n\n我们这里的情况...比较复杂。所有设备都处于临界状态，但你似乎是我们唯一的对外联络希望。\n\n请通过此邮箱与我们保持联系。不要期待回复会很及时，毕竟 Everything is falling apart.\n\n祝好运，\n临时通信办公室`,
      
      `警告：这是一封自动生成的欢迎邮件\n\n检测到新的通信节点接入...\n\n当前系统状态：\n- 电力供应：不稳定\n- 网络连接：间歇性\n- 设备健康度：堪忧\n\n请确认您已阅读并理解本系统的运作方式。\n\n[此邮件可能在传输过程中丢失或损坏]`,
      
      `来自：${countryName} 协调委员会\n\n主题：初次接触协议\n\n根据第 404 号临时法令，您已被指定为外部联络人。\n\n您的职责包括：\n1. 接收和发送官方邮件\n2. 记录所有通信内容\n3. 在设备完全失效前尽可能传递更多信息\n\n这不是演习。\n\n end transmission`
    ];

    return {
      sender: 'system@gov.broken.net',
      recipient: 'player@external.net',
      subject: subjects[Math.floor(Math.random() * subjects.length)],
      body: bodies[Math.floor(Math.random() * bodies.length)],
      is_read: 0,
      is_player_sent: 0,
      metadata: JSON.stringify({
        email_type: 'welcome',
        priority: 'high',
        generated_at: new Date().toISOString()
      })
    };
  }

  // 模拟邮件延迟和丢包
  simulateNetworkCondition() {
    const delayMs = Math.floor(Math.random() * 5000) + 500; // 0.5-5.5 秒
    const isDropped = Math.random() < 0.15; // 15% 丢包率
    
    return {
      delay_ms: delayMs,
      is_dropped: isDropped,
      quality: isDropped ? 'lost' : (delayMs > 3000 ? 'poor' : 'fair')
    };
  }

  // 检测设备故障
  checkDeviceFailure(device) {
    const failureChance = device.failure_rate || 0.5;
    const willFail = Math.random() < failureChance;
    
    if (willFail) {
      return {
        failed: true,
        failure_type: this._getRandomFailureType(),
        message: this._getFailureMessage(device.name)
      };
    }
    
    return {
      failed: false,
      message: '设备运行正常（暂时）'
    };
  }

  _getRandomFailureType() {
    const types = [
      'power_failure',
      'connection_lost',
      'hardware_malfunction',
      'software_crash',
      'overheating',
      'physical_damage'
    ];
    return types[Math.floor(Math.random() * types.length)];
  }

  _getFailureMessage(deviceName) {
    const messages = [
      `${deviceName} 突然冒出一阵火花`,
      `${deviceName} 发出了不祥的嗡嗡声`,
      `${deviceName} 屏幕闪烁了几下后黑屏了`,
      `${deviceName} 开始冒出奇怪的气味`,
      `${deviceName} 毫无预兆地停止了工作`,
      `${deviceName} 显示了一堆乱码后死机了`,
      `${deviceName} 的连接线自己松掉了`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
}

module.exports = FakerService;

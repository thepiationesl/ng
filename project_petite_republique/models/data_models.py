"""
Project Petite République - 数据模型定义
包含国家状态、角色档案、事件日志、设备监控等数据结构
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid


@dataclass
class NationalProfile:
    """国家概况 - 长期稳定的基本信息"""
    country_name: str = "Koltu 共和国"
    geography: str = "多山、河流稀少、土壤贫瘠、地处偏远"
    population: int = 120000
    area_km2: int = 8500
    technology_level: str = "1990 年代初期水平，设备陈旧"
    main_resources: List[str] = field(default_factory=lambda: ["少量煤炭", "劣质铁矿", "低产水稻"])
    political_stability: float = 55.0  # 0-100
    economy_health: float = 35.0  # 0-100
    military_readiness: float = 25.0  # 0-100
    national_motto: str = "我们虽穷，但有骨气！"
    international_bandwidth_kbps: int = 64  # 国际带宽限制
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'NationalProfile':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class DeviceStatus:
    """设备状态监控 - 类似 NEZHA 探针"""
    device_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    device_name: str = "总统办公室电脑"
    device_type: str = "Windows 3.1 PC"  # Windows 3.1, BASIC 电脑，电话线等
    os_version: str = "Windows 3.1"
    cpu_usage: float = 0.0  # 0-100
    memory_usage: float = 0.0  # 0-100
    disk_usage: float = 0.0  # 0-100
    network_latency_ms: int = 0
    bandwidth_kbps: int = 64
    uptime_hours: float = 0.0
    last_seen: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    status: str = "online"  # online, offline, degraded
    issues: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DeviceStatus':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class CurrentState:
    """当前状态 - 实时可变的数据"""
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    food_stock_tons: float = 850.0
    electricity_generation_mw: float = 12.5
    foreign_currency_usd: float = 15000.0
    unemployment_rate: float = 32.0
    public_satisfaction: float = 42.0
    active_events: List[Dict[str, Any]] = field(default_factory=list)
    pending_decisions: List[Dict[str, Any]] = field(default_factory=list)
    internal_notifications: List[Dict[str, Any]] = field(default_factory=list)  # 内部通知，不一定会告诉玩家
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CurrentState':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Character:
    """人物档案 - AI 扮演的角色"""
    character_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = "李明"
    position: str = "总统秘书"
    personality: str = "谨慎、忠诚、善于周旋"
    loyalty_to_leader: float = 85.0  # 0-100
    current_mood: str = "平静"
    decision_style: str = "风险评估优先"
    communication_style: str = "正式但略带担忧"
    backstory: str = "在国家最困难时期加入政府，见证过多次危机"
    knowledge_level: str = "中等，了解基本政务但不精通技术"
    is_active: bool = True
    last_interaction: str = ""
    conversation_history: List[Dict[str, str]] = field(default_factory=list)  # 与玩家的对话历史
    internal_dialogue: List[Dict[str, str]] = field(default_factory=list)  # 内部思考/与其他 AI 的对话
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Character':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class EventLog:
    """事件日志 - 记录所有发生的事件"""
    log_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    event_type: str = "政策决策"  # policy, random, external, system
    initiator: str = "用户"  # user, ai, system, random
    title: str = ""
    content: str = ""
    outcome: str = ""
    severity: str = "low"  # low, medium, high, critical
    is_public: bool = True  # 是否公开给玩家
    affected_indices: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EventLog':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class InternalNotification:
    """内部通知 - 仅 AI 内部可见，不一定传达给玩家"""
    notification_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    source: str = ""  # 哪个 AI 或系统发出的
    target_roles: List[str] = field(default_factory=list)  # 目标角色列表
    title: str = ""
    content: str = ""
    priority: str = "normal"  # low, normal, high, urgent
    is_read: bool = False
    forwarded_to_player: bool = False  # 是否已转发给玩家
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'InternalNotification':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class SystemMonitor:
    """系统监控 - 局外人机器人维护数据"""
    monitor_id: str = "system_admin"
    last_check: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    total_users: int = 1
    active_ai_agents: int = 0
    opensearch_health: str = "unknown"  # green, yellow, red, unknown
    api_calls_today: int = 0
    failed_requests: int = 0
    retry_successes: int = 0
    average_response_time_ms: float = 0.0
    system_status: str = "operational"  # operational, degraded, maintenance
    maintenance_log: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SystemMonitor':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

"""
Project Petite République - OpenSearch 客户端
负责所有与 OpenSearch 的交互，包括索引管理、CRUD 操作等
支持模拟模式（当 OpenSearch 不可用时）
"""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import os

# 尝试导入 opensearch-py，如果失败则使用模拟模式
try:
    from opensearchpy import OpenSearch, RequestsHttpConnection
    OPENSEARCH_AVAILABLE = True
except ImportError:
    OPENSEARCH_AVAILABLE = False

from models.data_models import (
    NationalProfile, CurrentState, Character, 
    EventLog, InternalNotification, DeviceStatus, SystemMonitor
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OpenSearchClient:
    """OpenSearch 客户端封装"""
    
    # 索引名称
    INDEX_NATIONAL_PROFILE = "national_profile"
    INDEX_CURRENT_STATE = "current_state"
    INDEX_CHARACTERS = "characters"
    INDEX_EVENT_LOG = "events_log"
    INDEX_INTERNAL_NOTIFICATIONS = "internal_notifications"
    INDEX_DEVICE_STATUS = "device_status"
    INDEX_SYSTEM_MONITOR = "system_monitor"
    
    def __init__(self, host: str = None, port: int = None, use_ssl: bool = False, 
                 verify_certs: bool = False, mock_mode: bool = False):
        """
        初始化 OpenSearch 客户端
        
        Args:
            host: OpenSearch 主机地址
            port: OpenSearch 端口
            use_ssl: 是否使用 SSL
            verify_certs: 是否验证证书
            mock_mode: 是否使用模拟模式（不连接真实 OpenSearch）
        """
        self.mock_mode = mock_mode or not OPENSEARCH_AVAILABLE
        self.client = None
        self.in_memory_store = {}  # 模拟模式下的内存存储
        
        if not self.mock_mode:
            host = host or os.getenv("OPENSEARCH_HOST", "localhost")
            port = port or int(os.getenv("OPENSEARCH_PORT", "9200"))
            
            try:
                self.client = OpenSearch(
                    hosts=[{'host': host, 'port': port}],
                    http_auth=None,  # 可添加认证信息
                    use_ssl=use_ssl,
                    verify_certs=verify_certs,
                    connection_class=RequestsHttpConnection,
                    timeout=30
                )
                logger.info(f"Connected to OpenSearch at {host}:{port}")
            except Exception as e:
                logger.warning(f"Failed to connect to OpenSearch: {e}. Falling back to mock mode.")
                self.mock_mode = True
                self.client = None
        else:
            logger.info("Running in mock mode (no OpenSearch connection)")
        
        if not self.mock_mode:
            self._initialize_indices()
    
    def _get_index_mapping(self, index_name: str) -> Dict[str, Any]:
        """获取索引映射定义"""
        mappings = {
            self.INDEX_NATIONAL_PROFILE: {
                "properties": {
                    "country_name": {"type": "keyword"},
                    "geography": {"type": "text"},
                    "population": {"type": "integer"},
                    "technology_level": {"type": "keyword"},
                    "political_stability": {"type": "float"},
                    "economy_health": {"type": "float"},
                    "military_readiness": {"type": "float"},
                    "international_bandwidth_kbps": {"type": "integer"},
                    "created_at": {"type": "date"}
                }
            },
            self.INDEX_CURRENT_STATE: {
                "properties": {
                    "timestamp": {"type": "date"},
                    "food_stock_tons": {"type": "float"},
                    "electricity_generation_mw": {"type": "float"},
                    "foreign_currency_usd": {"type": "float"},
                    "unemployment_rate": {"type": "float"},
                    "public_satisfaction": {"type": "float"},
                    "active_events": {"type": "nested"},
                    "pending_decisions": {"type": "nested"},
                    "internal_notifications": {"type": "nested"}
                }
            },
            self.INDEX_CHARACTERS: {
                "properties": {
                    "character_id": {"type": "keyword"},
                    "name": {"type": "keyword"},
                    "position": {"type": "keyword"},
                    "personality": {"type": "text"},
                    "loyalty_to_leader": {"type": "float"},
                    "current_mood": {"type": "keyword"},
                    "decision_style": {"type": "keyword"},
                    "communication_style": {"type": "keyword"},
                    "backstory": {"type": "text"},
                    "is_active": {"type": "boolean"},
                    "conversation_history": {"type": "nested"},
                    "internal_dialogue": {"type": "nested"},
                    "created_at": {"type": "date"}
                }
            },
            self.INDEX_EVENT_LOG: {
                "properties": {
                    "log_id": {"type": "keyword"},
                    "timestamp": {"type": "date"},
                    "event_type": {"type": "keyword"},
                    "initiator": {"type": "keyword"},
                    "title": {"type": "text"},
                    "content": {"type": "text"},
                    "outcome": {"type": "text"},
                    "severity": {"type": "keyword"},
                    "is_public": {"type": "boolean"},
                    "affected_indices": {"type": "keyword"},
                    "metadata": {"type": "object"}
                }
            },
            self.INDEX_INTERNAL_NOTIFICATIONS: {
                "properties": {
                    "notification_id": {"type": "keyword"},
                    "timestamp": {"type": "date"},
                    "source": {"type": "keyword"},
                    "target_roles": {"type": "keyword"},
                    "title": {"type": "text"},
                    "content": {"type": "text"},
                    "priority": {"type": "keyword"},
                    "is_read": {"type": "boolean"},
                    "forwarded_to_player": {"type": "boolean"},
                    "metadata": {"type": "object"}
                }
            },
            self.INDEX_DEVICE_STATUS: {
                "properties": {
                    "device_id": {"type": "keyword"},
                    "device_name": {"type": "keyword"},
                    "device_type": {"type": "keyword"},
                    "os_version": {"type": "keyword"},
                    "cpu_usage": {"type": "float"},
                    "memory_usage": {"type": "float"},
                    "disk_usage": {"type": "float"},
                    "network_latency_ms": {"type": "integer"},
                    "bandwidth_kbps": {"type": "integer"},
                    "uptime_hours": {"type": "float"},
                    "last_seen": {"type": "date"},
                    "status": {"type": "keyword"},
                    "issues": {"type": "keyword"}
                }
            },
            self.INDEX_SYSTEM_MONITOR: {
                "properties": {
                    "monitor_id": {"type": "keyword"},
                    "last_check": {"type": "date"},
                    "total_users": {"type": "integer"},
                    "active_ai_agents": {"type": "integer"},
                    "opensearch_health": {"type": "keyword"},
                    "api_calls_today": {"type": "integer"},
                    "failed_requests": {"type": "integer"},
                    "retry_successes": {"type": "integer"},
                    "average_response_time_ms": {"type": "float"},
                    "system_status": {"type": "keyword"},
                    "maintenance_log": {"type": "nested"}
                }
            }
        }
        return mappings.get(index_name, {})
    
    def _initialize_indices(self):
        """初始化所有索引"""
        if self.mock_mode:
            return
        
        indices = [
            self.INDEX_NATIONAL_PROFILE,
            self.INDEX_CURRENT_STATE,
            self.INDEX_CHARACTERS,
            self.INDEX_EVENT_LOG,
            self.INDEX_INTERNAL_NOTIFICATIONS,
            self.INDEX_DEVICE_STATUS,
            self.INDEX_SYSTEM_MONITOR
        ]
        
        for index_name in indices:
            try:
                if not self.client.indices.exists(index=index_name):
                    mapping = self._get_index_mapping(index_name)
                    self.client.indices.create(
                        index=index_name,
                        body={"mappings": mapping} if mapping else {}
                    )
                    logger.info(f"Created index: {index_name}")
            except Exception as e:
                logger.error(f"Failed to create index {index_name}: {e}")
    
    def _mock_key(self, index: str, doc_id: str = "_doc") -> str:
        """生成模拟模式的存储键"""
        return f"{index}:{doc_id}"
    
    # ========== 通用 CRUD 操作 ==========
    
    def index_document(self, index: str, doc_id: str, body: Dict[str, Any]) -> bool:
        """索引文档"""
        try:
            if self.mock_mode:
                key = self._mock_key(index, doc_id)
                self.in_memory_store[key] = body
                logger.debug(f"[MOCK] Indexed document to {index}:{doc_id}")
                return True
            else:
                response = self.client.index(index=index, id=doc_id, body=body)
                return response.get('result') in ['created', 'updated']
        except Exception as e:
            logger.error(f"Failed to index document to {index}: {e}")
            return False
    
    def get_document(self, index: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """获取文档"""
        try:
            if self.mock_mode:
                key = self._mock_key(index, doc_id)
                return self.in_memory_store.get(key)
            else:
                response = self.client.get(index=index, id=doc_id)
                return response.get('_source')
        except Exception as e:
            logger.debug(f"Document not found in {index}:{doc_id} - {e}")
            return None
    
    def search_documents(self, index: str, query: Dict[str, Any] = None, 
                         size: int = 10) -> List[Dict[str, Any]]:
        """搜索文档"""
        try:
            if self.mock_mode:
                prefix = self._mock_key(index, "")
                results = []
                for key, value in self.in_memory_store.items():
                    if key.startswith(prefix):
                        if query is None:
                            results.append(value)
                        else:
                            # 简单的匹配逻辑
                            match = True
                            for k, v in query.items():
                                if value.get(k) != v:
                                    match = False
                                    break
                            if match:
                                results.append(value)
                return results[:size]
            else:
                search_query = query if query else {"query": {"match_all": {}}}
                response = self.client.search(index=index, body=search_query, size=size)
                return [hit['_source'] for hit in response['hits']['hits']]
        except Exception as e:
            logger.error(f"Search failed in {index}: {e}")
            return []
    
    def update_document(self, index: str, doc_id: str, updates: Dict[str, Any]) -> bool:
        """部分更新文档"""
        try:
            if self.mock_mode:
                key = self._mock_key(index, doc_id)
                if key in self.in_memory_store:
                    self.in_memory_store[key].update(updates)
                    logger.debug(f"[MOCK] Updated document in {index}:{doc_id}")
                    return True
                return False
            else:
                response = self.client.update(
                    index=index, 
                    id=doc_id, 
                    body={"doc": updates}
                )
                return response.get('result') == 'updated'
        except Exception as e:
            logger.error(f"Failed to update document in {index}: {e}")
            return False
    
    def delete_document(self, index: str, doc_id: str) -> bool:
        """删除文档"""
        try:
            if self.mock_mode:
                key = self._mock_key(index, doc_id)
                if key in self.in_memory_store:
                    del self.in_memory_store[key]
                    logger.debug(f"[MOCK] Deleted document from {index}:{doc_id}")
                    return True
                return False
            else:
                response = self.client.delete(index=index, id=doc_id)
                return response.get('result') == 'deleted'
        except Exception as e:
            logger.error(f"Failed to delete document from {index}: {e}")
            return False
    
    # ========== 特定领域操作方法 ==========
    
    # 国家概况
    def save_national_profile(self, profile: NationalProfile) -> bool:
        return self.index_document(self.INDEX_NATIONAL_PROFILE, "profile", profile.to_dict())
    
    def get_national_profile(self) -> Optional[NationalProfile]:
        data = self.get_document(self.INDEX_NATIONAL_PROFILE, "profile")
        return NationalProfile.from_dict(data) if data else None
    
    # 当前状态
    def save_current_state(self, state: CurrentState) -> bool:
        return self.index_document(self.INDEX_CURRENT_STATE, "current", state.to_dict())
    
    def get_current_state(self) -> Optional[CurrentState]:
        data = self.get_document(self.INDEX_CURRENT_STATE, "current")
        return CurrentState.from_dict(data) if data else None
    
    def update_current_state(self, updates: Dict[str, Any]) -> bool:
        return self.update_document(self.INDEX_CURRENT_STATE, "current", updates)
    
    # 角色管理
    def save_character(self, character: Character) -> bool:
        return self.index_document(self.INDEX_CHARACTERS, character.character_id, character.to_dict())
    
    def get_character(self, character_id: str) -> Optional[Character]:
        data = self.get_document(self.INDEX_CHARACTERS, character_id)
        return Character.from_dict(data) if data else None
    
    def get_all_characters(self) -> List[Character]:
        docs = self.search_documents(self.INDEX_CHARACTERS, size=100)
        return [Character.from_dict(doc) for doc in docs]
    
    def get_active_characters(self) -> List[Character]:
        chars = self.get_all_characters()
        return [c for c in chars if c.is_active]
    
    def update_character(self, character_id: str, updates: Dict[str, Any]) -> bool:
        return self.update_document(self.INDEX_CHARACTERS, character_id, updates)
    
    # 事件日志
    def log_event(self, event: EventLog) -> bool:
        return self.index_document(self.INDEX_EVENT_LOG, event.log_id, event.to_dict())
    
    def get_public_events(self, limit: int = 50) -> List[EventLog]:
        docs = self.search_documents(self.INDEX_EVENT_LOG, size=limit)
        public_docs = [d for d in docs if d.get('is_public', True)]
        return [EventLog.from_dict(doc) for doc in public_docs]
    
    def get_all_events(self, limit: int = 100) -> List[EventLog]:
        docs = self.search_documents(self.INDEX_EVENT_LOG, size=limit)
        return [EventLog.from_dict(doc) for doc in docs]
    
    # 内部通知
    def save_notification(self, notification: InternalNotification) -> bool:
        return self.index_document(
            self.INDEX_INTERNAL_NOTIFICATIONS, 
            notification.notification_id, 
            notification.to_dict()
        )
    
    def get_unread_notifications(self, role: str = None) -> List[InternalNotification]:
        docs = self.search_documents(self.INDEX_INTERNAL_NOTIFICATIONS, size=100)
        notifications = [InternalNotification.from_dict(d) for d in docs]
        
        if role:
            notifications = [n for n in notifications if role in n.target_roles and not n.is_read]
        else:
            notifications = [n for n in notifications if not n.is_read]
        
        return notifications
    
    def mark_notification_read(self, notification_id: str) -> bool:
        return self.update_document(self.INDEX_INTERNAL_NOTIFICATIONS, notification_id, {"is_read": True})
    
    # 设备状态
    def save_device_status(self, device: DeviceStatus) -> bool:
        return self.index_document(self.INDEX_DEVICE_STATUS, device.device_id, device.to_dict())
    
    def get_all_devices(self) -> List[DeviceStatus]:
        docs = self.search_documents(self.INDEX_DEVICE_STATUS, size=50)
        return [DeviceStatus.from_dict(doc) for doc in docs]
    
    def update_device_status(self, device_id: str, updates: Dict[str, Any]) -> bool:
        return self.update_document(self.INDEX_DEVICE_STATUS, device_id, updates)
    
    # 系统监控
    def save_system_monitor(self, monitor: SystemMonitor) -> bool:
        return self.index_document(self.INDEX_SYSTEM_MONITOR, monitor.monitor_id, monitor.to_dict())
    
    def get_system_monitor(self) -> Optional[SystemMonitor]:
        data = self.get_document(self.INDEX_SYSTEM_MONITOR, "system_admin")
        return SystemMonitor.from_dict(data) if data else None
    
    def initialize_default_data(self):
        """初始化默认数据"""
        # 默认国家概况
        if not self.get_national_profile():
            profile = NationalProfile()
            self.save_national_profile(profile)
            logger.info("Initialized default national profile")
        
        # 默认当前状态
        if not self.get_current_state():
            state = CurrentState()
            self.save_current_state(state)
            logger.info("Initialized default current state")
        
        # 默认角色 - 总统秘书
        characters = self.get_all_characters()
        if not characters:
            secretary = Character(
                name="李明",
                position="总统秘书",
                personality="谨慎、忠诚、善于周旋",
                backstory="在国家最困难时期加入政府，已经服务了三任总统。擅长在各方势力之间周旋，确保政令畅通。",
                communication_style="正式但略带担忧，经常使用委婉语"
            )
            self.save_character(secretary)
            
            president = Character(
                name="Artu",
                position="总统",
                personality="固执、爱国、技术小白",
                backstory="Koltu 共和国的现任总统，对国家充满热情但技术水平有限。使用一台破旧的 Windows 3.1 电脑。",
                communication_style="简短、直接，偶尔出现拼写错误",
                knowledge_level="低，对现代技术不了解"
            )
            self.save_character(president)
            
            logger.info("Initialized default characters")
        
        # 默认设备状态
        devices = self.get_all_devices()
        if not devices:
            device = DeviceStatus(
                device_name="总统办公室电脑",
                device_type="Windows 3.1 PC",
                os_version="Windows 3.1",
                bandwidth_kbps=64,
                network_latency_ms=850,
                status="degraded",
                issues=["电话线老化", "内存不足", "硬盘坏道"]
            )
            self.save_device_status(device)
            logger.info("Initialized default device status")
        
        # 默认系统监控
        if not self.get_system_monitor():
            monitor = SystemMonitor()
            self.save_system_monitor(monitor)
            logger.info("Initialized default system monitor")

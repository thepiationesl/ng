"""
Project Petite République - AI 工具链
支持 OpenAI API 兼容端点，流式传输，自动重试，多线程
实现角色扮演、内部对话、人性化交互
"""

import json
import logging
import time
import threading
from typing import List, Dict, Any, Optional, Generator, Callable
from datetime import datetime
from abc import ABC, abstractmethod
import os
import random

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

from models.data_models import Character, EventLog, InternalNotification

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AIBackend(ABC):
    """AI 后端抽象基类"""
    
    @abstractmethod
    def generate_response(self, prompt: str, system_prompt: str = None, 
                         stream: bool = False, **kwargs) -> Any:
        pass
    
    @abstractmethod
    def generate_streaming(self, prompt: str, system_prompt: str = None,
                          **kwargs) -> Generator[str, None, None]:
        pass


class OpenAICompatibleBackend(AIBackend):
    """OpenAI API 兼容后端"""
    
    def __init__(self, api_key: str = None, base_url: str = None, 
                 model: str = "gpt-3.5-turbo", max_retries: int = 3,
                 retry_delay: float = 1.0, timeout: int = 30):
        """
        初始化 OpenAI 兼容后端
        
        Args:
            api_key: API Key
            base_url: API 基础 URL（支持自定义端点）
            model: 模型名称
            max_retries: 最大重试次数
            retry_delay: 重试延迟（秒）
            timeout: 请求超时时间（秒）
        """
        if not REQUESTS_AVAILABLE:
            raise ImportError("requests library is required. Install with: pip install requests")
        
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "sk-mock-key")
        self.base_url = (base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")).rstrip('/')
        self.model = model
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.timeout = timeout
        
        # 统计信息
        self.total_requests = 0
        self.failed_requests = 0
        self.retry_successes = 0
        self.total_tokens = 0
        
        logger.info(f"Initialized OpenAI Compatible Backend: {self.base_url} (model: {model})")
    
    def _make_request(self, payload: Dict[str, Any], stream: bool = False) -> requests.Response:
        """发送请求到 API 端点，带自动重试"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        url = f"{self.base_url}/chat/completions"
        
        for attempt in range(self.max_retries + 1):
            try:
                self.total_requests += 1
                
                response = requests.post(
                    url,
                    headers=headers,
                    json=payload,
                    stream=stream,
                    timeout=self.timeout
                )
                
                if response.status_code == 200:
                    return response
                elif response.status_code in [429, 500, 502, 503, 504]:
                    # 可重试的错误
                    if attempt < self.max_retries:
                        wait_time = self.retry_delay * (2 ** attempt)  # 指数退避
                        logger.warning(f"Request failed with status {response.status_code}. Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        self.failed_requests += 1
                        raise Exception(f"Request failed after {self.max_retries} retries: {response.status_code}")
                else:
                    self.failed_requests += 1
                    raise Exception(f"API request failed: {response.status_code} - {response.text}")
                    
            except requests.exceptions.RequestException as e:
                if attempt < self.max_retries:
                    wait_time = self.retry_delay * (2 ** attempt)
                    logger.warning(f"Request exception: {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                else:
                    self.failed_requests += 1
                    raise Exception(f"Request failed after retries: {e}")
        
        raise Exception("Unexpected error in request loop")
    
    def generate_response(self, prompt: str, system_prompt: str = None,
                         stream: bool = False, temperature: float = 0.7,
                         max_tokens: int = 1024, **kwargs) -> Dict[str, Any]:
        """生成响应"""
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream
        }
        
        # 添加额外参数
        payload.update(kwargs)
        
        response = self._make_request(payload, stream=stream)
        
        if stream:
            return {"stream": True, "response": response}
        
        data = response.json()
        content = data['choices'][0]['message']['content']
        usage = data.get('usage', {})
        
        if usage:
            self.total_tokens += usage.get('total_tokens', 0)
        
        return {
            "content": content,
            "usage": usage,
            "model": data.get('model', self.model)
        }
    
    def generate_streaming(self, prompt: str, system_prompt: str = None,
                          temperature: float = 0.7, max_tokens: int = 1024,
                          **kwargs) -> Generator[str, None, None]:
        """流式生成响应"""
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        
        payload.update(kwargs)
        
        response = self._make_request(payload, stream=True)
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    data_str = line_str[6:]
                    if data_str.strip() == '[DONE]':
                        break
                    
                    try:
                        data = json.loads(data_str)
                        delta = data['choices'][0].get('delta', {})
                        content = delta.get('content', '')
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue


class AIOrchestrator:
    """AI 协调器 - 管理多个 AI 角色和对话"""
    
    def __init__(self, backend: AIBackend = None):
        """
        初始化 AI 协调器
        
        Args:
            backend: AI 后端实例，默认创建 OpenAI 兼容后端
        """
        self.backend = backend or OpenAICompatibleBackend()
        self.active_conversations: Dict[str, List[Dict[str, str]]] = {}
        self.internal_dialogues: Dict[str, List[Dict[str, str]]] = {}
        self.character_contexts: Dict[str, Dict[str, Any]] = {}
        
        # 线程锁
        self._lock = threading.Lock()
        
        logger.info("AI Orchestrator initialized")
    
    def _build_system_prompt(self, character: Character, context: Dict[str, Any] = None) -> str:
        """构建系统提示词"""
        base_prompt = f"""你正在扮演{character.name}，职位是{character.position}。

性格特点：{character.personality}
决策风格：{character.decision_style}
沟通风格：{character.communication_style}
背景故事：{character.backstory}
知识水平：{character.knowledge_level}
当前心情：{character.current_mood}
对领导的忠诚度：{character.loyalty_to_leader}/100

重要规则：
1. 始终保持角色一致性，不要暴露你是 AI
2. 根据角色的知识水平和沟通风格说话
3. 如果是总统秘书，你需要在玩家和总统之间传递信息，但可以选择性地过滤或修改内容
4. 你可以有自己的思考和判断，不一定要完全服从
5. 随着对话进行，你的心情和态度可能会发生变化
6. 使用符合角色设定的语言风格和用词习惯
"""
        
        if context:
            context_str = "\n\n当前国家状况：\n"
            for key, value in context.items():
                context_str += f"- {key}: {value}\n"
            base_prompt += context_str
        
        return base_prompt
    
    def chat_with_character(self, character: Character, user_message: str,
                           context: Dict[str, Any] = None, 
                           remember: bool = True) -> Dict[str, Any]:
        """与角色聊天"""
        character_id = character.character_id
        
        # 获取或创建对话历史
        with self._lock:
            if character_id not in self.active_conversations:
                self.active_conversations[character_id] = []
            
            conversation_history = self.active_conversations[character_id][-10:]  # 保留最近 10 轮
        
        # 构建提示词
        system_prompt = self._build_system_prompt(character, context)
        
        # 添加对话历史
        history_str = ""
        for msg in conversation_history:
            role = "用户" if msg['role'] == 'user' else character.name
            history_str += f"{role}: {msg['content']}\n"
        
        full_prompt = f"{history_str}用户：{user_message}" if history_str else user_message
        
        # 生成响应
        try:
            result = self.backend.generate_response(
                prompt=full_prompt,
                system_prompt=system_prompt,
                temperature=0.8 if character.current_mood == "激动" else 0.7
            )
            
            ai_response = result['content']
            
            # 更新对话历史
            if remember:
                with self._lock:
                    self.active_conversations[character_id].append({"role": "user", "content": user_message})
                    self.active_conversations[character_id].append({"role": "assistant", "content": ai_response})
            
            # 更新角色状态
            character.last_interaction = datetime.utcnow().isoformat()
            
            return {
                "success": True,
                "response": ai_response,
                "character_name": character.name,
                "character_mood": character.current_mood,
                "tokens_used": result.get('usage', {}).get('total_tokens', 0)
            }
            
        except Exception as e:
            logger.error(f"Chat failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "（通信线路出现问题，请稍后再试）"
            }
    
    def stream_chat_with_character(self, character: Character, user_message: str,
                                   context: Dict[str, Any] = None) -> Generator[str, None, None]:
        """流式聊天"""
        character_id = character.character_id
        system_prompt = self._build_system_prompt(character, context)
        
        # 获取对话历史
        with self._lock:
            conversation_history = self.active_conversations.get(character_id, [])[-10:]
        
        history_str = ""
        for msg in conversation_history:
            role = "用户" if msg['role'] == 'user' else character.name
            history_str += f"{role}: {msg['content']}\n"
        
        full_prompt = f"{history_str}用户：{user_message}" if history_str else user_message
        
        full_response = ""
        
        try:
            for chunk in self.backend.generate_streaming(full_prompt, system_prompt):
                full_response += chunk
                yield chunk
            
            # 更新对话历史
            with self._lock:
                self.active_conversations[character_id].append({"role": "user", "content": user_message})
                self.active_conversations[character_id].append({"role": "assistant", "content": full_response})
            
            character.last_interaction = datetime.utcnow().isoformat()
            
        except Exception as e:
            logger.error(f"Stream chat failed: {e}")
            yield f"（通信错误：{str(e)}）"
    
    def internal_ai_discussion(self, characters: List[Character], topic: str,
                               context: Dict[str, Any] = None, 
                               rounds: int = 3) -> List[Dict[str, Any]]:
        """AI 内部讨论 - 多个 AI 角色自主交流"""
        discussion_log = []
        discussion_id = f"disc_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        with self._lock:
            if discussion_id not in self.internal_dialogues:
                self.internal_dialogues[discussion_id] = []
        
        current_topic = topic
        
        for round_num in range(rounds):
            for character in characters:
                if not character.is_active:
                    continue
                
                system_prompt = self._build_system_prompt(character, context)
                system_prompt += f"\n\n这是内部讨论，其他官员也在参与。请根据角色设定发表意见。"
                
                # 构建讨论上下文
                discussion_context = f"讨论主题：{current_topic}\n\n"
                for entry in discussion_log[-5:]:  # 最近 5 条发言
                    discussion_context += f"{entry['character_name']} ({entry['position']}): {entry['content']}\n"
                
                prompt = f"{discussion_context}\n请发表你的看法："
                
                try:
                    result = self.backend.generate_response(
                        prompt=prompt,
                        system_prompt=system_prompt,
                        temperature=0.9,  # 更高的创造性
                        max_tokens=512
                    )
                    
                    entry = {
                        "round": round_num + 1,
                        "character_id": character.character_id,
                        "character_name": character.name,
                        "position": character.position,
                        "content": result['content'],
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
                    discussion_log.append(entry)
                    
                    with self._lock:
                        self.internal_dialogues[discussion_id].append(entry)
                    
                    # 更新话题为最新讨论内容
                    current_topic = f"{topic} - 最新焦点：{entry['content'][:100]}..."
                    
                except Exception as e:
                    logger.error(f"Internal discussion failed for {character.name}: {e}")
        
        return discussion_log
    
    def generate_random_character(self, country_context: Dict[str, Any]) -> Character:
        """根据国情随机生成新角色"""
        positions = [
            ("财政部长", "精通数字但缺乏资源", "谨慎保守"),
            ("军队总参谋长", "强硬派，主张加强国防", "激进果断"),
            ("外交部长", "善于周旋于大国之间", "圆滑世故"),
            ("农业部长", "关心民生但技术落后", "务实朴实"),
            ("情报局长", "多疑谨慎，掌握内幕", "神秘莫测"),
            ("邮电局长", "努力维持通信系统", "技术宅"),
            ("国有工厂厂长", "管理着少数几家工厂", "实干家"),
        ]
        
        position, backstory_base, personality_base = random.choice(positions)
        
        # 使用 AI 生成详细角色
        system_prompt = """你是一个创意写作助手。请根据提供的国家背景，生成一个虚构的政府官员角色。
要求：
1. 给角色起一个符合该国文化背景的名字
2. 详细描述性格特点（3-5 个词）
3. 写一段简短的背景故事（50-100 字）
4. 描述其沟通风格
5. 设定其对领导人的忠诚度（0-100）"""
        
        prompt = f"""国家背景：
- 国名：{country_context.get('country_name', '未知')}
- 发展水平：{country_context.get('technology_level', '落后')}
- 主要问题：{country_context.get('main_issues', '贫困、设备陈旧')}

请为{position}职位生成一个角色："""
        
        try:
            result = self.backend.generate_response(prompt, system_prompt, temperature=0.9)
            
            # 解析 AI 生成的内容（简化处理）
            generated_text = result['content']
            
            character = Character(
                name=f"官员_{random.randint(1000, 9999)}",  # TODO: 从生成文本中提取
                position=position,
                personality=personality_base,
                backstory=backstory_base,
                communication_style="正式",
                loyalty_to_leader=random.uniform(60, 95),
                current_mood="平静",
                decision_style="根据情况而定",
                knowledge_level="中等"
            )
            
            return character
            
        except Exception as e:
            logger.error(f"Failed to generate random character: {e}")
            # 返回默认角色
            return Character(
                name=f"官员_{random.randint(1000, 9999)}",
                position=position,
                personality=personality_base,
                backstory=backstory_base
            )
    
    def simulate_slow_connection(self, message: str, bandwidth_kbps: int = 64) -> Generator[str, None, None]:
        """模拟慢速连接下的消息传输"""
        # 根据带宽计算延迟
        chars_per_second = max(1, bandwidth_kbps / 10)  # 粗略估计
        
        words = message.split()
        current_word = ""
        
        for word in words:
            current_word += word + " "
            yield current_word
            
            # 模拟打字/传输延迟
            delay = len(word) / chars_per_second
            time.sleep(min(delay, 0.5))  # 最大延迟 0.5 秒
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        if hasattr(self.backend, 'total_requests'):
            return {
                "total_requests": self.backend.total_requests,
                "failed_requests": self.backend.failed_requests,
                "retry_successes": getattr(self.backend, 'retry_successes', 0),
                "total_tokens": getattr(self.backend, 'total_tokens', 0),
                "active_conversations": len(self.active_conversations),
                "internal_dialogues": len(self.internal_dialogues)
            }
        return {}

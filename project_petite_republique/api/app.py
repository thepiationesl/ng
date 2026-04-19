"""
Project Petite République - Flask Web API
提供 RESTful API 和 Web 界面
支持流式传输、邮件系统、设备监控、事件通知
"""

from flask import Flask, request, jsonify, Response, render_template, send_from_directory
from flask_cors import CORS
import json
import logging
import threading
import time
from typing import Dict, Any, Optional
from datetime import datetime
import os
import random

from models.data_models import (
    NationalProfile, CurrentState, Character, EventLog,
    InternalNotification, DeviceStatus, SystemMonitor
)
from core.opensearch_client import OpenSearchClient
from core.ai_toolchain import AIOrchestrator, OpenAICompatibleBackend

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# 全局实例
db = None
ai_orchestrator = None


def init_app():
    """初始化应用"""
    global db, ai_orchestrator
    
    # 初始化 OpenSearch 客户端
    mock_mode = os.getenv("MOCK_MODE", "true").lower() == "true"
    db = OpenSearchClient(mock_mode=mock_mode)
    db.initialize_default_data()
    
    # 初始化 AI 协调器
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    model = os.getenv("AI_MODEL", "gpt-3.5-turbo")
    
    backend = OpenAICompatibleBackend(
        api_key=api_key,
        base_url=base_url,
        model=model,
        max_retries=3
    )
    
    ai_orchestrator = AIOrchestrator(backend)
    
    logger.info("Application initialized")


# ========== Web 页面路由 ==========

@app.route('/')
def index():
    """主页"""
    return render_template('index.html')


@app.route('/dashboard')
def dashboard():
    """仪表盘 - 显示国家状态和设备监控"""
    return render_template('dashboard.html')


@app.route('/mail')
def mail_system():
    """邮件系统界面"""
    return render_template('mail.html')


@app.route('/events')
def events_page():
    """事件日志页面"""
    return render_template('events.html')


@app.route('/characters')
def characters_page():
    """角色管理页面"""
    return render_template('characters.html')


@app.route('/settings')
def settings_page():
    """系统设置页面"""
    return render_template('settings.html')


# ========== API 路由 ==========

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取国家当前状态"""
    try:
        state = db.get_current_state()
        profile = db.get_national_profile()
        devices = db.get_all_devices()
        
        return jsonify({
            "success": True,
            "state": state.to_dict() if state else {},
            "profile": profile.to_dict() if profile else {},
            "devices": [d.to_dict() for d in devices]
        })
    except Exception as e:
        logger.error(f"Get status failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """与角色聊天（通过秘书）"""
    try:
        data = request.json
        message = data.get('message', '')
        character_id = data.get('character_id')  # 可选，默认使用秘书
        
        if not message:
            return jsonify({"success": False, "error": "消息不能为空"}), 400
        
        # 获取角色
        if character_id:
            character = db.get_character(character_id)
        else:
            # 默认使用秘书
            characters = db.get_active_characters()
            character = next((c for c in characters if c.position == "总统秘书"), characters[0] if characters else None)
        
        if not character:
            return jsonify({"success": False, "error": "角色不存在"}), 404
        
        # 获取上下文
        state = db.get_current_state()
        profile = db.get_national_profile()
        context = {
            "国家名称": profile.country_name if profile else "未知",
            "经济状况": f"{state.economy_health if state else 0}/100",
            "民众满意度": f"{state.public_satisfaction if state else 0}/100",
            "粮食储备": f"{state.food_stock_tons if state else 0}吨",
            "国际带宽": f"{profile.international_bandwidth_kbps if profile else 64}kbps"
        }
        
        # 与 AI 聊天
        result = ai_orchestrator.chat_with_character(
            character=character,
            user_message=message,
            context=context
        )
        
        # 更新角色状态到数据库
        db.update_character(character.character_id, {
            "last_interaction": character.last_interaction,
            "current_mood": character.current_mood
        })
        
        # 记录对话到数据库
        if result['success']:
            conv_history = ai_orchestrator.active_conversations.get(character.character_id, [])[-2:]
            db.update_character(character.character_id, {
                "conversation_history": conv_history
            })
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    """流式聊天"""
    try:
        data = request.json
        message = data.get('message', '')
        character_id = data.get('character_id')
        
        if not message:
            return jsonify({"success": False, "error": "消息不能为空"}), 400
        
        # 获取角色
        if character_id:
            character = db.get_character(character_id)
        else:
            characters = db.get_active_characters()
            character = next((c for c in characters if c.position == "总统秘书"), characters[0] if characters else None)
        
        if not character:
            return jsonify({"success": False, "error": "角色不存在"}), 404
        
        # 获取上下文
        state = db.get_current_state()
        profile = db.get_national_profile()
        context = {
            "国家名称": profile.country_name if profile else "未知",
            "经济状况": f"{state.economy_health if state else 0}/100",
            "民众满意度": f"{state.public_satisfaction if state else 0}/100"
        }
        
        def generate():
            for chunk in ai_orchestrator.stream_chat_with_character(character, message, context):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        
        return Response(generate(), mimetype='text/event-stream')
        
    except Exception as e:
        logger.error(f"Stream chat failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/mail/send', methods=['POST'])
def send_mail():
    """发送邮件（给总统或其他角色）"""
    try:
        data = request.json
        recipient = data.get('recipient', 'president')  # president, secretary, etc.
        subject = data.get('subject', '')
        content = data.get('content', '')
        
        if not content:
            return jsonify({"success": False, "error": "邮件内容不能为空"}), 400
        
        # 获取收件人角色
        characters = db.get_active_characters()
        recipient_char = next((c for c in characters if c.name.lower() == recipient.lower() 
                               or c.position.lower() == recipient.lower()), None)
        
        if not recipient_char:
            # 默认发送给总统
            recipient_char = next((c for c in characters if c.position == "总统"), None)
        
        if not recipient_char:
            return jsonify({"success": False, "error": "收件人不存在"}), 404
        
        # 创建内部通知
        notification = InternalNotification(
            source="user",
            target_roles=[recipient_char.position],
            title=subject or "新邮件",
            content=content,
            priority="normal",
            forwarded_to_player=False
        )
        db.save_notification(notification)
        
        # 让秘书处理邮件
        secretary = next((c for c in characters if c.position == "总统秘书"), None)
        if secretary:
            context = {"发件人": "外部联系人", "邮件主题": subject, "邮件内容": content}
            
            # AI 生成回复
            result = ai_orchestrator.chat_with_character(
                character=secretary,
                user_message=f"收到一封新邮件，主题是'{subject}'，内容是：{content}。请处理这封邮件并决定是否需要转交给总统，或者如何回复。",
                context=context
            )
            
            # 记录事件
            event = EventLog(
                event_type="external",
                initiator="user",
                title=f"收到邮件：{subject}",
                content=content,
                outcome=result.get('response', '已处理'),
                severity="low",
                is_public=True
            )
            db.log_event(event)
        
        return jsonify({
            "success": True,
            "message": "邮件已发送",
            "notification_id": notification.notification_id
        })
        
    except Exception as e:
        logger.error(f"Send mail failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/mail/inbox', methods=['GET'])
def get_inbox():
    """获取收件箱"""
    try:
        notifications = db.get_unread_notifications()
        
        return jsonify({
            "success": True,
            "emails": [n.to_dict() for n in notifications]
        })
    except Exception as e:
        logger.error(f"Get inbox failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/events', methods=['GET'])
def get_events():
    """获取事件日志"""
    try:
        limit = request.args.get('limit', 50, type=int)
        public_only = request.args.get('public', 'true').lower() == 'true'
        
        if public_only:
            events = db.get_public_events(limit)
        else:
            events = db.get_all_events(limit)
        
        return jsonify({
            "success": True,
            "events": [e.to_dict() for e in events]
        })
    except Exception as e:
        logger.error(f"Get events failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/events/random', methods=['POST'])
def generate_random_event():
    """随机生成事件"""
    try:
        event_types = [
            ("自然灾害", "干旱导致农业减产", "high"),
            ("外交事件", "邻国提出贸易要求", "medium"),
            ("内部动荡", "民众抗议物价上涨", "high"),
            ("技术故障", "通信线路中断", "medium"),
            ("经济危机", "外汇储备急剧下降", "critical"),
            ("好消息", "获得国际援助", "low"),
            ("设备老化", "总统电脑蓝屏", "low"),
        ]
        
        event_type, description, severity = random.choice(event_types)
        
        # 使用 AI 生成详细事件描述
        state = db.get_current_state()
        profile = db.get_national_profile()
        
        system_prompt = "你是一个叙事助手。请根据提供的国家状况，生成一个简短的事件描述（50-100 字）。"
        prompt = f"""国家：{profile.country_name if profile else '未知'}
当前状况：经济{state.economy_health if state else 0}/100，满意度{state.public_satisfaction if state else 0}/100
事件类型：{event_type}
事件概述：{description}

请详细描述这个事件："""
        
        result = ai_orchestrator.backend.generate_response(prompt, system_prompt, temperature=0.8)
        
        event = EventLog(
            event_type="random",
            initiator="system",
            title=event_type,
            content=result['content'],
            outcome="待处理",
            severity=severity,
            is_public=True,
            metadata={"auto_generated": True}
        )
        db.log_event(event)
        
        # 更新国家状态（根据事件严重程度）
        if state:
            updates = {}
            if severity == "critical":
                updates['public_satisfaction'] = max(0, state.public_satisfaction - 10)
                updates['economy_health'] = max(0, state.economy_health - 5)
            elif severity == "high":
                updates['public_satisfaction'] = max(0, state.public_satisfaction - 5)
            elif severity == "low":
                updates['public_satisfaction'] = min(100, state.public_satisfaction + 3)
            
            if updates:
                db.update_current_state(updates)
        
        return jsonify({
            "success": True,
            "event": event.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Generate random event failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/devices', methods=['GET'])
def get_devices():
    """获取设备状态（类似 NEZHA 探针）"""
    try:
        devices = db.get_all_devices()
        
        # 模拟实时更新
        for device in devices:
            device.cpu_usage = random.uniform(10, 80)
            device.memory_usage = random.uniform(30, 90)
            device.network_latency_ms = random.randint(500, 2000)  # 高延迟
            device.last_seen = datetime.utcnow().isoformat()
            
            # 随机生成问题
            if random.random() < 0.3:
                device.status = "degraded"
                device.issues = random.sample(["电话线老化", "内存不足", "硬盘坏道", "网络拥塞", "电力不稳"], k=random.randint(1, 3))
            else:
                device.status = "online"
                device.issues = []
            
            db.update_device_status(device.device_id, device.to_dict())
        
        return jsonify({
            "success": True,
            "devices": [d.to_dict() for d in devices]
        })
    except Exception as e:
        logger.error(f"Get devices failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/characters', methods=['GET'])
def get_characters():
    """获取所有角色"""
    try:
        characters = db.get_all_characters()
        
        return jsonify({
            "success": True,
            "characters": [c.to_dict() for c in characters]
        })
    except Exception as e:
        logger.error(f"Get characters failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/characters/generate', methods=['POST'])
def generate_character():
    """随机生成新角色"""
    try:
        profile = db.get_national_profile()
        context = profile.to_dict() if profile else {}
        
        character = ai_orchestrator.generate_random_character(context)
        db.save_character(character)
        
        # 记录事件
        event = EventLog(
            event_type="system",
            initiator="ai",
            title="新角色加入",
            content=f"{character.name} 担任 {character.position}",
            outcome="已任命",
            severity="low",
            is_public=True
        )
        db.log_event(event)
        
        return jsonify({
            "success": True,
            "character": character.to_dict()
        })
    except Exception as e:
        logger.error(f"Generate character failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/internal/discuss', methods=['POST'])
def internal_discussion():
    """触发 AI 内部讨论"""
    try:
        data = request.json
        topic = data.get('topic', '国家发展')
        rounds = data.get('rounds', 2)
        
        characters = db.get_active_characters()
        if len(characters) < 2:
            return jsonify({"success": False, "error": "需要至少两个活跃角色"}), 400
        
        state = db.get_current_state()
        profile = db.get_national_profile()
        context = {
            "国家名称": profile.country_name if profile else "未知",
            "经济状况": state.economy_health if state else 0,
            "当前议题": topic
        }
        
        discussion = ai_orchestrator.internal_ai_discussion(
            characters=characters,
            topic=topic,
            context=context,
            rounds=rounds
        )
        
        # 保存讨论记录为内部通知
        for entry in discussion:
            notification = InternalNotification(
                source=entry['character_name'],
                target_roles=["总统秘书", "总统"],
                title=f"内部讨论：{topic}",
                content=entry['content'],
                priority="normal",
                forwarded_to_player=False  # 不转发给玩家
            )
            db.save_notification(notification)
        
        return jsonify({
            "success": True,
            "discussion": discussion
        })
    except Exception as e:
        logger.error(f"Internal discussion failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/system/monitor', methods=['GET'])
def get_system_monitor():
    """获取系统监控信息"""
    try:
        monitor = db.get_system_monitor()
        ai_stats = ai_orchestrator.get_stats()
        
        if not monitor:
            monitor = SystemMonitor()
        
        # 更新统计信息
        monitor.active_ai_agents = len(db.get_active_characters())
        monitor.api_calls_today = ai_stats.get('total_requests', 0)
        monitor.failed_requests = ai_stats.get('failed_requests', 0)
        monitor.retry_successes = ai_stats.get('retry_successes', 0)
        monitor.last_check = datetime.utcnow().isoformat()
        monitor.opensearch_health = "green" if not db.mock_mode else "mock_mode"
        
        db.save_system_monitor(monitor)
        
        return jsonify({
            "success": True,
            "monitor": monitor.to_dict(),
            "ai_stats": ai_stats
        })
    except Exception as e:
        logger.error(f"Get system monitor failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/settings', methods=['POST'])
def update_settings():
    """更新系统设置"""
    try:
        data = request.json
        
        # 这里可以添加各种设置的更新逻辑
        # 例如：更新 API Key、模型选择、模拟参数等
        
        return jsonify({
            "success": True,
            "message": "设置已更新"
        })
    except Exception as e:
        logger.error(f"Update settings failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ========== 后台任务 ==========

def background_event_generator():
    """后台随机事件生成器"""
    while True:
        time.sleep(random.uniform(300, 900))  # 5-15 分钟生成一个事件
        
        try:
            # 有一定概率生成随机事件
            if random.random() < 0.7:
                generate_random_event()
        except Exception as e:
            logger.error(f"Background event generator error: {e}")


def background_device_updater():
    """后台设备状态更新器"""
    while True:
        time.sleep(30)  # 每 30 秒更新一次设备状态
        
        try:
            devices = db.get_all_devices()
            for device in devices:
                device.cpu_usage = random.uniform(10, 80)
                device.memory_usage = random.uniform(30, 90)
                device.network_latency_ms = random.randint(500, 2000)
                device.last_seen = datetime.utcnow().isoformat()
                db.update_device_status(device.device_id, device.to_dict())
        except Exception as e:
            logger.error(f"Background device updater error: {e}")


# 启动后台线程
if __name__ == '__main__':
    init_app()
    
    # 启动后台任务
    threading.Thread(target=background_event_generator, daemon=True).start()
    threading.Thread(target=background_device_updater, daemon=True).start()
    
    # 启动 Web 服务器
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)

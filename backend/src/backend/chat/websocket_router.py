"""
WebSocket router for chat functionality
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt_utils import JWTManager
from backend.auth.user_service import UserService
from backend.chat.chat_service import ChatService
from backend.chat.websocket_manager import connection_manager
from backend.config import settings
from backend.models.base import get_db
from backend.models.message import MessageType
from backend.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_websocket_user(
    websocket: WebSocket, token: str, db: AsyncSession
) -> Optional[User]:
    """WebSocket接続でユーザー認証"""
    try:
        token_data = JWTManager.verify_token(token)
        if not token_data:
            return None

        user = await UserService.get_user_by_id(db, token_data.user_id)
        if not user or not user.is_active:
            return None

        return user

    except Exception as e:
        logger.error(f"WebSocket authentication error: {e}")
        return None


@router.websocket("/ws/chat")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    room_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """チャット用WebSocketエンドポイント"""
    user = await get_websocket_user(websocket, token, db)

    if not user:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    # ルームメンバーシップチェック
    if not await ChatService.is_user_in_room(db, user.id, room_id):
        await websocket.close(code=4003, reason="Not a member of this room")
        return

    # 接続を確立
    await connection_manager.connect(websocket, user, room_id)

    try:
        logger.info(f"User {user.username} (ID: {user.id}) connected to room {room_id}")

        # メッセージループ
        while True:
            data = await websocket.receive_text()

            try:
                message_data = json.loads(data)
                await handle_websocket_message(db, user, room_id, message_data)

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from user {user.id}: {data}")
            except Exception as e:
                logger.error(f"Error handling message from user {user.id}: {e}")

    except WebSocketDisconnect:
        logger.info(f"User {user.username} disconnected from room {room_id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user.id}: {e}")
    finally:
        await connection_manager.disconnect_async(user.id)


async def handle_websocket_message(
    db: AsyncSession, user: User, room_id: int, message_data: Dict[str, Any]
):
    """WebSocketメッセージを処理"""
    message_type = message_data.get("type")
    payload = message_data.get("payload", {})

    if message_type == "send_message":
        await handle_send_message(db, user, room_id, payload)
    elif message_type == "join_room":
        await handle_join_room(db, user, payload)
    elif message_type == "leave_room":
        await handle_leave_room(db, user, payload)
    else:
        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "error",
                "payload": {"message": f"Unknown message type: {message_type}"},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )


async def handle_send_message(
    db: AsyncSession, user: User, room_id: int, payload: Dict[str, Any]
):
    """メッセージ送信を処理"""
    # ルームメンバーシップの再確認
    if not await ChatService.is_user_in_room(db, user.id, room_id):
        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "error",
                "payload": {"message": "You are no longer a member of this room"},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        return

    content = payload.get("content", "").strip()
    if not content:
        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "error",
                "payload": {"message": "Message content cannot be empty"},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        return

    # 文字数制限
    if len(content) > 2000:
        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "error",
                "payload": {"message": "Message too long (max 2000 characters)"},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        return

    message_type_str = payload.get("message_type", "text")
    parent_id = payload.get("parent_id")

    try:
        message_type = MessageType(message_type_str)
    except ValueError:
        message_type = MessageType.TEXT

    try:
        # メッセージを保存
        message = await ChatService.save_message(
            db, content, user.id, room_id, message_type, parent_id
        )

        # ルーム内の全ユーザーにブロードキャスト
        broadcast_message = {
            "type": "message_received",
            "payload": {
                "id": message.id,
                "content": message.content,
                "message_type": message.message_type.value,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                },
                "room_id": room_id,
                "parent_id": message.parent_id,
                "has_latex": message.has_latex,
                "has_code": message.has_code,
                "created_at": message.created_at.isoformat(),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

        await connection_manager.broadcast_to_room(room_id, broadcast_message)

    except Exception as e:
        logger.error(f"Error saving message from user {user.id}: {e}")
        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "error",
                "payload": {"message": "Failed to save message"},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )


async def handle_join_room(db: AsyncSession, user: User, payload: Dict[str, Any]):
    """ルーム参加を処理"""
    target_room_id = payload.get("room_id")
    if not target_room_id:
        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "error",
                "payload": {"message": "Room ID is required"},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        return

    # ルーム参加処理
    success = await ChatService.join_room(db, user.id, target_room_id)

    if success:
        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "room_joined",
                "payload": {"room_id": target_room_id},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
    else:
        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "error",
                "payload": {"message": "Failed to join room or already a member"},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )


async def handle_leave_room(db: AsyncSession, user: User, payload: Dict[str, Any]):
    """ルーム退出を処理"""
    target_room_id = payload.get("room_id")
    if not target_room_id:
        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "error",
                "payload": {"message": "Room ID is required"},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        return

    # ルーム退出処理
    success = await ChatService.leave_room(db, user.id, target_room_id)

    if success:
        # WebSocketマネージャーからも退出
        await connection_manager.disconnect_from_room(user.id, target_room_id)

        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "room_left",
                "payload": {"room_id": target_room_id},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
    else:
        await connection_manager.send_personal_message(
            user.id,
            {
                "type": "error",
                "payload": {"message": "Failed to leave room or not a member"},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

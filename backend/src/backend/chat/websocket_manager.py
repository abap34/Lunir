"""
WebSocket connection manager for chat functionality
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from fastapi import WebSocket, WebSocketDisconnect

from backend.models.user import User

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket接続を管理するクラス"""

    def __init__(self):
        # アクティブな接続: {user_id: websocket}
        self.active_connections: Dict[int, WebSocket] = {}
        # ルームごとの接続: {room_id: {user_id}}
        self.room_connections: Dict[int, Set[int]] = {}
        # ユーザー情報: {user_id: user_info}
        self.connected_users: Dict[int, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, user: User, room_id: int):
        """WebSocket接続を受け入れる"""
        await websocket.accept()

        # 既存の接続があれば切断
        if user.id in self.active_connections:
            try:
                old_ws = self.active_connections[user.id]
                await old_ws.close(code=1000, reason="New connection established")
            except Exception as e:
                logger.warning(f"Error closing old connection for user {user.id}: {e}")

        # 新しい接続を登録
        self.active_connections[user.id] = websocket
        self.connected_users[user.id] = {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
        }

        # ルームに参加
        if room_id not in self.room_connections:
            self.room_connections[room_id] = set()
        self.room_connections[room_id].add(user.id)

        logger.info(f"User {user.username} connected to room {room_id}")

        # ルームの他のユーザーに参加通知
        await self.broadcast_to_room(
            room_id,
            {
                "type": "user_joined",
                "payload": {"user": self.connected_users[user.id], "room_id": room_id},
                "timestamp": datetime.utcnow().isoformat(),
            },
            exclude_user=user.id,
        )

    def disconnect(self, user_id: int):
        """WebSocket接続を切断"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]

        if user_id in self.connected_users:
            user_info = self.connected_users[user_id]
            del self.connected_users[user_id]

            # 全ルームから削除
            rooms_to_notify = []
            for room_id, users in list(self.room_connections.items()):
                if user_id in users:
                    users.remove(user_id)
                    rooms_to_notify.append(room_id)
                    # 空になったルームは削除
                    if not users:
                        del self.room_connections[room_id]

            logger.info(
                f"User {user_info.get('username')} disconnected from {len(rooms_to_notify)} rooms"
            )

    async def disconnect_async(self, user_id: int):
        """WebSocket接続を切断（非同期版）"""
        if user_id not in self.connected_users:
            return

        user_info = self.connected_users[user_id]

        # 全ルームから削除し、通知も送信
        rooms_to_notify = []
        for room_id, users in list(self.room_connections.items()):
            if user_id in users:
                users.remove(user_id)
                rooms_to_notify.append(room_id)
                # 空になったルームは削除
                if not users:
                    del self.room_connections[room_id]

        # 各ルームに退出通知
        for room_id in rooms_to_notify:
            await self.broadcast_to_room(
                room_id,
                {
                    "type": "user_left",
                    "payload": {"user": user_info, "room_id": room_id},
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )

        # 接続情報を削除
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.connected_users:
            del self.connected_users[user_id]

        logger.info(
            f"User {user_info.get('username')} disconnected from {len(rooms_to_notify)} rooms"
        )

    async def disconnect_from_room(self, user_id: int, room_id: int):
        """ルームから退出"""
        if (
            room_id in self.room_connections
            and user_id in self.room_connections[room_id]
        ):
            self.room_connections[room_id].remove(user_id)

            if user_id in self.connected_users:
                user_info = self.connected_users[user_id]

                # ルームの他のユーザーに退出通知
                await self.broadcast_to_room(
                    room_id,
                    {
                        "type": "user_left",
                        "payload": {"user": user_info, "room_id": room_id},
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                    exclude_user=user_id,
                )

    async def send_personal_message(self, user_id: int, message: Dict[str, Any]):
        """特定のユーザーにメッセージを送信"""
        if user_id not in self.active_connections:
            return False

        try:
            await self.active_connections[user_id].send_text(json.dumps(message))
            return True
        except WebSocketDisconnect:
            logger.info(f"User {user_id} disconnected during message send")
            await self.disconnect_async(user_id)
            return False
        except Exception as e:
            logger.error(f"Error sending message to user {user_id}: {e}")
            await self.disconnect_async(user_id)
            return False

    async def broadcast_to_room(
        self, room_id: int, message: Dict[str, Any], exclude_user: Optional[int] = None
    ):
        """ルーム内の全ユーザーにメッセージをブロードキャスト"""
        if room_id not in self.room_connections:
            return

        # ユーザーリストのコピーを作成（反復中の変更を避けるため）
        user_ids = list(self.room_connections[room_id])
        disconnected_users = []

        for user_id in user_ids:
            if exclude_user and user_id == exclude_user:
                continue

            if user_id in self.active_connections:
                try:
                    await self.active_connections[user_id].send_text(
                        json.dumps(message)
                    )
                except WebSocketDisconnect:
                    disconnected_users.append(user_id)
                except Exception as e:
                    logger.error(f"Error broadcasting to user {user_id}: {e}")
                    disconnected_users.append(user_id)

        # 切断されたユーザーをクリーンアップ
        for user_id in disconnected_users:
            await self.disconnect_async(user_id)

    def get_room_users(self, room_id: int) -> List[Dict[str, Any]]:
        """ルーム内のユーザー一覧を取得"""
        if room_id not in self.room_connections:
            return []

        users = []
        for user_id in self.room_connections[room_id]:
            if user_id in self.connected_users:
                users.append(self.connected_users[user_id])

        return users

    def get_connection_count(self) -> int:
        """アクティブな接続数を取得"""
        return len(self.active_connections)

    def get_room_count(self) -> int:
        """アクティブなルーム数を取得"""
        return len([room for room in self.room_connections.values() if room])


# グローバルな接続マネージャーインスタンス
connection_manager = ConnectionManager()

"""
Chat service for handling chat operations
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import selectinload

from backend.models.user import User
from backend.models.chat_room import ChatRoom, RoomMember, RoleType
from backend.models.message import Message, MessageType


class ChatService:
    """チャット機能のビジネスロジック"""
    
    @staticmethod
    async def get_user_rooms(db: AsyncSession, user_id: int) -> List[Dict[str, Any]]:
        """ユーザーが参加しているルーム一覧を取得"""
        result = await db.execute(
            select(ChatRoom)
            .join(RoomMember)
            .where(RoomMember.user_id == user_id)
            .options(selectinload(ChatRoom.members).selectinload(RoomMember.user))
        )
        rooms = result.scalars().all()
        
        room_list = []
        for room in rooms:
            room_dict = {
                "id": room.id,
                "name": room.name,
                "description": room.description,
                "is_private": room.is_private,
                "created_at": room.created_at.isoformat(),
                "member_count": len(room.members)
            }
            room_list.append(room_dict)
        
        return room_list
    
    @staticmethod
    async def get_room_by_id(db: AsyncSession, room_id: int) -> Optional[ChatRoom]:
        """ルームIDでルームを取得"""
        result = await db.execute(
            select(ChatRoom)
            .where(ChatRoom.id == room_id)
            .options(selectinload(ChatRoom.members).selectinload(RoomMember.user))
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def create_room(
        db: AsyncSession, 
        name: str, 
        description: Optional[str], 
        creator_id: int,
        is_private: bool = False
    ) -> ChatRoom:
        """新しいチャットルームを作成"""
        room = ChatRoom(
            name=name,
            description=description,
            is_private=is_private,
            created_by=creator_id
        )
        
        db.add(room)
        await db.flush()  # IDを取得するため
        
        # 作成者を管理者として追加
        member = RoomMember(
            user_id=creator_id,
            room_id=room.id,
            role=RoleType.ADMIN
        )
        
        db.add(member)
        await db.commit()
        await db.refresh(room)
        
        return room
    
    @staticmethod
    async def join_room(db: AsyncSession, user_id: int, room_id: int) -> bool:
        """ルームに参加"""
        # 既に参加しているかチェック
        existing_member = await db.execute(
            select(RoomMember).where(
                and_(
                    RoomMember.user_id == user_id,
                    RoomMember.room_id == room_id
                )
            )
        )
        
        if existing_member.scalar_one_or_none():
            return False  # 既に参加している
        
        # 新しいメンバーとして追加
        member = RoomMember(
            user_id=user_id,
            room_id=room_id,
            role=RoleType.MEMBER
        )
        
        db.add(member)
        await db.commit()
        
        return True
    
    @staticmethod
    async def leave_room(db: AsyncSession, user_id: int, room_id: int) -> bool:
        """ルームから退出"""
        result = await db.execute(
            select(RoomMember).where(
                and_(
                    RoomMember.user_id == user_id,
                    RoomMember.room_id == room_id
                )
            )
        )
        
        member = result.scalar_one_or_none()
        if not member:
            return False  # メンバーではない
        
        await db.delete(member)
        await db.commit()
        
        return True
    
    @staticmethod
    async def is_user_in_room(db: AsyncSession, user_id: int, room_id: int) -> bool:
        """ユーザーがルームのメンバーかチェック"""
        result = await db.execute(
            select(RoomMember).where(
                and_(
                    RoomMember.user_id == user_id,
                    RoomMember.room_id == room_id
                )
            )
        )
        
        return result.scalar_one_or_none() is not None
    
    @staticmethod
    async def save_message(
        db: AsyncSession,
        content: str,
        user_id: int,
        room_id: int,
        message_type: MessageType = MessageType.TEXT,
        parent_id: Optional[int] = None
    ) -> Message:
        """メッセージを保存"""
        # LaTeXとコードの自動検出
        has_latex = "$$" in content or "$" in content
        has_code = "```" in content or "`" in content
        
        message = Message(
            content=content,
            message_type=message_type,
            user_id=user_id,
            room_id=room_id,
            parent_id=parent_id,
            has_latex=has_latex,
            has_code=has_code
        )
        
        db.add(message)
        await db.commit()
        await db.refresh(message)
        
        return message
    
    @staticmethod
    async def get_room_messages(
        db: AsyncSession, 
        room_id: int, 
        limit: int = 50, 
        before_id: Optional[int] = None
    ) -> List[Message]:
        """ルームのメッセージ履歴を取得"""
        query = (
            select(Message)
            .where(Message.room_id == room_id)
            .options(selectinload(Message.user))
            .order_by(desc(Message.created_at))
            .limit(limit)
        )
        
        if before_id:
            query = query.where(Message.id < before_id)
        
        result = await db.execute(query)
        messages = result.scalars().all()
        
        # 時系列順に並び替え
        return list(reversed(messages))
    
    @staticmethod
    async def get_message_with_user(db: AsyncSession, message_id: int) -> Optional[Message]:
        """メッセージをユーザー情報と共に取得"""
        result = await db.execute(
            select(Message)
            .where(Message.id == message_id)
            .options(selectinload(Message.user))
        )
        
        return result.scalar_one_or_none()
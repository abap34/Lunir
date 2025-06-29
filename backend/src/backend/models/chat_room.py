"""
Chat room and room membership models
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from .base import Base, TimestampMixin


class RoleType(enum.Enum):
    """ルームメンバーのロール"""
    ADMIN = "admin"
    MODERATOR = "moderator"
    MEMBER = "member"


class ChatRoom(Base, TimestampMixin):
    """チャットルームモデル"""
    
    __tablename__ = "chat_rooms"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_private = Column(Boolean, default=False, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # リレーション
    creator = relationship("User", back_populates="created_rooms")
    members = relationship("RoomMember", back_populates="room")
    messages = relationship("Message", back_populates="room")
    call_sessions = relationship("CallSession", back_populates="room")
    
    def __repr__(self) -> str:
        return f"<ChatRoom(id={self.id}, name='{self.name}')>"


class RoomMember(Base):
    """ルームメンバーシップモデル"""
    
    __tablename__ = "room_members"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"), nullable=False)
    role = Column(Enum(RoleType), default=RoleType.MEMBER, nullable=False)
    joined_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    # リレーション
    user = relationship("User", back_populates="room_memberships")
    room = relationship("ChatRoom", back_populates="members")
    
    def __repr__(self) -> str:
        return f"<RoomMember(user_id={self.user_id}, room_id={self.room_id}, role={self.role})>"
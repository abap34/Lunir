"""
Message model
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from .base import Base, TimestampMixin


class MessageType(enum.Enum):
    """メッセージタイプ"""
    TEXT = "text"
    CODE = "code"
    LATEX = "latex"
    SYSTEM = "system"


class Message(Base, TimestampMixin):
    """メッセージモデル"""
    
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    message_type = Column(Enum(MessageType), default=MessageType.TEXT, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    has_latex = Column(Boolean, default=False, nullable=False)
    has_code = Column(Boolean, default=False, nullable=False)
    
    # リレーション
    user = relationship("User", back_populates="messages")
    room = relationship("ChatRoom", back_populates="messages")
    parent = relationship("Message", remote_side=[id], backref="replies")
    
    def __repr__(self) -> str:
        content_preview = self.content[:50] + "..." if len(self.content) > 50 else self.content
        return f"<Message(id={self.id}, user_id={self.user_id}, content='{content_preview}')>"
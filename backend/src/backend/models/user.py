"""
User model
"""
from sqlalchemy import Column, Integer, String, Text, Boolean
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """ユーザーモデル"""
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    github_id = Column(Integer, unique=True, nullable=False, index=True)
    username = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    avatar_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # リレーション
    room_memberships = relationship("RoomMember", back_populates="user")
    messages = relationship("Message", back_populates="user")
    timeline_posts = relationship("TimelinePost", back_populates="user")
    initiated_calls = relationship("CallSession", back_populates="initiator")
    call_participations = relationship("CallParticipant", back_populates="user")
    created_rooms = relationship("ChatRoom", back_populates="creator")
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}')>"
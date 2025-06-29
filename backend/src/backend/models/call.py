"""
Call session and participant models
"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from .base import Base


class CallStatus(enum.Enum):
    """通話セッション状態"""
    ACTIVE = "active"
    ENDED = "ended"


class CallSession(Base):
    """通話セッションモデル"""
    
    __tablename__ = "call_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"), nullable=False)
    initiated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(CallStatus), default=CallStatus.ACTIVE, nullable=False)
    started_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    ended_at = Column(DateTime(timezone=True), nullable=True)
    
    # リレーション
    room = relationship("ChatRoom", back_populates="call_sessions")
    initiator = relationship("User", back_populates="initiated_calls")
    participants = relationship("CallParticipant", back_populates="session")
    
    def __repr__(self) -> str:
        return f"<CallSession(id={self.id}, room_id={self.room_id}, status={self.status})>"


class CallParticipant(Base):
    """通話参加者モデル"""
    
    __tablename__ = "call_participants"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("call_sessions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    left_at = Column(DateTime(timezone=True), nullable=True)
    
    # リレーション
    session = relationship("CallSession", back_populates="participants")
    user = relationship("User", back_populates="call_participations")
    
    def __repr__(self) -> str:
        return f"<CallParticipant(session_id={self.session_id}, user_id={self.user_id})>"
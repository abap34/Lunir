"""
Timeline post model
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from .base import Base, TimestampMixin


class PostType(enum.Enum):
    """投稿タイプ"""
    GENERAL = "general"
    CODE_SNIPPET = "code_snippet"
    QUESTION = "question"
    ANNOUNCEMENT = "announcement"


class VisibilityType(enum.Enum):
    """可視性タイプ"""
    PUBLIC = "public"
    FRIENDS = "friends"
    PRIVATE = "private"


class TimelinePost(Base, TimestampMixin):
    """タイムライン投稿モデル"""
    
    __tablename__ = "timeline_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    post_type = Column(Enum(PostType), default=PostType.GENERAL, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    has_latex = Column(Boolean, default=False, nullable=False)
    has_code = Column(Boolean, default=False, nullable=False)
    visibility = Column(Enum(VisibilityType), default=VisibilityType.PUBLIC, nullable=False)
    
    # リレーション
    user = relationship("User", back_populates="timeline_posts")
    
    def __repr__(self) -> str:
        title_preview = self.title or "No Title"
        content_preview = self.content[:50] + "..." if len(self.content) > 50 else self.content
        return f"<TimelinePost(id={self.id}, title='{title_preview}', content='{content_preview}')>"
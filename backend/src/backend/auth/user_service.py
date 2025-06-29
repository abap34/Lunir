"""
User service for authentication and user management
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.models.user import User
from backend.auth.github_oauth import GitHubUser


class UserService:
    """ユーザー管理サービス"""
    
    @staticmethod
    async def get_user_by_github_id(db: AsyncSession, github_id: int) -> Optional[User]:
        """GitHub IDでユーザーを取得"""
        result = await db.execute(
            select(User).where(User.github_id == github_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
        """ユーザーIDでユーザーを取得"""
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def create_user_from_github(db: AsyncSession, github_user: GitHubUser) -> User:
        """GitHubユーザー情報から新規ユーザーを作成"""
        user = User(
            github_id=github_user.id,
            username=github_user.login,
            display_name=github_user.name,
            email=github_user.email,
            avatar_url=github_user.avatar_url,
            bio=github_user.bio,
            is_active=True
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        return user
    
    @staticmethod
    async def update_user_from_github(
        db: AsyncSession, 
        user: User, 
        github_user: GitHubUser
    ) -> User:
        """GitHubユーザー情報でユーザー情報を更新"""
        user.username = github_user.login
        user.display_name = github_user.name
        user.email = github_user.email
        user.avatar_url = github_user.avatar_url
        user.bio = github_user.bio
        
        await db.commit()
        await db.refresh(user)
        
        return user
    
    @staticmethod
    async def get_or_create_user_from_github(
        db: AsyncSession, 
        github_user: GitHubUser
    ) -> User:
        """GitHubユーザー情報からユーザーを取得または作成"""
        existing_user = await UserService.get_user_by_github_id(db, github_user.id)
        
        if existing_user:
            # 既存ユーザーの情報を更新
            return await UserService.update_user_from_github(db, existing_user, github_user)
        else:
            # 新規ユーザーを作成
            return await UserService.create_user_from_github(db, github_user)
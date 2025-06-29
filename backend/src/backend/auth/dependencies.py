"""
FastAPI dependencies for authentication
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.base import get_db
from backend.models.user import User
from backend.auth.jwt_utils import JWTManager, TokenData
from backend.auth.user_service import UserService
from backend.config import settings

security = HTTPBearer()


async def get_current_user_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """Bearer tokenから現在のユーザートークンデータを取得"""
    token = credentials.credentials
    
    token_data = JWTManager.verify_token(token)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return token_data


async def get_current_user(
    token_data: TokenData = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
) -> User:
    """現在の認証されたユーザーを取得"""
    user = await UserService.get_user_by_id(db, token_data.user_id)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """オプションで現在のユーザーを取得（認証不要エンドポイント用）"""
    if not credentials:
        return None
    
    token_data = JWTManager.verify_token(credentials.credentials)
    if token_data is None:
        return None
    
    user = await UserService.get_user_by_id(db, token_data.user_id)
    if user is None or not user.is_active:
        return None
    
    return user


async def get_dev_user(db: AsyncSession = Depends(get_db)) -> User:
    """開発モード用のデフォルトユーザーを取得"""
    user = await UserService.get_user_by_id(db, settings.dev_default_user_id)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Development default user (ID: {settings.dev_default_user_id}) not found"
        )
    
    return user


async def get_current_user_or_dev(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db)
) -> User:
    """開発モードでは認証をバイパス、本番では通常の認証を行う"""
    
    # 開発モードで認証バイパスが有効な場合
    if settings.dev_bypass_auth and settings.dev_mode:
        return await get_dev_user(db)
    
    # 通常の認証フロー
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token_data = JWTManager.verify_token(credentials.credentials)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await UserService.get_user_by_id(db, token_data.user_id)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user
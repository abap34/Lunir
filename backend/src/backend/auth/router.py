"""
Authentication router
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from backend.models.base import get_db
from backend.models.user import User
from backend.auth.github_oauth import GitHubOAuthService
from backend.auth.user_service import UserService
from backend.auth.jwt_utils import JWTManager, TokenData
from backend.auth.dependencies import get_current_user, get_dev_user
from backend.config import settings

router = APIRouter(prefix="/auth", tags=["authentication"])


class AuthURLResponse(BaseModel):
    """認証URL レスポンス"""
    auth_url: str
    state: str


class TokenResponse(BaseModel):
    """トークン レスポンス"""
    access_token: str
    token_type: str
    user: dict


class UserResponse(BaseModel):
    """ユーザー レスポンス"""
    id: int
    github_id: int
    username: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool


@router.get("/github/login", response_model=AuthURLResponse)
async def github_login():
    """GitHub OAuth認証URLを生成"""
    redirect_uri = "http://localhost:3000/callback"
    auth_url, state = GitHubOAuthService.generate_auth_url(redirect_uri)
    
    return AuthURLResponse(auth_url=auth_url, state=state)


@router.get("/github/callback")
async def github_callback(
    code: str,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """GitHub OAuth認証コールバック"""
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code is required"
        )
    
    # コードをアクセストークンに交換
    redirect_uri = "http://localhost:3000/callback"
    access_token = await GitHubOAuthService.exchange_code_for_token(code, redirect_uri)
    
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange code for access token"
        )
    
    # GitHubからユーザー情報を取得
    github_user = await GitHubOAuthService.get_user_info(access_token)
    
    if not github_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to get user information from GitHub"
        )
    
    # ユーザーを取得または作成
    user = await UserService.get_or_create_user_from_github(db, github_user)
    
    # JWTトークンを生成
    token_data = TokenData(
        user_id=user.id,
        github_id=user.github_id,
        username=user.username,
        email=user.email
    )
    
    jwt_token = JWTManager.create_access_token(token_data)
    
    return TokenResponse(
        access_token=jwt_token,
        token_type="bearer",
        user={
            "id": user.id,
            "github_id": user.github_id,
            "username": user.username,
            "display_name": user.display_name,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "bio": user.bio,
            "is_active": user.is_active
        }
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """現在のユーザー情報を取得"""
    return UserResponse(
        id=current_user.id,
        github_id=current_user.github_id,
        username=current_user.username,
        display_name=current_user.display_name,
        email=current_user.email,
        avatar_url=current_user.avatar_url,
        bio=current_user.bio,
        is_active=current_user.is_active
    )


@router.post("/logout")
async def logout():
    """ログアウト"""
    # JWTはステートレスなので、クライアント側でトークンを削除するだけ
    return {"message": "Successfully logged out"}


@router.post("/dev/login", response_model=TokenResponse)
async def dev_login(
    user_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """開発者向けログイン（開発環境のみ）"""
    
    # 本番環境では無効化
    if not settings.dev_mode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not available in production"
        )
    
    # 指定されたユーザーIDまたはデフォルトユーザーを使用
    target_user_id = user_id or settings.dev_default_user_id
    user = await UserService.get_user_by_id(db, target_user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {target_user_id} not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not active"
        )
    
    # JWTトークンを生成
    token_data = TokenData(
        user_id=user.id,
        github_id=user.github_id,
        username=user.username,
        email=user.email
    )
    
    jwt_token = JWTManager.create_access_token(token_data)
    
    return TokenResponse(
        access_token=jwt_token,
        token_type="bearer",
        user={
            "id": user.id,
            "github_id": user.github_id,
            "username": user.username,
            "display_name": user.display_name,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "bio": user.bio,
            "is_active": user.is_active
        }
    )


@router.get("/dev/users", response_model=list[UserResponse])
async def list_dev_users(db: AsyncSession = Depends(get_db)):
    """開発者向けユーザー一覧（開発環境のみ）"""
    
    # 本番環境では無効化
    if not settings.dev_mode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not available in production"
        )
    
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.is_active == True).limit(10))
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=user.id,
            github_id=user.github_id,
            username=user.username,
            display_name=user.display_name,
            email=user.email,
            avatar_url=user.avatar_url,
            bio=user.bio,
            is_active=user.is_active
        )
        for user in users
    ]


@router.post("/dev/create-test-user", response_model=UserResponse)
async def create_test_user(
    username: str,
    display_name: Optional[str] = None,
    email: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """開発者向けテストユーザー作成（開発環境のみ）"""
    
    # 本番環境では無効化
    if not settings.dev_mode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not available in production"
        )
    
    # 重複チェック
    from sqlalchemy import select
    existing_user = await db.execute(
        select(User).where(User.username == username)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # テストユーザー作成（github_idは負の値を使用して区別）
    import random
    test_github_id = -random.randint(1000, 9999)
    
    user = User(
        github_id=test_github_id,
        username=username,
        display_name=display_name or username,
        email=email,
        avatar_url=f"https://avatars.githubusercontent.com/u/{abs(test_github_id)}",
        bio=f"Test user created for development",
        is_active=True
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=user.id,
        github_id=user.github_id,
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        avatar_url=user.avatar_url,
        bio=user.bio,
        is_active=user.is_active
    )
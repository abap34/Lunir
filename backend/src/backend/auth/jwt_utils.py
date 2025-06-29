"""
JWT utilities for authentication
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from pydantic import BaseModel

from backend.config import settings


class TokenData(BaseModel):
    """JWTトークンデータ"""
    user_id: int
    github_id: int
    username: str
    email: Optional[str] = None


class JWTManager:
    """JWT トークン管理クラス"""
    
    @staticmethod
    def create_access_token(data: TokenData, expires_delta: Optional[timedelta] = None) -> str:
        """アクセストークンを作成"""
        to_encode = data.model_dump()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
        
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})
        
        encoded_jwt = jwt.encode(
            to_encode, 
            settings.secret_key, 
            algorithm=settings.algorithm
        )
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> Optional[TokenData]:
        """トークンを検証して内容を返す"""
        try:
            payload = jwt.decode(
                token, 
                settings.secret_key, 
                algorithms=[settings.algorithm]
            )
            
            user_id = payload.get("user_id")
            github_id = payload.get("github_id")
            username = payload.get("username")
            email = payload.get("email")
            
            if user_id is None or github_id is None or username is None:
                return None
            
            return TokenData(
                user_id=user_id,
                github_id=github_id,
                username=username,
                email=email
            )
            
        except JWTError:
            return None
    
    @staticmethod
    def decode_token_payload(token: str) -> Optional[Dict[str, Any]]:
        """トークンをデコードして全ペイロードを返す（デバッグ用）"""
        try:
            payload = jwt.decode(
                token,
                settings.secret_key,
                algorithms=[settings.algorithm]
            )
            return payload
        except JWTError:
            return None
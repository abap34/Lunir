"""
GitHub OAuth service
"""
import httpx
from typing import Optional, Dict, Any
from urllib.parse import urlencode
import secrets

from backend.config import settings


class GitHubUser:
    """GitHub ユーザー情報"""
    def __init__(self, data: Dict[str, Any]):
        self.id: int = data["id"]
        self.login: str = data["login"]
        self.name: Optional[str] = data.get("name")
        self.email: Optional[str] = data.get("email")
        self.avatar_url: Optional[str] = data.get("avatar_url")
        self.bio: Optional[str] = data.get("bio")


class GitHubOAuthService:
    """GitHub OAuth サービス"""
    
    GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize"
    GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
    GITHUB_USER_URL = "https://api.github.com/user"
    GITHUB_USER_EMAIL_URL = "https://api.github.com/user/emails"
    
    @classmethod
    def generate_auth_url(cls, redirect_uri: str) -> tuple[str, str]:
        """GitHub認証URLを生成"""
        state = secrets.token_urlsafe(32)
        
        params = {
            "client_id": settings.github_client_id,
            "redirect_uri": redirect_uri,
            "scope": "user:email",
            "state": state,
        }
        
        auth_url = f"{cls.GITHUB_OAUTH_URL}?{urlencode(params)}"
        return auth_url, state
    
    @classmethod
    async def exchange_code_for_token(cls, code: str, redirect_uri: str) -> Optional[str]:
        """認証コードをアクセストークンに交換"""
        data = {
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }
        
        headers = {
            "Accept": "application/json",
            "User-Agent": "Lunir-App",
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    cls.GITHUB_TOKEN_URL,
                    data=data,
                    headers=headers
                )
                response.raise_for_status()
                
                token_data = response.json()
                return token_data.get("access_token")
                
            except httpx.HTTPError:
                return None
    
    @classmethod
    async def get_user_info(cls, access_token: str) -> Optional[GitHubUser]:
        """アクセストークンを使用してユーザー情報を取得"""
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/json",
            "User-Agent": "Lunir-App",
        }
        
        async with httpx.AsyncClient() as client:
            try:
                # ユーザー基本情報を取得
                user_response = await client.get(
                    cls.GITHUB_USER_URL,
                    headers=headers
                )
                user_response.raise_for_status()
                user_data = user_response.json()
                
                # メールアドレスが公開されていない場合は別途取得
                if not user_data.get("email"):
                    email_response = await client.get(
                        cls.GITHUB_USER_EMAIL_URL,
                        headers=headers
                    )
                    if email_response.status_code == 200:
                        emails = email_response.json()
                        primary_email = next(
                            (email["email"] for email in emails if email["primary"]),
                            None
                        )
                        user_data["email"] = primary_email
                
                return GitHubUser(user_data)
                
            except httpx.HTTPError:
                return None
"""
Configuration settings for Lunir Backend
"""

from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """アプリケーション設定"""

    # Basic settings
    app_name: str = "Lunir"
    debug: bool = False

    # Database settings
    database_url: str = "sqlite+aiosqlite:///./lunir.db"

    # Security settings
    secret_key: str = "your-secret-key-here"  # 本番環境では環境変数から
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # GitHub OAuth settings
    github_client_id: str = ""
    github_client_secret: str = ""

    # CORS settings
    allowed_origins: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # WebSocket settings
    max_connections: int = 1000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

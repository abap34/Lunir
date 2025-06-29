"""
Lunir FastAPI Backend Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

from backend.auth.router import router as auth_router
from backend.chat.rest_router import router as chat_rest_router
from backend.chat.websocket_router import router as chat_ws_router

app = FastAPI(
    title="Lunir API",
    description="ソフトウェアエンジニア向けチャット・通話アプリケーション",
    version="0.1.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React開発サーバー
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター追加
app.include_router(auth_router)
app.include_router(chat_rest_router)
app.include_router(chat_ws_router)


class HealthResponse(BaseModel):
    status: str
    message: str


@app.get("/")
async def root() -> Dict[str, str]:
    """ルートエンドポイント"""
    return {"message": "Lunir API Server"}


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """ヘルスチェックエンドポイント"""
    return HealthResponse(
        status="healthy",
        message="Lunir API is running"
    )


@app.get("/api/v1/status")
async def api_status() -> Dict[str, Any]:
    """API状態確認エンドポイント"""
    return {
        "api_version": "v1",
        "status": "running",
        "features": {
            "chat": True,
            "voice_call": False,
            "timeline": False,
            "latex_support": False,
            "code_highlight": False,
            "github_auth": True
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
"""
Tests for main FastAPI application
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_root_endpoint():
    """ルートエンドポイントのテスト"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Lunir API Server"}


def test_health_check():
    """ヘルスチェックエンドポイントのテスト"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["message"] == "Lunir API is running"


def test_api_status():
    """API状態確認エンドポイントのテスト"""
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert data["api_version"] == "v1"
    assert data["status"] == "running"
    assert "features" in data
    
    # 機能フラグの確認
    features = data["features"]
    assert features["chat"] is True
    assert features["voice_call"] is False
    assert features["timeline"] is False
    assert features["latex_support"] is False
    assert features["code_highlight"] is False
    assert features["github_auth"] is True
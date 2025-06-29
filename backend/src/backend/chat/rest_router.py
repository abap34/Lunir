"""
REST API router for chat functionality
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.chat.chat_service import ChatService
from backend.chat.websocket_manager import connection_manager
from backend.models.base import get_db
from backend.models.message import MessageType
from backend.models.user import User

router = APIRouter(prefix="/api/v1", tags=["chat"])


class CreateRoomRequest(BaseModel):
    """ルーム作成リクエスト"""

    name: str
    description: Optional[str] = None
    is_private: bool = False


class JoinRoomRequest(BaseModel):
    """ルーム参加リクエスト"""

    room_id: int


class RoomResponse(BaseModel):
    """ルームレスポンス"""

    id: int
    name: str
    description: Optional[str]
    is_private: bool
    created_at: str
    member_count: int


class MessageResponse(BaseModel):
    """メッセージレスポンス"""

    id: int
    content: str
    message_type: str
    user: dict
    room_id: int
    parent_id: Optional[int]
    has_latex: bool
    has_code: bool
    created_at: str


@router.get("/rooms", response_model=List[RoomResponse])
async def get_user_rooms(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """ユーザーが参加しているルーム一覧を取得"""
    rooms = await ChatService.get_user_rooms(db, current_user.id)
    return [RoomResponse(**room) for room in rooms]


@router.post("/rooms", response_model=RoomResponse)
async def create_room(
    request: CreateRoomRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """新しいチャットルームを作成"""
    if not request.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Room name cannot be empty"
        )

    if len(request.name) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room name too long (max 100 characters)",
        )

    room = await ChatService.create_room(
        db,
        name=request.name.strip(),
        description=request.description.strip() if request.description else None,
        creator_id=current_user.id,
        is_private=request.is_private,
    )

    room_response = RoomResponse(
        id=room.id,
        name=room.name,
        description=room.description,
        is_private=room.is_private,
        created_at=room.created_at.isoformat(),
        member_count=1,  # 作成者のみ
    )

    # WebSocketで新しいルーム作成を全ユーザーに通知
    if not request.is_private:  # パブリックルームのみ通知
        await connection_manager.broadcast_room_created(
            {
                "id": room.id,
                "name": room.name,
                "description": room.description,
                "is_private": room.is_private,
                "created_at": room.created_at.isoformat(),
                "member_count": 1,
                "created_by": {
                    "id": current_user.id,
                    "username": current_user.username,
                    "display_name": current_user.display_name,
                },
            }
        )

    return room_response


@router.get("/rooms/{room_id}")
async def get_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """ルーム詳細を取得"""
    # ルームメンバーシップチェック
    if not await ChatService.is_user_in_room(db, current_user.id, room_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room"
        )

    room = await ChatService.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    return {
        "id": room.id,
        "name": room.name,
        "description": room.description,
        "is_private": room.is_private,
        "created_at": room.created_at.isoformat(),
        "members": [
            {
                "id": member.user.id,
                "username": member.user.username,
                "display_name": member.user.display_name,
                "avatar_url": member.user.avatar_url,
                "role": member.role.value,
                "joined_at": member.joined_at.isoformat(),
            }
            for member in room.members
        ],
    }


@router.post("/rooms/{room_id}/join")
async def join_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """ルームに参加"""
    # ルームの存在確認
    room = await ChatService.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    # プライベートルームの場合は参加を拒否（招待制の実装は後で）
    if room.is_private:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cannot join private room"
        )

    success = await ChatService.join_room(db, current_user.id, room_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already a member of this room",
        )

    return {"message": "Successfully joined room"}


@router.post("/rooms/{room_id}/leave")
async def leave_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """ルームから退出"""
    success = await ChatService.leave_room(db, current_user.id, room_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Not a member of this room"
        )

    return {"message": "Successfully left room"}


@router.get("/rooms/{room_id}/messages", response_model=List[MessageResponse])
async def get_room_messages(
    room_id: int,
    limit: int = Query(50, ge=1, le=100),
    before_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """ルームのメッセージ履歴を取得"""
    # ルームメンバーシップチェック
    if not await ChatService.is_user_in_room(db, current_user.id, room_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room"
        )

    messages = await ChatService.get_room_messages(db, room_id, limit, before_id)

    return [
        MessageResponse(
            id=message.id,
            content=message.content,
            message_type=message.message_type.value,
            user={
                "id": message.user.id,
                "username": message.user.username,
                "display_name": message.user.display_name,
                "avatar_url": message.user.avatar_url,
            },
            room_id=message.room_id,
            parent_id=message.parent_id,
            has_latex=message.has_latex,
            has_code=message.has_code,
            created_at=message.created_at.isoformat(),
        )
        for message in messages
    ]


@router.get("/stats")
async def get_chat_stats(current_user: User = Depends(get_current_user)):
    """チャット統計情報を取得"""
    from backend.chat.websocket_manager import connection_manager

    return {
        "active_connections": connection_manager.get_connection_count(),
        "active_rooms": connection_manager.get_room_count(),
        "user_id": current_user.id,
    }

# タイムライン機能仕様

## 概要

全チャットルームのメッセージを統合して時系列順に表示するタイムライン機能。ユーザーがルームを跨いで全体の会話の流れを把握できる。

## 機能要件

### 基本機能
1. **全ルーム統合表示**
   - ユーザーが参加している全ルームのメッセージを統合
   - 時系列順（最新が上）でメッセージ表示
   - ルーム情報を各メッセージに表示

2. **フィルタリング機能**
   - 特定ルームのみ表示
   - メッセージタイプ別フィルタ（テキスト/コード）
   - 日付範囲指定

3. **ページネーション**
   - 無限スクロール対応
   - 初回50件、スクロールで追加読み込み

## データベース設計

### 既存テーブル活用
タイムライン機能は既存の`messages`テーブルを活用。追加のテーブル作成は不要。

### 必要なクエリパターン

```sql
-- ユーザーが参加しているルームの全メッセージを時系列取得
SELECT m.*, u.username, u.display_name, u.avatar_url, r.name as room_name
FROM messages m
JOIN users u ON m.user_id = u.id
JOIN chat_rooms r ON m.room_id = r.id
JOIN room_members rm ON r.id = rm.room_id
WHERE rm.user_id = ?
ORDER BY m.created_at DESC
LIMIT ? OFFSET ?;

-- 特定ルームフィルタ付き
WHERE rm.user_id = ? AND m.room_id = ?

-- 日付範囲フィルタ付き
WHERE rm.user_id = ? 
  AND m.created_at >= ? 
  AND m.created_at <= ?
```

### インデックス最適化

```sql
-- タイムライン表示のためのインデックス
CREATE INDEX idx_messages_timeline ON messages(created_at DESC, room_id);
CREATE INDEX idx_room_members_user_timeline ON room_members(user_id, room_id);
```

## API設計

### REST エンドポイント

| メソッド | エンドポイント | 説明 | パラメータ |
|---------|---------------|------|------------|
| GET | `/api/v1/timeline` | タイムライン取得 | limit, offset, room_id?, start_date?, end_date? |
| GET | `/api/v1/timeline/stats` | タイムライン統計 | - |

### レスポンス形式

```typescript
interface TimelineMessage {
  id: number
  content: string
  message_type: string
  user: {
    id: number
    username: string
    display_name?: string
    avatar_url?: string
  }
  room: {
    id: number
    name: string
    is_private: boolean
  }
  parent_id?: number
  has_latex: boolean
  has_code: boolean
  created_at: string
}

interface TimelineResponse {
  messages: TimelineMessage[]
  total_count: number
  has_more: boolean
}
```

## UI/UX設計

### タイムライン画面レイアウト

```
┌─────────────────────────────────────────────┐
│ Header (Lunir + User Info)                  │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Timeline Filters                        │ │
│ │ [All Rooms ▼] [All Types ▼] [📅 Date] │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Timeline Messages                       │ │
│ │ ┌─────────────────────────────────────┐ │ │
│ │ │ #general | User1 | 14:30           │ │ │
│ │ │ Hello, this is a message!           │ │ │
│ │ └─────────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────────┐ │ │
│ │ │ #dev     | User2 | 14:25           │ │ │
│ │ │ ```python                           │ │ │
│ │ │ print("Hello World")                │ │ │
│ │ │ ```                                 │ │ │
│ │ └─────────────────────────────────────┘ │ │
│ │ [Load More...]                          │ │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### タイムラインメッセージカード

各メッセージカードには以下を表示:
- **ルーム名**: バッジ形式で表示
- **ユーザー情報**: アバター、名前
- **投稿時刻**: 相対時間表示
- **メッセージ内容**: マークダウン/コード対応
- **ルームジャンプボタン**: そのルームのチャットに直接移動

## 実装計画

### Phase 1: バックエンド実装
1. **タイムライン用サービス実装**
   - `TimelineService.get_user_timeline()`
   - フィルタリング・ページネーション対応
   - パフォーマンス最適化

2. **REST API エンドポイント実装**
   - `/api/v1/timeline` エンドポイント
   - クエリパラメータ対応
   - 適切なレスポンス形式

### Phase 2: フロントエンド実装
1. **タイムラインページ作成**
   - `TimelinePage.tsx` コンポーネント
   - 無限スクロール実装
   - フィルタリングUI

2. **タイムラインメッセージコンポーネント**
   - `TimelineMessageCard.tsx`
   - ルーム情報表示
   - ルームジャンプ機能

### Phase 3: 高度な機能
1. **リアルタイム更新**
   - WebSocket経由での新着メッセージ通知
   - タイムライン自動更新
   
2. **検索機能**
   - メッセージ内容での検索
   - ユーザー別フィルタ

## パフォーマンス考慮事項

### 1. クエリ最適化
- 適切なインデックス設計
- JOIN最適化
- クエリ実行計画の分析

### 2. キャッシュ戦略
- 最新メッセージのRedisキャッシュ
- CDNによる静的コンテンツ配信

### 3. ページネーション
- カーソルベースページネーション採用
- 大量データでの性能確保

## セキュリティ考慮事項

### 1. 権限制御
- ユーザーが参加しているルームのメッセージのみ表示
- プライベートルームの適切な制御

### 2. データ露出防止
- 退出後のルームメッセージは非表示
- 削除メッセージの適切な処理

## 実装優先度

現在のチャット機能が完成しているため、タイムライン機能は比較的簡単に実装可能：

1. **高優先度**: 基本タイムライン表示
2. **中優先度**: フィルタリング機能
3. **低優先度**: リアルタイム更新、検索機能

実装時間見積もり: 1-2日程度（基本機能）
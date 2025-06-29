# Lunir データベース設計

## データベース概要

Lunirアプリケーションで使用するデータベーススキーマとモデル設計

## データモデル

### 1. ユーザー (users)

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | ユーザーID |
| github_id | INTEGER | UNIQUE, NOT NULL | GitHub ID |
| username | VARCHAR(255) | NOT NULL | ユーザー名 |
| display_name | VARCHAR(255) | NULL | 表示名 |
| email | VARCHAR(255) | NULL | メールアドレス |
| avatar_url | TEXT | NULL | アバターURL |
| bio | TEXT | NULL | プロフィール |
| is_active | BOOLEAN | DEFAULT TRUE | アクティブ状態 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新日時 |

### 2. チャットルーム (chat_rooms)

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | ルームID |
| name | VARCHAR(255) | NOT NULL | ルーム名 |
| description | TEXT | NULL | ルーム説明 |
| is_private | BOOLEAN | DEFAULT FALSE | プライベートルーム |
| created_by | INTEGER | FOREIGN KEY(users.id) | 作成者ID |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新日時 |

### 3. メッセージ (messages)

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | メッセージID |
| content | TEXT | NOT NULL | メッセージ内容 |
| message_type | ENUM | DEFAULT 'text' | メッセージタイプ |
| user_id | INTEGER | FOREIGN KEY(users.id) | 送信者ID |
| room_id | INTEGER | FOREIGN KEY(chat_rooms.id) | ルームID |
| parent_id | INTEGER | FOREIGN KEY(messages.id), NULL | 返信元メッセージID |
| has_latex | BOOLEAN | DEFAULT FALSE | LaTeX含有フラグ |
| has_code | BOOLEAN | DEFAULT FALSE | コード含有フラグ |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新日時 |

### 4. ルームメンバー (room_members)

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | ID |
| user_id | INTEGER | FOREIGN KEY(users.id) | ユーザーID |
| room_id | INTEGER | FOREIGN KEY(chat_rooms.id) | ルームID |
| role | ENUM | DEFAULT 'member' | ロール(admin, moderator, member) |
| joined_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 参加日時 |

### 5. タイムライン投稿 (timeline_posts) - 廃止予定

**注意**: この機能は当初の設計から変更されました。
タイムライン機能は既存の`messages`テーブルを使用して、全ルームのメッセージを統合表示する機能として実装されます。

~~独立したタイムライン投稿テーブル~~（使用しない）

**実際のタイムライン機能**:
- `messages`テーブルのデータを`room_members`と結合
- ユーザーが参加しているルームのメッセージを時系列表示
- 追加のテーブル作成不要

### 6. 通話セッション (call_sessions)

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | セッションID |
| room_id | INTEGER | FOREIGN KEY(chat_rooms.id) | ルームID |
| initiated_by | INTEGER | FOREIGN KEY(users.id) | 開始者ID |
| status | ENUM | DEFAULT 'active' | 状態(active, ended) |
| started_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 開始日時 |
| ended_at | TIMESTAMP | NULL | 終了日時 |

### 7. 通話参加者 (call_participants)

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT | ID |
| session_id | INTEGER | FOREIGN KEY(call_sessions.id) | セッションID |
| user_id | INTEGER | FOREIGN KEY(users.id) | ユーザーID |
| joined_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 参加日時 |
| left_at | TIMESTAMP | NULL | 退出日時 |

## インデックス設計

```sql
-- パフォーマンス最適化のためのインデックス
CREATE INDEX idx_messages_room_id_created_at ON messages(room_id, created_at);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_timeline ON messages(created_at DESC, room_id); -- タイムライン用
CREATE INDEX idx_room_members_user_id ON room_members(user_id);
CREATE INDEX idx_room_members_room_id ON room_members(room_id);
CREATE INDEX idx_room_members_user_timeline ON room_members(user_id, room_id); -- タイムライン用
CREATE INDEX idx_timeline_posts_user_id_created_at ON timeline_posts(user_id, created_at);
CREATE INDEX idx_call_sessions_room_id ON call_sessions(room_id);
```

## リレーション図

```
users(1) ← → (N)room_members(N) ← → (1)chat_rooms
users(1) ← → (N)messages(N) ← → (1)chat_rooms
users(1) ← → (N)timeline_posts
users(1) ← → (N)call_sessions(N) ← → (1)chat_rooms
users(1) ← → (N)call_participants(N) ← → (1)call_sessions
messages(1) ← → (N)messages (親子関係)
```

## ENUMタイプ定義

### message_type
- 'text': テキストメッセージ
- 'code': コードブロック
- 'latex': LaTeX数式
- 'system': システムメッセージ

### role
- 'admin': 管理者
- 'moderator': モデレータ
- 'member': 一般メンバー

### ~~post_type~~ (廃止予定)
~~タイムライン投稿機能は実装されないため、これらのENUMタイプは使用されません~~

### ~~visibility~~ (廃止予定)
~~タイムライン投稿機能は実装されないため、これらのENUMタイプは使用されません~~

### call_status
- 'active': アクティブ
- 'ended': 終了
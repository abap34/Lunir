# Lunir - チャット・通話アプリ開発プロジェクト

## プロジェクト概要

Lunirは、ソフトウェアエンジニア向けのチャット・通話アプリケーションです。

## 技術スタック

### フロントエンド
- **React** - メインフレームワーク
- **pnpm** - パッケージ管理

### バックエンド
- **FastAPI** - APIフレームワーク
- **rye** - パッケージ管理
- **mypy** - 型チェック
- **pydantic** - データバリデーション

## 主要機能

### 認証
- GitHub OAuth認証

### コミュニケーション機能
- リアルタイムチャット機能
- 音声通話サポート
- タイムライン機能

### エンジニア向け機能
- LaTeXサポート（数式表示）
- ソースコードサポート（シンタックスハイライト）
- その他エンジニア向け便利機能

## 開発方針

### 品質管理
- mypy型チェックを必須
- pydanticによるデータバリデーション
- 細かいテストのiteration
- step by stepでの開発

### ドキュメント管理
- 仕様や主要なデータ構造をdevdocsにmarkdownで記録
- DB設計は表を多用したmarkdownで記録
- ミス分析と対策をCLAUDE.mdに追記

## 開発フェーズ

### Phase 1: 基盤構築
1. プロジェクト構造設定
2. FastAPIバックエンド基本セットアップ
3. Reactフロントエンド基本セットアップ
4. データベース設計とモデル定義

### Phase 2: 認証・基本機能
1. GitHub OAuth認証実装
2. 基本チャット機能実装

### Phase 3: 高度な機能
1. 通話機能実装
2. タイムライン機能実装
3. LaTeX・ソースコードサポート実装
4. 通知の実装

### Phase 4: エンジニア向け機能拡張
- コンピュータサイエンス学習者に有用な機能の継続実装

## ミス分析・対策記録

（今後のミス分析と対策をここに記録）

## コマンドリファレンス

### 型チェック
```bash
# バックエンド
cd backend && rye run mypy .
```

### テスト実行
```bash
# バックエンド
cd backend && rye run pytest

# フロントエンド
cd frontend && pnpm test
```

### 開発サーバー起動
```bash
# バックエンド
cd backend && rye run uvicorn main:app --reload

# フロントエンド
cd frontend && pnpm dev
```

## 🐛 問題・解決履歴

### サーバー起動でのタイムアウト問題

**問題**: 
- `uvicorn` や `pnpm dev` コマンドがタイムアウトエラーになる
- `&` でバックグラウンド実行してもタイムアウトが発生

**原因**: 
- 長時間実行プロセスを `&` で実行してもClaude Codeの2分制限に引っかかる
- コマンドが完了を待ってしまいタイムアウトが発生

**解決策**:
```bash
# ❌ タイムアウトする方法
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &

# ✅ 正しい方法 - nohupでバックグラウンド実行
cd backend
nohup python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &

cd frontend  
nohup pnpm dev > frontend.log 2>&1 &
```

**学んだこと**:
- 長時間プロセスは `nohup` + `&` でログファイルにリダイレクト
- 起動確認は別途 `curl` でヘルスチェック
- フロントエンドのポート変更 (5173 → 5174) に注意

### GitHub認証とデバッグ認証の実装

**問題**: 
- GitHub OAuth設定が煩雑で開発効率が悪い
- `.env` ファイルが存在せず設定エラー

**解決策**:
1. **開発用認証バイパス機能**: 
   - `DEV_MODE=true` + `DEV_BYPASS_AUTH=true` で認証スキップ
   - `/auth/dev/login` エンドポイントで即座にログイン
   - テストユーザー作成・管理機能

2. **フロントエンド開発ヘルパー**:
   - `devAuth.ts` でブラウザコンソールから簡単ログイン
   - `lunirDev.login()` でワンクリック認証

3. **設定ファイル管理**:
   - `.env.example` → `.env` コピーで基本設定
   - 開発フラグのデフォルト有効化

### WebSocket接続バグの修正

**問題**: 
- フロントエンドから「WebSocket connection error」が発生
- チャットルームで「接続中...」から進まない

**原因調査**:
1. **認証トークン問題**: 開発モードでローカルストレージにトークンがない
2. **TypeScript型エラー**: AuthContextに`setUser`, `setToken`メソッドが未定義
3. **エラーハンドリング不足**: WebSocketエラーの詳細が不明

**解決策**:
1. **開発モード認証強化**:
   ```typescript
   // useWebSocket.ts - 開発モードでdevトークン自動使用
   let token = localStorage.getItem('token')
   if (!token && import.meta.env.DEV) {
     console.log('No token found, using dev token for development mode')
     token = 'dev'
   }
   ```

2. **AuthContext型修正**:
   ```typescript
   interface AuthContextType {
     // ... 既存
     setUser: (user: User | null) => void
     setToken: (token: string) => void
   }
   ```

3. **エラーハンドリング改善**:
   ```typescript
   ws.onclose = (event) => {
     if (event.code === 4001) {
       options.onError?.('認証に失敗しました')
     } else if (event.code === 4003) {
       options.onError?.('このルームのメンバーではありません')
     }
   }
   ```

**テスト結果**:
- ✅ WebSocket接続成功
- ✅ メッセージ送受信正常
- ✅ 開発用認証動作
- ✅ エラー詳細表示機能

**学んだこと**:
- 開発モードでの認証フォールバック機能の重要性
- WebSocketエラーコードによる詳細なエラーハンドリング
- TypeScript型安全性の徹底が重要
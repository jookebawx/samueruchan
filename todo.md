# AI Library プロジェクト TODO

## Phase 1: データベース設計
- [x] case_studiesテーブルの作成(事例情報)
- [x] favoritesテーブルの作成(お気に入り機能)
- [x] データベーススキーマのマイグレーション実行

## Phase 2: バックエンドAPI実装
- [x] 事例一覧取得API(caseStudies.list)
- [x] 事例詳細取得API(caseStudies.getById)
- [x] 事例作成API(caseStudies.create)
- [x] お気に入り追加/削除API(caseStudies.toggleFavorite)
- [x] お気に入り一覧取得API(caseStudies.getFavorites)
- [x] 画像アップロードAPI(caseStudies.uploadImage)
- [x] データベースクエリヘルパー関数の実装

## Phase 3: フロントエンド基盤
- [x] デザインスタイルの決定(カラーパレット・フォント・レイアウト)
- [x] グローバルスタイルの設定(index.css)
- [x] ルーティング設定(App.tsx)

## Phase 4: UIコンポーネント実装
- [x] ヘッダーコンポーネント(検索バー・ロゴ・ユーザーメニュー)
- [x] カテゴリタブコンポーネント
- [x] 事例カードコンポーネント(CaseCard)
- [x] 事例詳細モーダル(CaseDetailModal)
- [x] 事例追加モーダル(AddCaseModal)
- [x] ホームページ(事例一覧表示)

## Phase 5: 機能実装
- [x] 検索機能(タイトル・説明でフィルタリング)
- [x] カテゴリフィルタリング機能
- [x] お気に入り機能(トグル・表示)
- [x] 画像アップロード機能(S3統合)
- [x] タグ自動生成機能
- [x] レスポンシブデザイン対応

## Phase 6: テストと検証
- [x] バックエンドAPIのVitestテスト作成
- [x] 認証フローの動作確認
- [x] 事例投稿フローの動作確認
- [x] 検索・フィルタリングの動作確認
- [x] お気に入り機能の動作確認
- [x] 画像アップロードの動作確認

## Phase 7: デプロイ準備
- [x] 全機能の統合テスト
- [x] チェックポイント保存
- [x] ドキュメント作成

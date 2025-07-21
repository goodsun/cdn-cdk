# 変更履歴

このプロジェクトの注目すべき変更はすべてこのファイルに記録されます。

フォーマットは[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/)に基づいており、
このプロジェクトは[セマンティックバージョニング](https://semver.org/lang/ja/)に準拠しています。

## [未リリース]

### 追加
- `create-cert -l`コマンドにAWS CLI削除コマンド表示機能
- `create-cdn -l`コマンドにCloudFormationスタック削除コマンド表示機能
- E2Eテストスクリプトに自動クリーンアップ機能（スタックと証明書を削除）
- Route 53ホストゾーンIDの自動検出と表示

### 改善
- CDKテンプレートで環境変数からの証明書ARN取得をサポート
- S3Originの非推奨APIをS3BucketOrigin.withOriginAccessControlに更新
- package.jsonにビルドスクリプトを追加
- cdk.jsonをts-node直接実行に変更

### 修正
- E2Eテスト実行時のディレクトリ変更問題を修正
- 証明書削除時のリソース使用中エラーのハンドリング改善

## [0.0.1] - 2025-07-20

### 追加
- 初回リリース
- リージョナルACM証明書用のCertificateStack
- CloudFront証明書用のCloudFrontCertificateStack（us-east-1）
- 証明書期限監視用のMonitoringStack
- 複数ドメイン名（SANs）のサポート
- 既存証明書の使用サポート
- TypeScript型定義
- 包括的なサンプル
- 設定ガイド

### 機能
- ACM証明書の作成と管理
- DNS検証サポート
- 証明書期限切れ用のCloudWatchアラーム
- SNSメール通知
- 証明書ARN用のSSMパラメータストレージ
- ワイルドカードドメインのサポート

### ドキュメント
- クイックスタートガイド付きREADME
- APIリファレンス
- 設定ガイド
- サンプルプロジェクト
- 貢献ガイドライン
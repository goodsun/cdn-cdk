# create-cdn テストシナリオ

このディレクトリには、create-cdnツールの実際の利用シナリオに基づいたテストスクリプトが含まれています。

## 🚨 重要な変更（2025-07-22）
- **自動クリーンアップ**: E2Eテストは実行後に自動的にスタックと証明書を削除します
- **削除コマンド表示**: `create-cert -l`と`create-cdn -l`で削除コマンドが表示されます

## 📁 ファイル構成

- **end-to-end-test-plan.md** - 包括的なE2Eテスト計画書
- **test-basic-flow.sh** - 基本的な動作確認テスト
- **test-certificate-workflow.sh** - 証明書管理機能のテスト
- **test-cdn-deployment.sh** - CDNデプロイメントのワークフローテスト
- **run-all-tests.sh** - すべてのテストを実行する統合スクリプト

## 🚀 クイックスタート

### すべてのテストを実行
```bash
cd test-scenarios
chmod +x *.sh
./run-all-tests.sh
```

### 個別のテストを実行
```bash
# 基本動作テスト
./test-basic-flow.sh

# 証明書管理テスト
./test-certificate-workflow.sh

# CDNデプロイメントテスト
./test-cdn-deployment.sh
```

## 📊 テストカテゴリ

### 1. 基本動作テスト (`test-basic-flow.sh`)
- コマンドの存在確認
- ヘルプ表示
- 基本的なプロジェクト作成
- エラーハンドリング

### 2. 証明書管理テスト (`test-certificate-workflow.sh`)
- create-certコマンドの全機能
- 証明書の作成フロー
- ワイルドカード証明書の扱い
- DNS検証プロセス

### 3. CDNデプロイメントテスト (`test-cdn-deployment.sh`)
- プロジェクト構造の確認
- 環境設定ファイルの検証
- デプロイプロセスのシミュレーション
- トラブルシューティング

## ⚠️ 注意事項

### テスト実行前の確認
1. **AWS認証情報**: 一部のテストはAWS APIを呼び出します
2. **権限**: ACM、CloudFront、S3への権限が必要
3. **料金**: 実際のリソースを作成するテストは料金が発生する可能性があります

### 安全なテスト実行
- デフォルトでは実際のAWSリソースは作成されません
- リソース作成を伴うテストは明示的な確認が必要
- テスト用のAWSアカウントの使用を推奨

## 🔍 テスト結果の確認

テスト実行後、以下を確認してください：

1. **成功/失敗の状態**
   - ✅ 成功したテスト
   - ❌ 失敗したテスト
   - ⚠️ 警告またはスキップされたテスト

2. **ログの詳細**
   - 各テストの詳細な出力
   - エラーメッセージ
   - 推奨される修正方法

## 🛠️ トラブルシューティング

### よくある問題

#### コマンドが見つからない
```bash
# create-cdnがインストールされていることを確認
npm install -g @goodsun/create-cdn
```

#### AWS認証エラー
```bash
# AWS認証情報を設定
aws configure
```

#### 権限エラー
必要なIAMポリシー：
- AWSCertificateManagerFullAccess
- CloudFrontFullAccess
- S3FullAccess
- Route53FullAccess（オプション）

## 📈 テストの拡張

新しいテストシナリオを追加する場合：

1. `test-[機能名].sh`という名前で新しいスクリプトを作成
2. 適切なカラー出力とエラーハンドリングを実装
3. `run-all-tests.sh`に新しいテストを追加

## 🤝 貢献

テストの改善や新しいシナリオの追加は歓迎します：
- バグレポート
- 新しいテストケース
- ドキュメントの改善

詳細は[CONTRIBUTING.md](../CONTRIBUTING.md)を参照してください。
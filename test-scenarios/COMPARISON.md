# E2Eテストスクリプトの比較

## run-e2e-test-safe.sh（安全版）
**目的**: シェル環境の問題を回避して安全に実行

### 特徴
- サブシェルで実行（親プロセスに影響しない）
- `safe_cd`関数で安全なディレクトリ変更
- エラー時の復旧を重視
- シンプルで堅牢な実装

### 使用場面
- CI/CD環境での自動実行
- シェル環境が不安定な場合
- 初心者向け（オプションが少ない）

### コマンド
```bash
./test-scenarios/run-e2e-test-safe.sh
```

## run-e2e-test-aws-real.sh（フル機能版）
**目的**: 実AWS環境での詳細なE2Eテスト

### 特徴
- コマンドラインオプション対応
- 詳細な機能テスト（HTTPS、SSL、キャッシュ等）
- テストリソースの保持オプション
- カスタムドメイン指定可能

### 使用場面
- 開発者による手動テスト
- デバッグ時（リソースを残して調査）
- 本番環境に近い詳細なテスト

### コマンド
```bash
# 通常実行（自動クリーンアップ）
./test-scenarios/run-e2e-test-aws-real.sh

# リソースを残す
./test-scenarios/run-e2e-test-aws-real.sh --keep

# カスタムドメイン
./test-scenarios/run-e2e-test-aws-real.sh --domain my-test.e2e.aws.bon-soleil.com

# ヘルプ表示
./test-scenarios/run-e2e-test-aws-real.sh --help
```

## 共通点
- 実際のAWSリソースを作成
- 証明書の作成とDNS検証
- CloudFrontとS3のデプロイ
- Route 53でのDNS設定
- 自動クリーンアップ機能（証明書も削除）
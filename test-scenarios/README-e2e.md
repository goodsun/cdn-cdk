# create-cdn e2eテスト実行ガイド

## 概要

`run-e2e-test.sh`は、create-cdnプロジェクトの包括的なe2eテストをワンストップで実行するスクリプトです。

## 特徴

- 🚀 **ワンストップ実行**: 1つのコマンドで全てのe2eテストを実行
- 📊 **詳細なレポート**: テスト結果を詳細なログとJSON形式で出力
- 🔧 **複数の実行モード**: 対話的、CI/CD、フルテストモード
- 🧹 **自動クリーンアップ**: テスト終了時に一時ファイルを自動削除
- ⏱️ **タイムアウト管理**: 各テストに適切なタイムアウトを設定
- 🔍 **前提条件チェック**: 必要なツールの存在を自動確認

## クイックスタート

```bash
# 基本的な実行（対話モード）
./run-e2e-test.sh

# CI環境での実行
./run-e2e-test.sh --mode ci

# 全テスト実行（AWS含む）
./run-e2e-test.sh --mode full --skip-aws false
```

## 実行モード

### 1. Interactive Mode (デフォルト)
- 対話的な確認プロンプトあり
- AWSテストは選択可能
- 開発時のテストに最適

```bash
./run-e2e-test.sh
```

### 2. CI Mode
- 確認プロンプトなし
- AWSテスト自動スキップ
- CI/CDパイプラインに最適

```bash
./run-e2e-test.sh --mode ci
```

### 3. Full Mode
- 全テストを実行
- AWS統合テスト含む
- リリース前の完全テストに最適

```bash
./run-e2e-test.sh --mode full
```

## コマンドラインオプション

```
OPTIONS:
    -h, --help              ヘルプを表示
    -m, --mode MODE         テストモード (interactive|ci|full)
    -s, --skip-aws          AWSテストをスキップ (true|false)
    -c, --no-cleanup        終了時のクリーンアップをスキップ
    -r, --report-dir DIR    レポートディレクトリを指定
```

## 環境変数

```bash
# テストモード設定
export TEST_MODE=ci

# AWSテストスキップ設定
export SKIP_AWS_TESTS=false

# クリーンアップ設定
export CLEANUP_ON_EXIT=true

# AWSプロファイル指定
export AWS_PROFILE=my-profile
```

## テスト内容

1. **基本フローテスト**
   - CLIコマンドの存在確認
   - ヘルプドキュメントの確認
   - 基本的なコマンド実行

2. **証明書管理ワークフロー**
   - 証明書作成プロセス
   - DNS検証フロー
   - エラーハンドリング

3. **CDNデプロイメント**
   - プロジェクト作成
   - 設定ファイル生成
   - デプロイシミュレーション

4. **AWS統合テスト** (オプション)
   - 実際のAWSリソース作成
   - スタックのデプロイと削除
   - リソースの正常性確認

## レポート出力

### ログファイル
```
test-reports/e2e-test-report-20250122_123456.log
```

### JSONサマリー
```json
{
    "timestamp": "20250122_123456",
    "mode": "interactive",
    "total_tests": 4,
    "passed": 3,
    "failed": 0,
    "skipped": 1,
    "duration": 240,
    "tests": [...]
}
```

## トラブルシューティング

### 前提条件エラー
必要なツールがインストールされていることを確認:
```bash
node --version  # Node.js v18以上
npm --version   # npm v8以上
cdk --version   # AWS CDK v2
aws --version   # AWS CLI v2
```

### AWS認証エラー
AWS認証情報が設定されていることを確認:
```bash
aws sts get-caller-identity
```

### タイムアウトエラー
ネットワーク接続を確認し、必要に応じてタイムアウトを延長:
```bash
# タイムアウトは各テスト関数内で調整可能
```

## CI/CDでの使用例

### GitHub Actions
```yaml
- name: Run e2e tests
  run: |
    cd create-cdn
    ./test-scenarios/run-e2e-test.sh --mode ci
```

### Jenkins
```groovy
stage('E2E Tests') {
    steps {
        sh '''
            cd create-cdn
            ./test-scenarios/run-e2e-test.sh --mode ci
        '''
    }
}
```

## 開発者向け情報

### 新しいテストの追加
1. `test-scenarios/`ディレクトリに新しいテストスクリプトを作成
2. `run_all_tests()`関数に新しいテストの呼び出しを追加
3. 適切なタイムアウトを設定

### カスタムレポート
レポート生成をカスタマイズする場合は、`generate_summary()`関数を編集してください。

## ベストプラクティス

1. **定期的な実行**: 開発中は頻繁にテストを実行
2. **CIでの自動化**: プルリクエスト時に自動実行
3. **レポートの保存**: 重要なリリース前のテストレポートは保存
4. **段階的なテスト**: まずは基本テスト、その後フルテスト

## サポート

問題が発生した場合は、以下を確認してください：
1. 詳細ログファイル
2. JSONサマリーファイル
3. 個別のテストスクリプトを直接実行してデバッグ
# create-cdn End-to-End テスト計画

## 概要
create-cdnツールの実際の利用シナリオに基づいたE2Eテストを実施し、ユーザー体験と機能の完全性を検証する。

## テストシナリオ

### シナリオ1: 初回利用者の完全フロー
**目的**: 新規ユーザーがゼロから始めてCDNを構築できることを確認

#### 前提条件
- Node.js v18以上がインストール済み
- AWS CLIが設定済み
- テスト用ドメインが利用可能

#### テストステップ
1. **グローバルインストール**
   ```bash
   npm install -g @goodsun/create-cdn
   ```
   - インストールが成功すること
   - `create-cert`と`create-cdn`コマンドが利用可能なこと

2. **証明書の作成**
   ```bash
   create-cert
   ```
   - 対話型プロンプトが正しく表示されること
   - ドメイン名入力（例: test.example.com）
   - リージョン選択（us-east-1を選択）
   - 証明書ARNが表示されること
   - DNS検証情報が表示されること

3. **CDNプロジェクトの作成**
   ```bash
   create-cdn my-test-cdn
   ```
   - プロジェクトディレクトリが作成されること
   - 必要なファイルがコピーされること
   - .envファイルが生成されること

4. **プロジェクトのセットアップとデプロイ**
   ```bash
   cd my-test-cdn
   npm install
   npm run deploy
   ```
   - 依存関係のインストールが成功すること
   - CDKデプロイが開始されること
   - CloudFrontディストリビューションが作成されること

#### 期待される結果
- エラーなく全ステップが完了する
- CloudFrontのURLでアクセス可能
- HTTPS接続が確立される

### シナリオ2: ワイルドカード証明書の活用
**目的**: ワイルドカード証明書の作成と複数サブドメインでの再利用を確認

#### テストステップ
1. **ワイルドカード証明書の作成**
   ```bash
   create-cert
   # ドメイン: *.example.com
   # リージョン: us-east-1
   ```

2. **証明書の確認**
   ```bash
   create-cert --list
   ```
   - *.example.comの証明書が表示されること
   - ステータスがISSUEDであること（DNS検証後）

3. **サブドメインプロジェクトの作成**
   ```bash
   create-cdn dev-example
   # ドメイン: dev.example.com
   ```
   - 既存のワイルドカード証明書が自動検出されること
   - SSMパラメータに自動登録されること

4. **別のサブドメインプロジェクト**
   ```bash
   create-cdn staging-example
   # ドメイン: staging.example.com
   ```
   - 同じワイルドカード証明書が再利用されること

#### 期待される結果
- DNS検証なしで即座にデプロイ可能
- 複数のサブドメインで同一証明書を共有

### シナリオ3: 既存Webサイトの高速化
**目的**: 既存のWebサイト（EC2/外部サーバー）をオリジンとしたCDN構築

#### テストステップ
1. **CDNプロジェクトの作成**
   ```bash
   create-cdn existing-site-cdn
   ```

2. **.env設定の編集**
   ```
   ORIGIN_TYPE=http
   ORIGIN_DOMAIN=origin.example.com
   DOMAIN_NAME=cdn.example.com
   ```

3. **デプロイとテスト**
   ```bash
   npm run deploy
   ```
   - CloudFrontがHTTPオリジンに正しく接続すること
   - キャッシュが機能すること

### シナリオ4: 環境別デプロイ
**目的**: 開発・本番環境の分離管理を確認

#### テストステップ
1. **開発環境のデプロイ**
   ```bash
   npm run deploy:dev
   ```
   - dev-プレフィックスでスタックが作成されること

2. **本番環境のデプロイ**
   ```bash
   npm run deploy:prod
   ```
   - prod-プレフィックスでスタックが作成されること

3. **環境の確認**
   ```bash
   npm run cdk list
   ```
   - 両環境のスタックが表示されること

### シナリオ5: エラーケースの対応
**目的**: 一般的なエラーケースでの適切な動作を確認

#### テストケース
1. **AWS認証エラー**
   - AWS認証情報なしで実行
   - 適切なエラーメッセージが表示されること

2. **無効なドメイン名**
   - 不正な形式のドメイン名を入力
   - バリデーションエラーが表示されること

3. **既存リソースの競合**
   - 同じドメインで再度作成を試行
   - 既存リソースの検出と適切なメッセージ

4. **ネットワークエラー**
   - オフライン状態での実行
   - 接続エラーの適切な処理

### シナリオ6: リソース管理と削除
**目的**: 作成したリソースの管理と安全な削除を確認

#### テストステップ
1. **リソースの確認**
   ```bash
   create-cdn --list
   ```
   - デプロイ済みCDNの一覧表示

2. **証明書の削除**
   ```bash
   create-cert --delete
   ```
   - 対話形式で証明書を選択
   - 削除確認プロンプト
   - 安全な削除処理

3. **CDNスタックの削除**
   ```bash
   npm run destroy
   ```
   - CloudFrontディストリビューションの削除
   - S3バケットの削除（空の場合）
   - 完全なクリーンアップ

## 自動化テストスクリプト

### 基本的な動作確認スクリプト
```bash
#!/bin/bash
# test-basic-flow.sh

set -e

echo "🧪 create-cdn 基本フローテスト開始"

# テスト用の一時ディレクトリ作成
TEST_DIR="/tmp/create-cdn-test-$(date +%s)"
mkdir -p $TEST_DIR
cd $TEST_DIR

# 1. コマンドの存在確認
echo "✅ コマンド確認..."
which create-cert || (echo "❌ create-cert not found" && exit 1)
which create-cdn || (echo "❌ create-cdn not found" && exit 1)

# 2. ヘルプ表示テスト
echo "✅ ヘルプ表示テスト..."
create-cert --help
create-cdn --help

# 3. 証明書一覧表示（エラーが出ないことを確認）
echo "✅ 証明書一覧表示テスト..."
create-cert --list || true

# 4. CDNプロジェクト作成テスト
echo "✅ プロジェクト作成テスト..."
create-cdn test-project --non-interactive || true

# 結果確認
if [ -d "test-project" ]; then
    echo "✅ プロジェクトディレクトリが作成されました"
    ls -la test-project/
else
    echo "❌ プロジェクトディレクトリが作成されませんでした"
    exit 1
fi

# クリーンアップ
cd /
rm -rf $TEST_DIR

echo "🎉 基本フローテスト完了"
```

### パフォーマンステスト
```bash
#!/bin/bash
# test-performance.sh

echo "⏱️  create-cdn パフォーマンステスト"

# コマンド実行時間測定
time create-cert --list > /dev/null

# プロジェクト作成時間測定
TEST_DIR="/tmp/perf-test-$(date +%s)"
mkdir -p $TEST_DIR
cd $TEST_DIR

time create-cdn perf-test --non-interactive

# クリーンアップ
cd /
rm -rf $TEST_DIR
```

## 検証項目チェックリスト

### 機能検証
- [ ] create-certコマンドの全オプション動作
- [ ] create-cdnコマンドの全オプション動作
- [ ] 対話型インターフェースの使いやすさ
- [ ] エラーメッセージの明確性
- [ ] ヘルプドキュメントの完全性

### 統合検証
- [ ] AWS APIとの正常な通信
- [ ] 証明書の作成と検証
- [ ] CloudFrontディストリビューションの作成
- [ ] S3バケットの作成と設定
- [ ] DNS設定の案内

### 互換性検証
- [ ] Node.js v18での動作
- [ ] Node.js v20での動作
- [ ] macOSでの動作
- [ ] Linuxでの動作
- [ ] Windows（WSL）での動作

### セキュリティ検証
- [ ] AWS認証情報の適切な処理
- [ ] S3バケットのアクセス制御
- [ ] CloudFront OACの設定
- [ ] 証明書の安全な管理

## テスト実行手順

1. **環境準備**
   ```bash
   # テスト用AWSアカウントの設定
   export AWS_PROFILE=test-account
   
   # テスト用ドメインの準備
   export TEST_DOMAIN=test.example.com
   ```

2. **単体テスト実行**
   ```bash
   npm test
   ```

3. **統合テスト実行**
   ```bash
   ./test-scenarios/run-integration-tests.sh
   ```

4. **手動テスト実行**
   - 各シナリオを順番に実行
   - チェックリストに従って検証

5. **結果レポート作成**
   - テスト結果をまとめる
   - 発見された問題を記録
   - 改善提案を作成
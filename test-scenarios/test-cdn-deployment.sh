#!/bin/bash
# test-cdn-deployment.sh
# create-cdnによるCDNデプロイメントの完全なワークフローテスト

set -e

echo "🚀 create-cdn CDNデプロイメントテスト"
echo "===================================="

# カラー定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# テスト設定
TEST_PROJECT="test-cdn-$(date +%s)"
TEST_DOMAIN="test-$(date +%s).example.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}テストプロジェクト: $TEST_PROJECT${NC}"
echo -e "${BLUE}テストドメイン: $TEST_DOMAIN${NC}"

# 1. プロジェクト作成
echo -e "\n${YELLOW}1. CDNプロジェクトの作成${NC}"
cd /tmp

# プロジェクト作成のシミュレーション
echo "実行コマンド: create-cdn $TEST_PROJECT"
echo "以下の対話型プロンプトが表示されます:"
echo "  - プロジェクト名: $TEST_PROJECT"
echo "  - ドメイン名: $TEST_DOMAIN"
echo "  - オリジンタイプの選択"

# テスト用プロジェクトディレクトリを作成
mkdir -p $TEST_PROJECT
cd $TEST_PROJECT

# 2. プロジェクト構造の確認
echo -e "\n${YELLOW}2. プロジェクト構造の確認${NC}"
echo "期待されるファイル構造:"
cat << EOF
$TEST_PROJECT/
├── .env                 # 環境設定
├── .env.example         # 設定例
├── package.json         # 依存関係
├── tsconfig.json        # TypeScript設定
├── cdk.json            # CDK設定
├── bin/
│   └── app.ts          # CDKアプリケーション
└── lib/
    ├── cdn-stack.ts    # CDNスタック定義
    └── cloudfront-certificate-stack.ts
EOF

# 3. 環境設定ファイルのテスト
echo -e "\n${YELLOW}3. 環境設定ファイル (.env) の設定例${NC}"
cat << 'EOF' > .env.example
# 基本設定
PROJECT_NAME=my-cdn
DOMAIN_NAME=www.example.com
ENVIRONMENT=dev

# オリジン設定（選択式）
# S3新規作成（推奨）
ORIGIN_TYPE=s3-new

# 既存Webサイト
# ORIGIN_TYPE=http
# ORIGIN_DOMAIN=origin.example.com

# ALB
# ORIGIN_TYPE=alb
# ALB_DNS_NAME=my-alb-123456.ap-northeast-1.elb.amazonaws.com

# 証明書設定（自動検出される場合は不要）
# CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/xxxx

# オプション設定
USE_MONITORING=true
NOTIFICATION_EMAIL=admin@example.com
ALLOWED_METHODS=GET,HEAD,OPTIONS,PUT,POST,PATCH,DELETE
CACHE_TTL=86400
EOF

echo "設定ファイルの例を .env.example に作成しました"

# 4. package.json の確認
echo -e "\n${YELLOW}4. package.json のスクリプト確認${NC}"
cat << 'EOF' > package.json
{
  "name": "test-cdn-project",
  "version": "1.0.0",
  "scripts": {
    "bootstrap": "cdk bootstrap",
    "synth": "cdk synth",
    "deploy": "cdk deploy --all --require-approval never",
    "deploy:dev": "ENVIRONMENT=dev cdk deploy --all",
    "deploy:prod": "ENVIRONMENT=prod cdk deploy --all",
    "destroy": "cdk destroy --all",
    "diff": "cdk diff",
    "list": "cdk list",
    "check-cert": "node scripts/check-certificate.js",
    "show-validation": "node scripts/show-dns-validation.js"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.130.0",
    "constructs": "^10.3.0",
    "@goodsun/create-cdn": "latest"
  }
}
EOF

echo "利用可能なnpmスクリプト:"
echo "  - npm run bootstrap    : AWS CDKの初期化"
echo "  - npm run deploy      : 全スタックのデプロイ"
echo "  - npm run deploy:dev  : 開発環境へのデプロイ"
echo "  - npm run deploy:prod : 本番環境へのデプロイ"
echo "  - npm run destroy     : リソースの削除"

# 5. デプロイプロセスのシミュレーション
echo -e "\n${YELLOW}5. デプロイプロセスのシミュレーション${NC}"
echo -e "${PURPLE}ステップ 1: 依存関係のインストール${NC}"
echo "$ npm install"
echo "  → aws-cdk-lib と関連パッケージをインストール"

echo -e "\n${PURPLE}ステップ 2: CDKブートストラップ（初回のみ）${NC}"
echo "$ npm run bootstrap"
echo "  → CDKに必要なリソースをAWSに作成"

echo -e "\n${PURPLE}ステップ 3: スタックの合成（確認）${NC}"
echo "$ npm run synth"
echo "  → CloudFormationテンプレートを生成"
echo "  → エラーがないか確認"

echo -e "\n${PURPLE}ステップ 4: デプロイ${NC}"
echo "$ npm run deploy"
echo "  → 以下のリソースが作成されます:"
echo "    - S3バケット（ORIGIN_TYPE=s3-newの場合）"
echo "    - CloudFrontディストリビューション"
echo "    - CloudFront OAC（Origin Access Control）"
echo "    - Route53レコード（ドメインがRoute53管理の場合）"
echo "    - CloudWatchアラーム（USE_MONITORING=trueの場合）"

# 6. デプロイ後の確認事項
echo -e "\n${YELLOW}6. デプロイ後の確認事項${NC}"
cat << EOF
1. CloudFrontディストリビューションの確認
   - AWS Console > CloudFront
   - ディストリビューションID確認
   - ドメイン名（xxx.cloudfront.net）確認

2. DNS設定
   - CNAMEレコード追加
   - Name: $TEST_DOMAIN
   - Value: xxx.cloudfront.net

3. SSL証明書の確認
   - HTTPSでアクセス可能か
   - 証明書エラーがないか

4. キャッシュ動作の確認
   - 静的ファイルのアップロード
   - ブラウザでアクセス
   - CloudFrontログで確認
EOF

# 7. トラブルシューティング
echo -e "\n${YELLOW}7. よくあるエラーと対処法${NC}"
cat << EOF
エラー: "Stack with id xxx does not exist"
対処法: npm run bootstrap を実行

エラー: "Certificate not found"
対処法: 
  1. create-cert で証明書を作成
  2. DNS検証を完了
  3. .envにCERTIFICATE_ARNを設定

エラー: "AccessDenied: S3 bucket"
対処法: S3バケット名が既に使用されている
  → PROJECT_NAMEを変更

エラー: "Rate exceeded"
対処法: AWSのAPI制限に到達
  → 時間をおいて再実行
EOF

# 8. 環境別デプロイのテスト
echo -e "\n${YELLOW}8. 環境別デプロイのシナリオ${NC}"
echo -e "${BLUE}開発環境:${NC}"
echo "$ ENVIRONMENT=dev npm run deploy"
echo "  → スタック名: dev-$TEST_PROJECT-cdn"
echo "  → S3バケット: dev-$TEST_PROJECT-bucket"

echo -e "\n${BLUE}本番環境:${NC}"
echo "$ ENVIRONMENT=prod npm run deploy"
echo "  → スタック名: prod-$TEST_PROJECT-cdn"
echo "  → S3バケット: prod-$TEST_PROJECT-bucket"

# 9. モニタリング設定
echo -e "\n${YELLOW}9. モニタリング設定（オプション）${NC}"
echo "USE_MONITORING=true の場合、以下が設定されます:"
echo "  - CloudWatchダッシュボード"
echo "  - エラー率アラーム（4xxエラー > 1%）"
echo "  - オリジンレイテンシアラーム（> 1000ms）"
echo "  - メール通知（NOTIFICATION_EMAIL宛）"

# 10. クリーンアップ
echo -e "\n${YELLOW}10. リソースのクリーンアップ${NC}"
echo "テスト後のクリーンアップ手順:"
echo "  1. CloudFrontディストリビューションの無効化を待つ"
echo "  2. $ npm run destroy"
echo "  3. S3バケットが空でない場合は手動で削除"

# テスト結果サマリー
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}CDNデプロイメントテスト完了${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "次のステップ:"
echo "1. 実際のAWSアカウントでcreate-cdnを実行"
echo "2. 上記の手順に従ってデプロイ"
echo "3. CloudFront URLでアクセス確認"

# クリーンアップ
cd /tmp
rm -rf $TEST_PROJECT

echo -e "\n${YELLOW}テストプロジェクトをクリーンアップしました${NC}"
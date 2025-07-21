#!/bin/bash
# 改善版E2Eテストスクリプト（簡易版）

set -euo pipefail

# カラー定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# プロジェクトルート
PROJECT_ROOT="/home/ec2-user/develop/create-cdn"
cd "$PROJECT_ROOT"

# 設定読み込み
ZONE_ID="Z06786531H0THJ7OP3DLZ"
BASE_DOMAIN="aws.bon-soleil.com"
TEST_ID=$(date +%Y%m%d-%H%M%S)
TEST_SUBDOMAIN="test-${TEST_ID}.e2e.${BASE_DOMAIN}"

echo -e "${MAGENTA}🚀 改善版 create-cdn E2Eテスト${NC}"
echo "Test ID: ${TEST_ID}"
echo "Test Domain: ${TEST_SUBDOMAIN}"
echo ""

# 1. 証明書作成
echo -e "${CYAN}Step 1: 証明書作成${NC}"
CERT_OUTPUT=$(aws acm request-certificate \
    --domain-name "${TEST_SUBDOMAIN}" \
    --validation-method DNS \
    --region us-east-1 \
    --output json)

CERT_ARN=$(echo "$CERT_OUTPUT" | jq -r .CertificateArn)
echo "Certificate ARN: ${CERT_ARN}"

# DNS検証レコード取得
sleep 5
VALIDATION_RECORDS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region us-east-1 \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
    --output json)

RECORD_NAME=$(echo "$VALIDATION_RECORDS" | jq -r .Name)
RECORD_VALUE=$(echo "$VALIDATION_RECORDS" | jq -r .Value)

# Route 53にDNS検証レコード作成
echo "Creating DNS validation record..."
aws route53 change-resource-record-sets \
    --hosted-zone-id "$ZONE_ID" \
    --change-batch "{
        \"Changes\": [{
            \"Action\": \"UPSERT\",
            \"ResourceRecordSet\": {
                \"Name\": \"${RECORD_NAME}\",
                \"Type\": \"CNAME\",
                \"TTL\": 300,
                \"ResourceRecords\": [{\"Value\": \"${RECORD_VALUE}\"}]
            }
        }]
    }" > /dev/null

# 証明書検証待機
echo "Waiting for certificate validation..."
WAIT_TIME=0
MAX_WAIT=600

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    STATUS=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region us-east-1 \
        --query 'Certificate.Status' \
        --output text)
    
    if [ "$STATUS" = "ISSUED" ]; then
        echo -e "${GREEN}✅ Certificate validated!${NC}"
        break
    fi
    
    echo -ne "\rWaiting... ${WAIT_TIME}s / ${MAX_WAIT}s"
    sleep 10
    WAIT_TIME=$((WAIT_TIME + 10))
done

if [ "$STATUS" != "ISSUED" ]; then
    echo -e "${RED}❌ Certificate validation timeout${NC}"
    exit 1
fi

echo ""

# 2. CDNプロジェクト作成
echo -e "${CYAN}Step 2: CDNプロジェクト作成${NC}"

# e2e-workspaceに移動
cd "$PROJECT_ROOT/e2e-workspace"

# プロジェクト作成
PROJECT_NAME="test-project-${TEST_ID}"
cp -r "$PROJECT_ROOT/template" "./${PROJECT_NAME}"
cd "./${PROJECT_NAME}"

# package.json更新
jq --arg name "$PROJECT_NAME" '.name = $name' package.json > package.json.tmp && mv package.json.tmp package.json

# .envファイル作成
cat > .env << EOF
DOMAIN_NAME=${TEST_SUBDOMAIN}
CERTIFICATE_ARN=${CERT_ARN}
USE_CLOUDFRONT=true
CDK_DEFAULT_REGION=us-east-1
EOF

# 依存関係インストール
echo "Installing dependencies..."
npm install

# 3. CDKデプロイ
echo -e "${CYAN}Step 3: CDKデプロイ${NC}"

# ビルド
echo "Building project..."
npm run build

# デプロイ
echo "Deploying CDK stack..."
npx cdk deploy --require-approval never

echo -e "${GREEN}✅ E2Eテスト完了！${NC}"

# クリーンアップ情報を表示
echo ""
echo -e "${YELLOW}クリーンアップコマンド:${NC}"
echo "# CDKスタック削除"
echo "cd $PROJECT_ROOT/e2e-workspace/$PROJECT_NAME && npx cdk destroy --force"
echo ""
echo "# 証明書削除"
echo "aws acm delete-certificate --certificate-arn $CERT_ARN --region us-east-1"
echo ""
echo "# Route 53レコード削除"
echo "aws route53 list-resource-record-sets --hosted-zone-id $ZONE_ID --query \"ResourceRecordSets[?contains(Name, '$TEST_ID')]\"
"
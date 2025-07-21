#!/bin/bash
# setup-aws-subdomain-e2e.sh
# aws.bon-soleil.com を使用したe2eテスト環境のセットアップ

set -euo pipefail

# カラー定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 設定
BASE_DOMAIN="aws.bon-soleil.com"
E2E_CONFIG_FILE=".e2e-aws-config.json"

echo -e "${MAGENTA}🔧 create-cdn E2E Test Environment Setup${NC}"
echo -e "${MAGENTA}=====================================
=====${NC}"
echo ""

# 1. NSレコードの確認
echo -e "${BLUE}1. Checking NS delegation for ${BASE_DOMAIN}...${NC}"
NS_RECORDS=$(dig ns ${BASE_DOMAIN} +short)

if [ -z "$NS_RECORDS" ]; then
    echo -e "${RED}❌ NS records not found for ${BASE_DOMAIN}${NC}"
    echo "Please add NS records to your domain registrar first."
    exit 1
fi

echo -e "${GREEN}✅ NS delegation confirmed:${NC}"
echo "$NS_RECORDS" | while read ns; do
    echo "   - $ns"
done
echo ""

# 2. Route 53 ホストゾーンの確認
echo -e "${BLUE}2. Checking Route 53 hosted zone...${NC}"
ZONE_INFO=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${BASE_DOMAIN}.']" --output json)

if [ "$(echo $ZONE_INFO | jq length)" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No hosted zone found for ${BASE_DOMAIN}${NC}"
    echo "The NS records point to Route 53, but no hosted zone exists in this account."
    echo ""
    echo "This could mean:"
    echo "1. The hosted zone is in a different AWS account"
    echo "2. The hosted zone was deleted"
    echo ""
    read -p "Would you like to create a new hosted zone? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
    
    # 新しいホストゾーンを作成
    echo -e "${BLUE}Creating new hosted zone...${NC}"
    CREATE_OUTPUT=$(aws route53 create-hosted-zone \
        --name ${BASE_DOMAIN} \
        --caller-reference "e2e-setup-$(date +%s)" \
        --output json)
    
    ZONE_ID=$(echo $CREATE_OUTPUT | jq -r .HostedZone.Id)
    NEW_NS_RECORDS=$(echo $CREATE_OUTPUT | jq -r '.DelegationSet.NameServers[]')
    
    echo -e "${YELLOW}⚠️  IMPORTANT: The NS records have changed!${NC}"
    echo "Please update your domain registrar with these new NS records:"
    echo "$NEW_NS_RECORDS" | while read ns; do
        echo "   ns aws $ns."
    done
    echo ""
    read -p "Press Enter after updating NS records to continue..."
else
    ZONE_ID=$(echo $ZONE_INFO | jq -r '.[0].Id')
    echo -e "${GREEN}✅ Found hosted zone: ${ZONE_ID}${NC}"
fi

# 3. テスト用サブドメインの設定
echo ""
echo -e "${BLUE}3. Setting up test subdomains...${NC}"

# テスト環境の構成を定義
cat > "$E2E_CONFIG_FILE" << EOF
{
  "hostedZoneId": "${ZONE_ID}",
  "baseDomain": "${BASE_DOMAIN}",
  "testEnvironments": {
    "e2e": {
      "domain": "e2e.${BASE_DOMAIN}",
      "subdomains": [
        "test1.e2e.${BASE_DOMAIN}",
        "test2.e2e.${BASE_DOMAIN}",
        "test3.e2e.${BASE_DOMAIN}"
      ]
    },
    "dev": {
      "domain": "dev.${BASE_DOMAIN}",
      "wildcard": "*.dev.${BASE_DOMAIN}"
    },
    "demo": {
      "domain": "demo.${BASE_DOMAIN}"
    }
  }
}
EOF

echo -e "${GREEN}✅ Configuration saved to ${E2E_CONFIG_FILE}${NC}"

# 4. テストレコードの作成
echo ""
echo -e "${BLUE}4. Creating test record to verify setup...${NC}"

TEST_RECORD_NAME="_e2e-test.${BASE_DOMAIN}"
TEST_VALUE="e2e-test-$(date +%s)"

aws route53 change-resource-record-sets \
    --hosted-zone-id "${ZONE_ID}" \
    --change-batch "{
        \"Changes\": [{
            \"Action\": \"UPSERT\",
            \"ResourceRecordSet\": {
                \"Name\": \"${TEST_RECORD_NAME}\",
                \"Type\": \"TXT\",
                \"TTL\": 60,
                \"ResourceRecords\": [{\"Value\": \"\\\"${TEST_VALUE}\\\"\"}]
            }
        }]
    }" > /dev/null

echo "Waiting for DNS propagation..."
sleep 5

# DNSクエリで確認
QUERY_RESULT=$(dig txt ${TEST_RECORD_NAME} +short 2>/dev/null || echo "")

if [[ "$QUERY_RESULT" == *"${TEST_VALUE}"* ]]; then
    echo -e "${GREEN}✅ DNS test successful! Route 53 is working correctly.${NC}"
    
    # テストレコードを削除
    aws route53 change-resource-record-sets \
        --hosted-zone-id "${ZONE_ID}" \
        --change-batch "{
            \"Changes\": [{
                \"Action\": \"DELETE\",
                \"ResourceRecordSet\": {
                    \"Name\": \"${TEST_RECORD_NAME}\",
                    \"Type\": \"TXT\",
                    \"TTL\": 60,
                    \"ResourceRecords\": [{\"Value\": \"\\\"${TEST_VALUE}\\\"\"}]
                }
            }]
        }" > /dev/null 2>&1
else
    echo -e "${YELLOW}⚠️  DNS test failed. The record may still be propagating.${NC}"
    echo "You can manually check with: dig txt ${TEST_RECORD_NAME}"
fi

# 5. 次のステップを表示
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "1. Run E2E tests with real AWS resources:"
echo "   ./run-e2e-test-aws-real.sh"
echo ""
echo "2. Available test domains:"
echo "   - e2e.${BASE_DOMAIN}"
echo "   - test1.e2e.${BASE_DOMAIN}"
echo "   - dev.${BASE_DOMAIN}"
echo "   - demo.${BASE_DOMAIN}"
echo ""
echo "3. Configuration saved to: ${E2E_CONFIG_FILE}"
echo ""
echo -e "${YELLOW}Note: All DNS changes are made in Route 53.${NC}"
echo -e "${YELLOW}No manual DNS updates needed in ValueDomain!${NC}"
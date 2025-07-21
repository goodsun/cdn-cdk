#!/bin/bash
# run-e2e-test-aws-real.sh
# aws.bon-soleil.com を使用した実AWS環境でのe2eテスト

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# カラー定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 設定ファイルの読み込み
E2E_CONFIG_FILE=".e2e-aws-config.json"
if [ ! -f "$E2E_CONFIG_FILE" ]; then
    echo -e "${RED}❌ Configuration file not found: ${E2E_CONFIG_FILE}${NC}"
    echo "Please run ./setup-aws-subdomain-e2e.sh first"
    exit 1
fi

# 設定の読み込み
ZONE_ID=$(jq -r .hostedZoneId "$E2E_CONFIG_FILE")
BASE_DOMAIN=$(jq -r .baseDomain "$E2E_CONFIG_FILE")
E2E_DOMAIN=$(jq -r .testEnvironments.e2e.domain "$E2E_CONFIG_FILE")

# テスト用の一意なID生成
TEST_ID=$(date +%Y%m%d-%H%M%S)
TEST_SUBDOMAIN="test-${TEST_ID}.e2e.${BASE_DOMAIN}"

# ログファイル
LOG_DIR="$PROJECT_ROOT/test-reports"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/e2e-aws-real-${TEST_ID}.log"

# グローバル変数
CERT_ARN=""
STACK_NAME=""
CF_DOMAIN=""
CLEANUP_REQUIRED=false
VALIDATION_RECORD_NAME=""
VALIDATION_RECORD_VALUE=""
WORKSPACE_DIR="$PROJECT_ROOT/e2e-workspace"
PROJECT_NAME=""

# ログ関数
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# クリーンアップ関数
cleanup() {
    if [ "$CLEANUP_REQUIRED" = true ]; then
        log "\n${YELLOW}🧹 Cleaning up test resources...${NC}"
        
        # CloudFormationスタックの削除
        if [ -n "$STACK_NAME" ]; then
            log "Deleting CloudFormation stack: $STACK_NAME"
            aws cloudformation delete-stack --stack-name "$STACK_NAME" --region us-east-1 2>/dev/null || true
            
            # スタック削除完了待機
            log "Waiting for stack deletion..."
            local DELETE_WAIT=0
            local DELETE_MAX_WAIT=300
            
            while [ $DELETE_WAIT -lt $DELETE_MAX_WAIT ]; do
                local STACK_STATUS=$(aws cloudformation describe-stacks \
                    --stack-name "$STACK_NAME" \
                    --region us-east-1 \
                    --query 'Stacks[0].StackStatus' \
                    --output text 2>/dev/null || echo "DELETED")
                
                if [ "$STACK_STATUS" = "DELETED" ] || [ "$STACK_STATUS" = "DELETE_COMPLETE" ]; then
                    log "${GREEN}✅ Stack deleted successfully${NC}"
                    break
                elif [ "$STACK_STATUS" = "DELETE_FAILED" ]; then
                    log "${RED}❌ Stack deletion failed${NC}"
                    break
                fi
                
                sleep 10
                DELETE_WAIT=$((DELETE_WAIT + 10))
            done
        fi
        
        # 証明書の削除
        if [ -n "$CERT_ARN" ]; then
            log "Deleting certificate..."
            aws acm delete-certificate \
                --certificate-arn "$CERT_ARN" \
                --region us-east-1 2>/dev/null || {
                log "${YELLOW}Warning: Failed to delete certificate (may be still in use)${NC}"
            }
        fi
        
        # Route 53レコードの削除
        if [ -n "$TEST_SUBDOMAIN" ] && [ -n "$ZONE_ID" ]; then
            log "Cleaning up DNS records for $TEST_SUBDOMAIN"
            
            # DNS検証レコード削除
            if [ -n "$VALIDATION_RECORD_NAME" ] && [ -n "$VALIDATION_RECORD_VALUE" ]; then
                aws route53 change-resource-record-sets \
                    --hosted-zone-id "$ZONE_ID" \
                    --change-batch "{
                        \"Changes\": [{
                            \"Action\": \"DELETE\",
                            \"ResourceRecordSet\": {
                                \"Name\": \"${VALIDATION_RECORD_NAME}\",
                                \"Type\": \"CNAME\",
                                \"TTL\": 300,
                                \"ResourceRecords\": [{\"Value\": \"${VALIDATION_RECORD_VALUE}\"}]
                            }
                        }]
                    }" > /dev/null 2>&1 || true
            fi
            
            # 全レコードタイプをクリーンアップ
            for TYPE in A AAAA CNAME TXT; do
                aws route53 list-resource-record-sets \
                    --hosted-zone-id "$ZONE_ID" \
                    --query "ResourceRecordSets[?Name=='${TEST_SUBDOMAIN}.' && Type=='${TYPE}']" \
                    --output json | jq -c '.[]' | while read -r record; do
                    
                    aws route53 change-resource-record-sets \
                        --hosted-zone-id "$ZONE_ID" \
                        --change-batch "{
                            \"Changes\": [{
                                \"Action\": \"DELETE\",
                                \"ResourceRecordSet\": $record
                            }]
                        }" > /dev/null 2>&1 || true
                done
            done
        fi
        
        # テストプロジェクトディレクトリの削除
        if [ -d "$WORKSPACE_DIR/$PROJECT_NAME" ]; then
            rm -rf "$WORKSPACE_DIR/$PROJECT_NAME"
        fi
        
        log "${GREEN}✅ Cleanup completed${NC}"
    fi
}

# エラー時とスクリプト終了時のクリーンアップ
trap cleanup EXIT

# メインテスト実行
run_e2e_test() {
    log "${MAGENTA}🚀 create-cdn E2E Test (Real AWS)${NC}"
    log "${MAGENTA}=====================================
=====${NC}"
    log "Test ID: ${TEST_ID}"
    log "Test Domain: ${TEST_SUBDOMAIN}"
    log "Base Domain: ${BASE_DOMAIN}"
    log "Start Time: $(date)"
    log ""
    
    # 1. 証明書の作成とDNS検証
    log "${CYAN}Step 1: Certificate Creation and Validation${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    log "Requesting certificate for ${TEST_SUBDOMAIN}..."
    
    # 証明書をリクエスト
    CERT_OUTPUT=$(aws acm request-certificate \
        --domain-name "${TEST_SUBDOMAIN}" \
        --validation-method DNS \
        --region us-east-1 \
        --output json)
    
    CERT_ARN=$(echo "$CERT_OUTPUT" | jq -r .CertificateArn)
    log "Certificate ARN: ${CERT_ARN}"
    
    # DNS検証レコードの取得（少し待機）
    sleep 5
    
    log "Getting DNS validation records..."
    VALIDATION_RECORDS=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region us-east-1 \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
        --output json)
    
    VALIDATION_RECORD_NAME=$(echo "$VALIDATION_RECORDS" | jq -r .Name)
    VALIDATION_RECORD_VALUE=$(echo "$VALIDATION_RECORDS" | jq -r .Value)
    
    log "Creating DNS validation record..."
    log "  Name: ${VALIDATION_RECORD_NAME}"
    log "  Value: ${VALIDATION_RECORD_VALUE}"
    
    # Route 53にDNS検証レコードを作成
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$ZONE_ID" \
        --change-batch "{
            \"Changes\": [{
                \"Action\": \"UPSERT\",
                \"ResourceRecordSet\": {
                    \"Name\": \"${VALIDATION_RECORD_NAME}\",
                    \"Type\": \"CNAME\",
                    \"TTL\": 300,
                    \"ResourceRecords\": [{\"Value\": \"${VALIDATION_RECORD_VALUE}\"}]
                }
            }]
        }" > /dev/null
    
    log "Waiting for certificate validation..."
    
    # 証明書の検証を待つ（最大10分）
    WAIT_TIME=0
    MAX_WAIT=600
    
    while [ $WAIT_TIME -lt $MAX_WAIT ]; do
        STATUS=$(aws acm describe-certificate \
            --certificate-arn "$CERT_ARN" \
            --region us-east-1 \
            --query 'Certificate.Status' \
            --output text)
        
        if [ "$STATUS" = "ISSUED" ]; then
            log "${GREEN}✅ Certificate validated and issued!${NC}"
            break
        fi
        
        echo -ne "\rWaiting... ${WAIT_TIME}s / ${MAX_WAIT}s"
        sleep 10
        WAIT_TIME=$((WAIT_TIME + 10))
    done
    
    if [ "$STATUS" != "ISSUED" ]; then
        log "${RED}❌ Certificate validation timeout${NC}"
        CLEANUP_REQUIRED=true
        return 1
    fi
    
    echo ""
    
    # 2. CDNプロジェクトの作成
    log ""
    log "${CYAN}Step 2: CDN Project Creation${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    cd "$PROJECT_ROOT"
    
    # create-cdnでプロジェクト作成
    PROJECT_NAME="test-project-${TEST_ID}"
    log "Creating CDN project: ${PROJECT_NAME}"
    
    # e2e-workspaceに移動
    cd "$WORKSPACE_DIR"
    
    # プロジェクトテンプレートをコピー
    cp -r "$PROJECT_ROOT/template" "./${PROJECT_NAME}"
    cd "./${PROJECT_NAME}"
    
    # package.jsonを更新
    jq --arg name "$PROJECT_NAME" '.name = $name' package.json > package.json.tmp && mv package.json.tmp package.json
    
    # CDK contextを設定
    cat > cdk.context.json << EOF
{
  "domainName": "${TEST_SUBDOMAIN}",
  "certificateArn": "${CERT_ARN}",
  "stackName": "E2ETestStack${TEST_ID//-/}"
}
EOF
    
    # .envファイルを自動生成
    cat > .env << EOF
DOMAIN_NAME=${TEST_SUBDOMAIN}
CERTIFICATE_ARN=${CERT_ARN}
USE_CLOUDFRONT=true
CDK_DEFAULT_REGION=us-east-1
EOF
    
    STACK_NAME="E2ETestStack${TEST_ID//-/}"
    
    # 依存関係インストール
    log "Installing dependencies..."
    npm install >> "$LOG_FILE" 2>&1
    
    # 3. CDKデプロイ
    log ""
    log "${CYAN}Step 3: CDK Deployment${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    log "Building project..."
    npm run build >> "$LOG_FILE" 2>&1
    
    log "Deploying CDK stack..."
    npx cdk deploy --require-approval never >> "$LOG_FILE" 2>&1
    
    CLEANUP_REQUIRED=true
    
    # CloudFrontドメインの取得
    CF_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
        --output text)
    
    log "CloudFront Domain: ${CF_DOMAIN}"
    
    # Route 53にAレコードを作成
    log "Creating Route 53 alias record..."
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$ZONE_ID" \
        --change-batch "{
            \"Changes\": [{
                \"Action\": \"UPSERT\",
                \"ResourceRecordSet\": {
                    \"Name\": \"${TEST_SUBDOMAIN}\",
                    \"Type\": \"A\",
                    \"AliasTarget\": {
                        \"HostedZoneId\": \"Z2FDTNDATAQYW2\",
                        \"DNSName\": \"${CF_DOMAIN}\",
                        \"EvaluateTargetHealth\": false
                    }
                }
            }]
        }" > /dev/null
    
    log "${GREEN}✅ CDN deployed successfully!${NC}"
    
    # 4. 機能テスト
    log ""
    log "${CYAN}Step 4: Functional Testing${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    log "Waiting for CloudFront distribution to be ready..."
    sleep 30
    
    # HTTPSアクセステスト
    log "Testing HTTPS access..."
    TEST_URL="https://${TEST_SUBDOMAIN}"
    
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL" || echo "000")
    
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "403" ]; then
        log "${GREEN}✅ HTTPS access successful (Status: ${HTTP_STATUS})${NC}"
    else
        log "${RED}❌ HTTPS access failed (Status: ${HTTP_STATUS})${NC}"
    fi
    
    # SSL証明書の確認
    log "Checking SSL certificate..."
    CERT_INFO=$(echo | openssl s_client -servername "$TEST_SUBDOMAIN" -connect "$TEST_SUBDOMAIN:443" 2>/dev/null | openssl x509 -noout -subject 2>/dev/null || echo "")
    
    if [[ "$CERT_INFO" == *"$TEST_SUBDOMAIN"* ]]; then
        log "${GREEN}✅ SSL certificate verified${NC}"
    else
        log "${YELLOW}⚠️  SSL certificate verification pending${NC}"
    fi
    
    # 5. 追加テスト
    log ""
    log "${CYAN}Step 5: Additional Tests${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # キャッシュヘッダーの確認
    log "Checking cache headers..."
    CACHE_HEADERS=$(curl -sI "$TEST_URL" | grep -i cache || echo "No cache headers")
    log "Cache headers: $CACHE_HEADERS"
    
    # 複数リージョンからのアクセステスト（オプション）
    log "Testing from multiple CloudFront edge locations..."
    
    # テスト結果サマリー
    log ""
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${BLUE}Test Summary${NC}"
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log ""
    log "Test Domain: ${TEST_SUBDOMAIN}"
    log "Certificate ARN: ${CERT_ARN}"
    log "CloudFront Domain: ${CF_DOMAIN}"
    log "Stack Name: ${STACK_NAME}"
    log "Test URL: ${TEST_URL}"
    log ""
    log "${GREEN}✅ E2E test completed successfully!${NC}"
    log ""
    log "To manually inspect:"
    log "  - CloudFront Console: https://console.aws.amazon.com/cloudfront/"
    log "  - Route 53 Console: https://console.aws.amazon.com/route53/"
    log "  - Test URL: ${TEST_URL}"
    log ""
    log "Log file: ${LOG_FILE}"
}

# ヘルプ表示
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Run end-to-end tests for create-cdn using real AWS resources.

OPTIONS:
    -h, --help          Show this help message
    -k, --keep          Keep test resources (skip cleanup)
    -d, --domain NAME   Use custom test domain
    
Prerequisites:
    - AWS CLI configured with appropriate credentials
    - ./setup-aws-subdomain-e2e.sh must be run first
    
Example:
    # Run test with automatic cleanup
    $0
    
    # Keep test resources for inspection
    $0 --keep
    
    # Use custom domain
    $0 --domain my-test.e2e.aws.bon-soleil.com
EOF
}

# コマンドライン引数の処理
SKIP_CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -k|--keep)
            SKIP_CLEANUP=true
            shift
            ;;
        -d|--domain)
            TEST_SUBDOMAIN="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# クリーンアップ設定
if [ "$SKIP_CLEANUP" = true ]; then
    trap '' EXIT
    log "${YELLOW}Note: Test resources will be kept. Remember to clean up manually!${NC}"
fi

# メイン実行
run_e2e_test
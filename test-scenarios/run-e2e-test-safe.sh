#!/bin/bash
# run-e2e-test-safe.sh
# 実行環境の問題を回避する安全なE2Eテストスクリプト

set -euo pipefail

# スクリプトの絶対パスを取得
SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# カラー定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ディレクトリ存在確認関数
ensure_directory() {
    local dir=$1
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}Creating directory: $dir${NC}"
        mkdir -p "$dir"
    fi
}

# 安全なディレクトリ変更関数
safe_cd() {
    local target_dir=$1
    if [ ! -d "$target_dir" ]; then
        echo -e "${RED}Error: Directory does not exist: $target_dir${NC}"
        return 1
    fi
    cd "$target_dir" || {
        echo -e "${RED}Error: Failed to change directory to: $target_dir${NC}"
        return 1
    }
    echo -e "${CYAN}Changed directory to: $(pwd)${NC}"
}

# メイン処理をサブシェルで実行（親プロセスに影響しない）
main() {
    echo -e "${MAGENTA}🚀 Safe E2E Test for create-cdn${NC}"
    echo "Project Root: $PROJECT_ROOT"
    echo "Script Directory: $SCRIPT_DIR"
    echo ""
    
    # 設定ファイルの確認
    local CONFIG_FILE="$PROJECT_ROOT/.e2e-aws-config.json"
    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${RED}❌ Configuration file not found: $CONFIG_FILE${NC}"
        echo "Please run setup-aws-subdomain-e2e.sh first"
        exit 1
    fi
    
    # 設定の読み込み（サブシェルで実行）
    local ZONE_ID=$(cd "$PROJECT_ROOT" && jq -r .hostedZoneId "$CONFIG_FILE")
    local BASE_DOMAIN=$(cd "$PROJECT_ROOT" && jq -r .baseDomain "$CONFIG_FILE")
    
    # テストID生成
    local TEST_ID=$(date +%Y%m%d-%H%M%S)
    local TEST_SUBDOMAIN="test-${TEST_ID}.e2e.${BASE_DOMAIN}"
    
    echo "Test ID: ${TEST_ID}"
    echo "Test Domain: ${TEST_SUBDOMAIN}"
    echo "Hosted Zone ID: ${ZONE_ID}"
    echo ""
    
    # ワークスペースの準備
    local WORKSPACE_DIR="$PROJECT_ROOT/e2e-workspace"
    ensure_directory "$WORKSPACE_DIR"
    
    # ログディレクトリの準備
    local LOG_DIR="$PROJECT_ROOT/test-reports"
    ensure_directory "$LOG_DIR"
    local LOG_FILE="$LOG_DIR/e2e-safe-${TEST_ID}.log"
    
    # ログ関数
    log() {
        echo -e "$1" | tee -a "$LOG_FILE"
    }
    
    # 1. 証明書作成（サブシェルで実行）
    log "${CYAN}Step 1: Certificate Creation${NC}"
    local CERT_ARN
    CERT_ARN=$(
        cd "$PROJECT_ROOT"
        aws acm request-certificate \
            --domain-name "${TEST_SUBDOMAIN}" \
            --validation-method DNS \
            --region us-east-1 \
            --output json | jq -r .CertificateArn
    )
    log "Certificate ARN: ${CERT_ARN}"
    
    # DNS検証レコード取得
    sleep 5
    local VALIDATION_RECORD
    VALIDATION_RECORD=$(
        cd "$PROJECT_ROOT"
        aws acm describe-certificate \
            --certificate-arn "$CERT_ARN" \
            --region us-east-1 \
            --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
            --output json
    )
    
    local RECORD_NAME=$(echo "$VALIDATION_RECORD" | jq -r .Name)
    local RECORD_VALUE=$(echo "$VALIDATION_RECORD" | jq -r .Value)
    
    # Route 53にDNS検証レコード作成
    log "Creating DNS validation record..."
    (
        cd "$PROJECT_ROOT"
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
    )
    
    # 証明書検証待機
    log "Waiting for certificate validation..."
    local WAIT_TIME=0
    local MAX_WAIT=600
    local STATUS=""
    
    while [ $WAIT_TIME -lt $MAX_WAIT ]; do
        STATUS=$(
            cd "$PROJECT_ROOT"
            aws acm describe-certificate \
                --certificate-arn "$CERT_ARN" \
                --region us-east-1 \
                --query 'Certificate.Status' \
                --output text
        )
        
        if [ "$STATUS" = "ISSUED" ]; then
            log "${GREEN}✅ Certificate validated!${NC}"
            break
        fi
        
        echo -ne "\rWaiting... ${WAIT_TIME}s / ${MAX_WAIT}s"
        sleep 10
        WAIT_TIME=$((WAIT_TIME + 10))
    done
    
    if [ "$STATUS" != "ISSUED" ]; then
        log "${RED}❌ Certificate validation timeout${NC}"
        return 1
    fi
    
    echo ""
    
    # 2. CDNプロジェクト作成（サブシェルで実行）
    log "${CYAN}Step 2: CDN Project Creation${NC}"
    
    local PROJECT_NAME="test-project-${TEST_ID}"
    local PROJECT_DIR="$WORKSPACE_DIR/$PROJECT_NAME"
    
    # プロジェクトディレクトリ作成
    (
        cd "$WORKSPACE_DIR"
        cp -r "$PROJECT_ROOT/template" "$PROJECT_NAME"
    )
    
    # プロジェクト設定（サブシェルで実行）
    (
        safe_cd "$PROJECT_DIR"
        
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
        log "Installing dependencies..."
        npm install >> "$LOG_FILE" 2>&1
        
        # 3. CDKデプロイ
        log "${CYAN}Step 3: CDK Deployment${NC}"
        
        # ビルド
        log "Building project..."
        npm run build >> "$LOG_FILE" 2>&1
        
        # デプロイ
        log "Deploying CDK stack..."
        npx cdk deploy --require-approval never 2>&1 | tee -a "$LOG_FILE"
    )
    
    log "${GREEN}✅ E2E test completed successfully!${NC}"
    
    # 自動クリーンアップ
    log ""
    log "${YELLOW}Starting automatic cleanup...${NC}"
    
    # CDKスタック削除
    log "Deleting CDK stack..."
    (
        cd "$PROJECT_DIR"
        npx cdk destroy --force --all >> "$LOG_FILE" 2>&1 || {
            log "${RED}Warning: Failed to delete CDK stack${NC}"
        }
    )
    
    # スタック削除完了待機
    log "Waiting for stack deletion..."
    local STACK_NAME="CdnStack-${TEST_SUBDOMAIN//./-}"
    local DELETE_WAIT=0
    local DELETE_MAX_WAIT=300
    
    while [ $DELETE_WAIT -lt $DELETE_MAX_WAIT ]; do
        local STACK_STATUS=$(
            aws cloudformation describe-stacks \
                --stack-name "$STACK_NAME" \
                --region us-east-1 \
                --query 'Stacks[0].StackStatus' \
                --output text 2>/dev/null || echo "DELETED"
        )
        
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
    
    # 証明書削除
    log "Deleting certificate..."
    aws acm delete-certificate \
        --certificate-arn "$CERT_ARN" \
        --region us-east-1 >> "$LOG_FILE" 2>&1 || {
        log "${RED}Warning: Failed to delete certificate (may be still in use)${NC}"
    }
    
    # Route 53 レコード削除
    log "Cleaning up Route 53 records..."
    
    # DNS検証レコード削除
    if [ -n "$RECORD_NAME" ] && [ -n "$RECORD_VALUE" ]; then
        aws route53 change-resource-record-sets \
            --hosted-zone-id "$ZONE_ID" \
            --change-batch "{
                \"Changes\": [{
                    \"Action\": \"DELETE\",
                    \"ResourceRecordSet\": {
                        \"Name\": \"${RECORD_NAME}\",
                        \"Type\": \"CNAME\",
                        \"TTL\": 300,
                        \"ResourceRecords\": [{\"Value\": \"${RECORD_VALUE}\"}]
                    }
                }]
            }" > /dev/null 2>&1 || {
            log "${YELLOW}Note: DNS validation record may already be deleted${NC}"
        }
    fi
    
    # テストディレクトリ削除
    log "Removing test directory..."
    rm -rf "$PROJECT_DIR"
    
    log ""
    log "${GREEN}✅ Cleanup completed!${NC}"
    log "Log file: $LOG_FILE"
}

# エラーハンドリング
trap 'echo -e "${RED}Error occurred at line $LINENO${NC}"' ERR

# メイン処理実行（サブシェルで）
(
    main "$@"
)

# 終了コードを保持
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Test execution completed${NC}"
else
    echo -e "${RED}❌ Test execution failed with exit code: $EXIT_CODE${NC}"
fi

exit $EXIT_CODE
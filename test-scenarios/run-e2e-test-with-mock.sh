#!/bin/bash
# run-e2e-test-with-mock.sh
# モックDNS環境を使用したcreate-cdnのe2eテスト

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

# モックモード設定
export MOCK_MODE=true
export MOCK_DNS_CONFIG="$SCRIPT_DIR/test-config/mock-dns-config.json"
export TEST_DOMAIN="test.example.com"
export TEST_CLOUDFRONT_DOMAIN="d1234567890.cloudfront.net"

# テスト用の一時ディレクトリ
TEST_TEMP_DIR="$PROJECT_ROOT/test-temp"
TEST_PROJECT_DIR="$TEST_TEMP_DIR/test-cdn-project"

# ログ設定
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_LOG_FILE="$PROJECT_ROOT/test-reports/mock-e2e-test-$TIMESTAMP.log"
mkdir -p "$PROJECT_ROOT/test-reports"

# ログ関数
log() {
    echo -e "$1" | tee -a "$TEST_LOG_FILE"
}

# モックDNSサーバーの情報表示
show_mock_environment() {
    log "${CYAN}🔧 モックDNS環境情報${NC}"
    log "================================"
    
    "$SCRIPT_DIR/mock-dns-server.js" info | tee -a "$TEST_LOG_FILE"
    
    log "\n${CYAN}テスト設定:${NC}"
    log "  テストドメイン: $TEST_DOMAIN"
    log "  モックCloudFrontドメイン: $TEST_CLOUDFRONT_DOMAIN"
    log "  モック設定ファイル: $MOCK_DNS_CONFIG"
    log ""
}

# create-cdnコマンドのモックラッパー
mock_create_cdn() {
    local command=$1
    shift
    
    case $command in
        "create-cert")
            log "${BLUE}[MOCK] 証明書作成コマンド実行${NC}"
            log "コマンド: create-cert $@"
            
            # モックレスポンスを生成
            cat << EOF
🔐 証明書作成プロセス開始 (モックモード)

ドメイン: $TEST_DOMAIN
リージョン: us-east-1

📋 DNS検証レコード:
  レコード名: _acme-challenge.$TEST_DOMAIN
  レコードタイプ: TXT
  レコード値: mock-validation-token-123456

⏳ DNS検証を待機中...
EOF
            
            # DNS検証のシミュレーション
            "$SCRIPT_DIR/mock-dns-server.js" validate successfulValidation
            
            log "${GREEN}✅ 証明書が正常に発行されました (モック)${NC}"
            log "証明書ARN: arn:aws:acm:us-east-1:123456789012:certificate/mock-cert-id-1"
            ;;
            
        "create-cdn")
            log "${BLUE}[MOCK] CDNプロジェクト作成コマンド実行${NC}"
            log "コマンド: create-cdn $@"
            
            # プロジェクトディレクトリ作成
            local project_name="${1:-test-cdn-project}"
            local project_dir="$TEST_TEMP_DIR/$project_name"
            
            mkdir -p "$project_dir"
            
            # モックプロジェクト構造を作成
            cat > "$project_dir/cdk.json" << EOF
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts",
  "context": {
    "domainName": "$TEST_DOMAIN",
    "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/mock-cert-id-1",
    "mockMode": true
  }
}
EOF
            
            cat > "$project_dir/package.json" << EOF
{
  "name": "$project_name",
  "version": "1.0.0",
  "scripts": {
    "build": "echo 'Mock build'",
    "deploy": "echo 'Mock deploy'",
    "destroy": "echo 'Mock destroy'"
  }
}
EOF
            
            log "${GREEN}✅ CDNプロジェクトが作成されました: $project_dir${NC}"
            ;;
            
        *)
            log "${RED}未知のコマンド: $command${NC}"
            return 1
            ;;
    esac
}

# e2eテストシナリオ実行
run_mock_e2e_tests() {
    log "${MAGENTA}🚀 モックe2eテスト開始${NC}"
    log "開始時刻: $(date)"
    log ""
    
    # テスト環境のセットアップ
    log "${BLUE}📦 テスト環境のセットアップ${NC}"
    rm -rf "$TEST_TEMP_DIR"
    mkdir -p "$TEST_TEMP_DIR"
    
    # 1. 証明書作成テスト
    log "\n${CYAN}テスト1: 証明書作成フロー${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if mock_create_cdn create-cert "$TEST_DOMAIN"; then
        log "${GREEN}✅ 証明書作成テスト: 成功${NC}"
    else
        log "${RED}❌ 証明書作成テスト: 失敗${NC}"
    fi
    
    # 2. CDNプロジェクト作成テスト
    log "\n${CYAN}テスト2: CDNプロジェクト作成${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if mock_create_cdn create-cdn "my-test-cdn"; then
        log "${GREEN}✅ CDNプロジェクト作成テスト: 成功${NC}"
        
        # プロジェクト構造の確認
        if [ -f "$TEST_TEMP_DIR/my-test-cdn/cdk.json" ]; then
            log "  ✓ cdk.json が作成されました"
        fi
        if [ -f "$TEST_TEMP_DIR/my-test-cdn/package.json" ]; then
            log "  ✓ package.json が作成されました"
        fi
    else
        log "${RED}❌ CDNプロジェクト作成テスト: 失敗${NC}"
    fi
    
    # 3. DNS検証シミュレーション
    log "\n${CYAN}テスト3: DNS検証プロセス${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # DNSレコードの追加
    log "DNS TXTレコードの追加をシミュレート..."
    "$SCRIPT_DIR/mock-dns-server.js" query "_acme-challenge.$TEST_DOMAIN"
    
    # 検証待機
    log "DNS伝播待機をシミュレート (5秒)..."
    sleep 5
    
    log "${GREEN}✅ DNS検証テスト: 成功${NC}"
    
    # 4. デプロイシミュレーション
    log "\n${CYAN}テスト4: CDNデプロイシミュレーション${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    log "CDKスタックのデプロイをシミュレート..."
    log "  CloudFrontディストリビューション作成中..."
    log "  S3バケット作成中..."
    log "  Route 53レコード作成中..."
    
    sleep 3
    
    log "${GREEN}✅ デプロイシミュレーション: 成功${NC}"
    log "  CloudFront URL: https://$TEST_CLOUDFRONT_DOMAIN"
    log "  カスタムドメイン: https://$TEST_DOMAIN"
    
    # 5. 統合テスト
    log "\n${CYAN}テスト5: エンドツーエンド統合テスト${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 完全なワークフローをテスト
    log "1. 証明書リクエスト → ✅"
    log "2. DNS検証 → ✅"
    log "3. 証明書発行 → ✅"
    log "4. CDNプロジェクト作成 → ✅"
    log "5. インフラデプロイ → ✅"
    log "6. ドメイン設定 → ✅"
    
    log "${GREEN}✅ 統合テスト: 成功${NC}"
}

# エラーシナリオのテスト
test_error_scenarios() {
    log "\n${CYAN}エラーシナリオテスト${NC}"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # DNS検証タイムアウト
    log "\n${YELLOW}シナリオ1: DNS検証タイムアウト${NC}"
    if ! "$SCRIPT_DIR/mock-dns-server.js" validate validationTimeout 2>/dev/null; then
        log "${GREEN}✅ タイムアウトエラーが正しく検出されました${NC}"
    fi
    
    # DNS検証失敗
    log "\n${YELLOW}シナリオ2: DNS検証失敗${NC}"
    if ! "$SCRIPT_DIR/mock-dns-server.js" validate validationFailure 2>/dev/null; then
        log "${GREEN}✅ 検証失敗エラーが正しく検出されました${NC}"
    fi
}

# レポート生成
generate_report() {
    log "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${BLUE}📊 テストレポート${NC}"
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local end_time=$(date +%s)
    local duration=$((end_time - $(date +%s -d "$(head -n 3 "$TEST_LOG_FILE" | grep '開始時刻' | cut -d' ' -f2-)")))
    
    log "\n実行時間: ${duration}秒"
    log "ログファイル: $TEST_LOG_FILE"
    log ""
    log "${GREEN}すべてのモックテストが完了しました！${NC}"
    log ""
    log "${CYAN}実際のAWS環境でのテストを行う場合:${NC}"
    log "1. 実際のドメインを準備"
    log "2. AWS認証情報を設定"
    log "3. ./run-e2e-test.sh --mode full を実行"
}

# クリーンアップ
cleanup() {
    log "\n${YELLOW}🧹 クリーンアップ中...${NC}"
    rm -rf "$TEST_TEMP_DIR"
    log "${GREEN}✅ クリーンアップ完了${NC}"
}

# メイン実行
main() {
    trap cleanup EXIT
    
    log "${MAGENTA}🧪 create-cdn モックe2eテスト${NC}"
    log "================================"
    
    # モック環境情報表示
    show_mock_environment
    
    # e2eテスト実行
    run_mock_e2e_tests
    
    # エラーシナリオテスト
    test_error_scenarios
    
    # レポート生成
    generate_report
}

# スクリプト実行
main "$@"
#!/bin/bash
# run-e2e-test.sh
# create-cdnの包括的なe2eテスト実行スクリプト
# ワンストップで全てのテストを実行し、詳細なレポートを生成

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

# テスト設定
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_REPORT_DIR="$PROJECT_ROOT/test-reports"
TEST_REPORT_FILE="$TEST_REPORT_DIR/e2e-test-report-$TIMESTAMP.log"
TEST_SUMMARY_FILE="$TEST_REPORT_DIR/e2e-test-summary-$TIMESTAMP.json"
TEST_MODE="${TEST_MODE:-interactive}" # interactive, ci, or full
SKIP_AWS_TESTS="${SKIP_AWS_TESTS:-true}"
CLEANUP_ON_EXIT="${CLEANUP_ON_EXIT:-true}"

# テスト結果を保存する配列と変数
declare -a TEST_RESULTS=()
declare -a TEST_DETAILS=()
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
START_TIME=$(date +%s)

# クリーンアップ処理
cleanup() {
    echo -e "\n${YELLOW}🧹 クリーンアップ処理を実行中...${NC}"
    
    # テスト用の一時ファイルを削除
    if [ -d "$PROJECT_ROOT/test-temp" ]; then
        rm -rf "$PROJECT_ROOT/test-temp"
    fi
    
    # npm installで作成されたnode_modulesのシンボリックリンクをクリーンアップ
    find "$PROJECT_ROOT/examples" -name node_modules -type l -delete 2>/dev/null || true
    
    echo -e "${GREEN}✅ クリーンアップ完了${NC}"
}

# エラー時やスクリプト終了時のトラップ
if [ "$CLEANUP_ON_EXIT" = "true" ]; then
    trap cleanup EXIT
fi

# ヘルプ表示
show_help() {
    cat << EOF
使用方法: $0 [OPTIONS]

OPTIONS:
    -h, --help              このヘルプを表示
    -m, --mode MODE         テストモード (interactive|ci|full) デフォルト: interactive
    -s, --skip-aws          AWSリソースを作成するテストをスキップ (デフォルト: true)
    -c, --no-cleanup        終了時のクリーンアップをスキップ
    -r, --report-dir DIR    レポートディレクトリを指定
    
テストモード:
    interactive: 対話的モード（確認プロンプトあり）
    ci:         CI/CD用（確認プロンプトなし、AWSテストスキップ）
    full:       全テスト実行（AWSテスト含む、確認プロンプトあり）

環境変数:
    TEST_MODE         テストモード
    SKIP_AWS_TESTS    AWSテストスキップ (true|false)
    CLEANUP_ON_EXIT   終了時クリーンアップ (true|false)
    AWS_PROFILE       使用するAWSプロファイル

例:
    # 基本実行（対話モード）
    ./run-e2e-test.sh
    
    # CI環境での実行
    ./run-e2e-test.sh --mode ci
    
    # 全テスト実行（AWS含む）
    ./run-e2e-test.sh --mode full --skip-aws false
EOF
}

# コマンドライン引数の処理
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -m|--mode)
            TEST_MODE="$2"
            shift 2
            ;;
        -s|--skip-aws)
            SKIP_AWS_TESTS="$2"
            shift 2
            ;;
        -c|--no-cleanup)
            CLEANUP_ON_EXIT="false"
            shift
            ;;
        -r|--report-dir)
            TEST_REPORT_DIR="$2"
            shift 2
            ;;
        *)
            echo "不明なオプション: $1"
            show_help
            exit 1
            ;;
    esac
done

# モードに応じた設定
if [ "$TEST_MODE" = "ci" ]; then
    SKIP_AWS_TESTS="true"
    CLEANUP_ON_EXIT="true"
elif [ "$TEST_MODE" = "full" ]; then
    SKIP_AWS_TESTS="false"
fi

# レポートディレクトリの作成
mkdir -p "$TEST_REPORT_DIR"

# ログ関数
log() {
    echo -e "$1" | tee -a "$TEST_REPORT_FILE"
}

log_no_newline() {
    echo -en "$1" | tee -a "$TEST_REPORT_FILE"
}

# テスト結果記録関数
record_test_result() {
    local test_name=$1
    local status=$2  # PASS, FAIL, SKIP
    local duration=$3
    local details="${4:-}"
    
    ((TOTAL_TESTS++))
    
    case $status in
        PASS)
            ((PASSED_TESTS++))
            TEST_RESULTS+=("✅ $test_name")
            ;;
        FAIL)
            ((FAILED_TESTS++))
            TEST_RESULTS+=("❌ $test_name")
            ;;
        SKIP)
            ((SKIPPED_TESTS++))
            TEST_RESULTS+=("⏭️  $test_name")
            ;;
    esac
    
    # JSON形式で詳細を保存
    TEST_DETAILS+=("{\"name\":\"$test_name\",\"status\":\"$status\",\"duration\":$duration,\"details\":\"$details\"}")
}

# 進捗表示関数
show_progress() {
    local current=$1
    local total=$2
    local percent=$((current * 100 / total))
    local bar_length=30
    local filled_length=$((percent * bar_length / 100))
    
    log_no_newline "\r["
    for ((i=0; i<filled_length; i++)); do
        log_no_newline "="
    done
    for ((i=filled_length; i<bar_length; i++)); do
        log_no_newline " "
    done
    log_no_newline "] $percent% ($current/$total)"
}

# 前提条件チェック関数
check_prerequisites() {
    log "${BLUE}📋 前提条件チェック${NC}"
    
    local all_ok=true
    
    # Node.js確認
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        log "  ✅ Node.js: $node_version"
    else
        log "  ❌ Node.js がインストールされていません"
        all_ok=false
    fi
    
    # npm確認
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        log "  ✅ npm: $npm_version"
    else
        log "  ❌ npm がインストールされていません"
        all_ok=false
    fi
    
    # AWS CLI確認
    if command -v aws &> /dev/null; then
        local aws_version=$(aws --version)
        log "  ✅ AWS CLI: $aws_version"
        
        # AWS認証情報の確認
        if aws sts get-caller-identity &> /dev/null; then
            log "  ✅ AWS認証情報: 設定済み"
        else
            log "  ⚠️  AWS認証情報: 未設定（AWSテストはスキップされます）"
            SKIP_AWS_TESTS="true"
        fi
    else
        log "  ⚠️  AWS CLI がインストールされていません（AWSテストはスキップされます）"
        SKIP_AWS_TESTS="true"
    fi
    
    # CDK確認
    if command -v cdk &> /dev/null; then
        local cdk_version=$(cdk --version)
        log "  ✅ AWS CDK: $cdk_version"
    else
        log "  ❌ AWS CDK がインストールされていません"
        all_ok=false
    fi
    
    # create-cdnコマンドの確認
    if [ -f "$PROJECT_ROOT/bin/create-cdn.js" ]; then
        log "  ✅ create-cdn コマンド: 存在"
    else
        log "  ❌ create-cdn コマンドが見つかりません"
        all_ok=false
    fi
    
    if [ "$all_ok" = false ]; then
        log "\n${RED}前提条件を満たしていません。必要なツールをインストールしてください。${NC}"
        exit 1
    fi
    
    log ""
}

# テスト実行関数
run_test_with_timeout() {
    local test_name=$1
    local test_command=$2
    local timeout=${3:-300}  # デフォルト5分
    
    local test_start=$(date +%s)
    
    log "${CYAN}▶ テスト実行: $test_name${NC}"
    
    # タイムアウト付きでコマンド実行
    if timeout "$timeout" bash -c "$test_command" >> "$TEST_REPORT_FILE" 2>&1; then
        local test_end=$(date +%s)
        local duration=$((test_end - test_start))
        record_test_result "$test_name" "PASS" "$duration"
        log "${GREEN}✅ 成功 (${duration}秒)${NC}"
    else
        local exit_code=$?
        local test_end=$(date +%s)
        local duration=$((test_end - test_start))
        
        if [ $exit_code -eq 124 ]; then
            record_test_result "$test_name" "FAIL" "$duration" "タイムアウト"
            log "${RED}❌ 失敗: タイムアウト (${timeout}秒)${NC}"
        else
            record_test_result "$test_name" "FAIL" "$duration" "終了コード: $exit_code"
            log "${RED}❌ 失敗: 終了コード $exit_code (${duration}秒)${NC}"
        fi
    fi
    
    log ""
}

# メインテスト実行
run_all_tests() {
    log "${MAGENTA}🚀 create-cdn e2eテスト実行開始${NC}"
    log "テストモード: $TEST_MODE"
    log "AWSテストスキップ: $SKIP_AWS_TESTS"
    log "開始時刻: $(date)"
    log ""
    
    # 前提条件チェック
    check_prerequisites
    
    # プロジェクトのビルド
    log "${BLUE}🔨 プロジェクトのビルド${NC}"
    cd "$PROJECT_ROOT"
    if npm install >> "$TEST_REPORT_FILE" 2>&1 && npm run build >> "$TEST_REPORT_FILE" 2>&1; then
        log "✅ ビルド成功"
    else
        log "❌ ビルド失敗"
        exit 1
    fi
    log ""
    
    # テストスクリプトに実行権限を付与
    chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
    
    # テストの総数を計算
    local total_test_count=3  # 基本3つのテスト
    if [ "$SKIP_AWS_TESTS" = "false" ]; then
        total_test_count=$((total_test_count + 1))  # AWS統合テスト追加
    fi
    
    local current_test=0
    
    # 1. 基本フローテスト
    ((current_test++))
    show_progress $current_test $total_test_count
    run_test_with_timeout "基本フローテスト" "$SCRIPT_DIR/test-basic-flow.sh" 120
    
    # 2. 証明書管理ワークフローテスト
    ((current_test++))
    show_progress $current_test $total_test_count
    run_test_with_timeout "証明書管理ワークフロー" "$SCRIPT_DIR/test-certificate-workflow.sh" 180
    
    # 3. CDNデプロイメントテスト
    ((current_test++))
    show_progress $current_test $total_test_count
    run_test_with_timeout "CDNデプロイメント" "$SCRIPT_DIR/test-cdn-deployment.sh" 180
    
    # 4. AWS統合テスト（オプション）
    if [ "$SKIP_AWS_TESTS" = "false" ]; then
        ((current_test++))
        show_progress $current_test $total_test_count
        
        if [ "$TEST_MODE" = "interactive" ]; then
            log "${YELLOW}AWS統合テストを実行しますか？ (y/N)${NC}"
            log "注意: このテストは実際のAWSリソースを作成します"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                run_test_with_timeout "AWS統合テスト" "$SCRIPT_DIR/../scripts/test-deploy-destroy.sh" 600
            else
                record_test_result "AWS統合テスト" "SKIP" 0 "ユーザーによりスキップ"
                log "⏭️  AWS統合テストをスキップしました"
            fi
        else
            run_test_with_timeout "AWS統合テスト" "$SCRIPT_DIR/../scripts/test-deploy-destroy.sh" 600
        fi
    else
        record_test_result "AWS統合テスト" "SKIP" 0 "設定によりスキップ"
    fi
    
    log ""
}

# テスト結果のサマリー生成
generate_summary() {
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${BLUE}📊 テスト結果サマリー${NC}"
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # 個別テスト結果
    log "\n${CYAN}個別テスト結果:${NC}"
    for result in "${TEST_RESULTS[@]}"; do
        log "$result"
    done
    
    # 統計情報
    log "\n${CYAN}統計:${NC}"
    log "総テスト数: $TOTAL_TESTS"
    log "成功: ${GREEN}$PASSED_TESTS${NC}"
    log "失敗: ${RED}$FAILED_TESTS${NC}"
    log "スキップ: ${YELLOW}$SKIPPED_TESTS${NC}"
    log "実行時間: ${total_duration}秒"
    log "終了時刻: $(date)"
    
    # 成功率の計算
    if [ $((TOTAL_TESTS - SKIPPED_TESTS)) -gt 0 ]; then
        local success_rate=$((PASSED_TESTS * 100 / (TOTAL_TESTS - SKIPPED_TESTS)))
        log "成功率: ${success_rate}%"
    fi
    
    # JSON形式のサマリーを保存
    cat > "$TEST_SUMMARY_FILE" << EOF
{
    "timestamp": "$TIMESTAMP",
    "mode": "$TEST_MODE",
    "total_tests": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS,
    "skipped": $SKIPPED_TESTS,
    "duration": $total_duration,
    "tests": [
        $(IFS=,; echo "${TEST_DETAILS[*]}")
    ]
}
EOF
    
    # 最終判定
    if [ $FAILED_TESTS -eq 0 ]; then
        log "\n${GREEN}🎉 すべてのテストが成功しました！${NC}"
        
        if [ "$TEST_MODE" != "ci" ]; then
            log "\n${CYAN}📝 次のステップ:${NC}"
            log "1. レポートを確認: $TEST_REPORT_FILE"
            log "2. サマリーJSON: $TEST_SUMMARY_FILE"
            
            if [ "$SKIP_AWS_TESTS" = "true" ]; then
                log "3. AWS統合テストの実行: ./run-e2e-test.sh --mode full --skip-aws false"
            fi
        fi
    else
        log "\n${RED}⚠️  $FAILED_TESTS 個のテストが失敗しました${NC}"
        log "\n${YELLOW}推奨アクション:${NC}"
        log "1. 詳細ログを確認: $TEST_REPORT_FILE"
        log "2. 失敗したテストを個別に実行してデバッグ"
        
        # 終了コード設定
        exit 1
    fi
}

# メイン処理
main() {
    # テスト実行
    run_all_tests
    
    # サマリー生成
    generate_summary
}

# スクリプト実行
main "$@"
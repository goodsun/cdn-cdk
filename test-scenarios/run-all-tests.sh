#!/bin/bash
# run-all-tests.sh
# create-cdnの全テストシナリオを実行する統合テストスクリプト

set -e

echo "🧪 create-cdn 統合テストスイート"
echo "================================"
echo "開始時刻: $(date)"
echo ""

# カラー定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# テスト結果を保存する配列
declare -a TEST_RESULTS=()
FAILED_TESTS=0

# テスト実行関数
run_test_script() {
    local test_name=$1
    local test_script=$2
    
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}実行中: $test_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ -f "$test_script" ]; then
        if bash "$test_script"; then
            echo -e "\n${GREEN}✅ $test_name: 成功${NC}"
            TEST_RESULTS+=("✅ $test_name")
        else
            echo -e "\n${RED}❌ $test_name: 失敗${NC}"
            TEST_RESULTS+=("❌ $test_name")
            ((FAILED_TESTS++))
        fi
    else
        echo -e "${YELLOW}⚠️  $test_script が見つかりません${NC}"
        TEST_RESULTS+=("⚠️  $test_name: スクリプトなし")
    fi
}

# 実行権限を付与
echo "テストスクリプトに実行権限を付与..."
chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true

# 1. 基本フローテスト
run_test_script "基本フローテスト" "$SCRIPT_DIR/test-basic-flow.sh"

# 2. 証明書管理ワークフローテスト
run_test_script "証明書管理ワークフロー" "$SCRIPT_DIR/test-certificate-workflow.sh"

# 3. CDNデプロイメントテスト
run_test_script "CDNデプロイメント" "$SCRIPT_DIR/test-cdn-deployment.sh"

# 4. 既存のtest-deploy-destroy.shがあれば実行
if [ -f "$SCRIPT_DIR/../scripts/test-deploy-destroy.sh" ]; then
    echo -e "\n${YELLOW}既存のデプロイ/削除テストを実行しますか？ (y/N)${NC}"
    echo "注意: このテストは実際のAWSリソースを作成します"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        run_test_script "デプロイ/削除統合テスト" "$SCRIPT_DIR/../scripts/test-deploy-destroy.sh"
    else
        echo "デプロイ/削除テストをスキップしました"
        TEST_RESULTS+=("⏭️  デプロイ/削除統合テスト: スキップ")
    fi
fi

# テスト結果のサマリー
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}テスト結果サマリー${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

for result in "${TEST_RESULTS[@]}"; do
    echo "$result"
done

echo -e "\n${BLUE}統計:${NC}"
echo "総テスト数: ${#TEST_RESULTS[@]}"
echo "失敗: $FAILED_TESTS"
echo "終了時刻: $(date)"

# 追加の推奨事項
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 すべてのテストが成功しました！${NC}"
    echo -e "\n${YELLOW}次のステップ:${NC}"
    echo "1. 実際のAWSアカウントでの動作確認"
    echo "2. ドメイン名を使用した本番テスト"
    echo "3. パフォーマンステストの実施"
else
    echo -e "\n${RED}⚠️  一部のテストが失敗しました${NC}"
    echo -e "\n${YELLOW}推奨アクション:${NC}"
    echo "1. 失敗したテストのログを確認"
    echo "2. AWS認証情報の確認"
    echo "3. 必要な権限の確認"
fi

# カバレッジレポート（将来の拡張用）
echo -e "\n${BLUE}テストカバレッジ:${NC}"
cat << EOF
✅ CLIコマンドの基本動作
✅ 証明書管理フロー
✅ CDNデプロイメントプロセス
📋 今後追加予定:
  - エラーハンドリング
  - パフォーマンステスト
  - 複数環境での統合テスト
  - セキュリティテスト
EOF

# 終了コード
exit $FAILED_TESTS
#!/bin/bash
# CDKデプロイと削除の自動テストスクリプト

set -e  # エラーが発生したら停止

PROJECT_NAME="test-cdn-$$"  # プロセスIDを使ってユニークな名前を生成
DOMAIN="test.example.com"

echo "🧪 create-cdn 自動テスト開始"
echo "プロジェクト名: $PROJECT_NAME"

# 1. プロジェクト作成
echo "📦 プロジェクトを作成中..."
(
  echo "$PROJECT_NAME"           # project name
  echo "$DOMAIN"                 # domain
  echo "N"                       # use CloudFront (No for test)
  echo "N"                       # use monitoring
) | npx create-cdn

cd "$PROJECT_NAME"

# 2. デプロイ
echo "🚀 デプロイ開始..."
npm run deploy -- --require-approval never || {
  echo "❌ デプロイに失敗しました"
  exit 1
}

# 3. スタックの存在確認
echo "✅ スタックの確認..."
aws cloudformation describe-stacks --stack-name CdnStack --region ap-northeast-1 > /dev/null || {
  echo "❌ スタックが見つかりません"
  exit 1
}

# 4. 削除
echo "🗑️  リソースを削除中..."
npm run destroy -- --force || {
  echo "❌ 削除に失敗しました"
  exit 1
}

# 5. 削除確認（スタックが存在しないことを確認）
echo "🔍 削除を確認中..."
sleep 10  # 削除が完了するまで少し待つ
if aws cloudformation describe-stacks --stack-name CdnStack --region ap-northeast-1 2>/dev/null; then
  echo "❌ スタックがまだ存在しています"
  exit 1
else
  echo "✅ スタックが正常に削除されました"
fi

# 6. クリーンアップ
cd ..
rm -rf "$PROJECT_NAME"

echo "✅ テスト完了！"
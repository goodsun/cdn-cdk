#!/bin/bash
# delete-orphaned-stack.sh
# ディレクトリが削除されたCDKスタックを削除するスクリプト

STACK_NAME="$1"
REGION="${2:-us-east-1}"

if [ -z "$STACK_NAME" ]; then
    echo "Usage: $0 <stack-name> [region]"
    echo "Example: $0 CdnStack-test-20250722-044426-e2e-aws-bon-soleil-com us-east-1"
    exit 1
fi

echo "Deleting stack: $STACK_NAME in region: $REGION"

# CloudFormationで直接削除
aws cloudformation delete-stack \
    --stack-name "$STACK_NAME" \
    --region "$REGION"

echo "Stack deletion initiated. Checking status..."

# 削除完了を待つ
while true; do
    STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "DELETED")
    
    if [ "$STATUS" = "DELETED" ] || [ "$STATUS" = "DELETE_COMPLETE" ]; then
        echo "✅ Stack deleted successfully"
        break
    elif [ "$STATUS" = "DELETE_FAILED" ]; then
        echo "❌ Stack deletion failed. Manual intervention required."
        echo "Check CloudFormation console for details."
        exit 1
    else
        echo "Current status: $STATUS"
        sleep 10
    fi
done
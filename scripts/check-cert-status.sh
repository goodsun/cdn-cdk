#!/bin/bash

# 証明書ARNを引数から取得、またはデフォルト値を使用
CERT_ARN=${1:-"arn:aws:acm:ap-northeast-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
REGION=${AWS_REGION:-"ap-northeast-1"}

echo "🔍 証明書の状態を確認中..."
echo "ARN: $CERT_ARN"
echo "Region: $REGION"
echo ""

# 証明書の詳細を取得
CERT_DETAILS=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region "$REGION" 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ エラー: 証明書の情報を取得できませんでした"
    exit 1
fi

# 証明書の状態を表示
STATUS=$(echo "$CERT_DETAILS" | jq -r '.Certificate.Status')
DOMAIN=$(echo "$CERT_DETAILS" | jq -r '.Certificate.DomainName')

echo "📋 証明書情報:"
echo "  ドメイン: $DOMAIN"
echo "  ステータス: $STATUS"
echo ""

if [ "$STATUS" == "PENDING_VALIDATION" ]; then
    echo "📝 DNS検証レコード:"
    echo "$CERT_DETAILS" | jq -r '.Certificate.DomainValidationOptions[] | 
        if .ValidationStatus == "PENDING_VALIDATION" then
            "\nレコードタイプ: CNAME\n名前: \(.ResourceRecord.Name)\n値: \(.ResourceRecord.Value)\n"
        else
            "✅ \(.DomainName) - 検証済み"
        end'
elif [ "$STATUS" == "ISSUED" ]; then
    echo "✅ 証明書は既に発行済みです！"
fi
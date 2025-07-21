#!/bin/bash
# Test display of create-cert -l output

echo "🔐 AWS Certificate Manager - 証明書一覧"
echo ""
echo "📍 リージョン: us-east-1"
echo "────────────────────────────────────────────────────────────────────────────────"
echo "  ドメイン: *.goodsun.tokyo"
echo "  ├─ ステータス: ISSUED"
echo "  ├─ ARN: .../76b3b911-578f-49bd-8170-d259020f6dd6"
echo "  ├─ 作成日: 2025/7/21"
echo "  ├─ 有効期限: 2026/8/19 (393日後)"
echo "  ├─ 📋 削除コマンド:"
echo "  │  └─ aws acm delete-certificate --certificate-arn arn:aws:acm:us-east-1:498997347996:certificate/76b3b911-578f-49bd-8170-d259020f6dd6 --region us-east-1"
echo "  └─ 🌐 Route 53レコード確認:"

# If zone exists (e.g., aws.bon-soleil.com)
if [ "$1" == "with-zone" ]; then
  echo "     └─ aws route53 list-resource-record-sets --hosted-zone-id Z06786531H0THJ7OP3DLZ --query \"ResourceRecordSets[?contains(Name, '*')]\""
else
  # If zone doesn't exist (e.g., goodsun.tokyo)
  echo "     └─ aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID> --query \"ResourceRecordSets[?contains(Name, '*')]\""
fi
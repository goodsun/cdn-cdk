# ワイルドカード証明書の再利用

## 概要

このシステムは、既存のワイルドカード証明書（*.example.com）を自動的に検出し、サブドメイン（dev.example.com、staging.example.com など）で再利用することができます。これにより、新しい証明書の作成とDNS検証の待機時間（10-30分）を回避できます。

## メリット

- **時間の節約**: 新しい証明書のDNS検証を待つ必要がありません
- **コスト削減**: AWSの証明書数制限を効率的に使用できます
- **管理の簡素化**: 証明書の更新や管理が一元化されます

## 使用方法

### 1. ワイルドカード証明書の登録

既存のワイルドカード証明書をシステムに登録します：

```bash
npm run register-wildcard example.com us-east-1
```

このコマンドは以下を行います：
1. 指定されたリージョンで *.example.com の証明書を検索
2. 見つかった証明書のARNをSSM Parameter Storeに保存
3. 今後のデプロイで自動的に使用されるように設定

### 2. サブドメインのデプロイ

ワイルドカード証明書が登録されていれば、サブドメインのデプロイ時に自動的に使用されます：

```bash
create-cdn dev-example
cd dev-example
# .envファイルでDOMAIN_NAME=dev.example.comを設定
npm run deploy
```

デプロイ時に以下のようなメッセージが表示されます：
```
🎯 既存のワイルドカード証明書を使用: *.example.com
   証明書ARN: arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx
   対象ドメイン: dev.example.com
```

## 仕組み

1. **自動検出**: デプロイ時にドメイン名を分析し、使用可能なワイルドカード証明書を検索
2. **SSM Parameter Store**: 証明書ARNは `/acm/wildcard.example.com/certificate-arn` に保存
3. **優先順位**: ワイルドカード証明書が見つかれば優先的に使用、なければ新規作成

## 注意事項

- ワイルドカード証明書は同じリージョンに存在する必要があります
- CloudFrontを使用する場合は、証明書はus-east-1リージョンに必要です
- ワイルドカード証明書自体（*.example.com）でCloudFrontを作成することはできません（CloudFrontのCNAME制限のため）

## トラブルシューティング

### ワイルドカード証明書が検出されない

1. 証明書が正しいリージョンにあることを確認：
   ```bash
   aws acm list-certificates --region us-east-1 | grep "*.example.com"
   ```

2. 手動でSSMに登録：
   ```bash
   aws ssm put-parameter \
     --name "/acm/wildcard.example.com/certificate-arn" \
     --value "arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx" \
     --type String \
     --region us-east-1
   ```

### 証明書の確認

登録されているワイルドカード証明書を確認：
```bash
aws ssm get-parameter \
  --name "/acm/wildcard.example.com/certificate-arn" \
  --region us-east-1
```
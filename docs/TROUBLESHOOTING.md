# ACM証明書CDK トラブルシューティングガイド

## よくある問題と解決方法

### 🔍 DNS検証関連

#### 問題: DNS検証が完了しない

**症状**:
- 証明書のステータスが「PENDING_VALIDATION」のまま
- 1時間以上経過しても検証が完了しない

**原因**:
1. DNSレコードが正しく設定されていない
2. DNS伝播に時間がかかっている
3. CNAMEレコードの値が間違っている

**解決方法**:

```bash
# 1. 検証用レコードを再確認
aws acm describe-certificate \
  --certificate-arn ARN \
  --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord]' \
  --output table

# 2. DNSレコードが正しく設定されているか確認
dig _xxxxx.yourdomain.com CNAME +short

# 3. 別のDNSサーバーで確認
dig @8.8.8.8 _xxxxx.yourdomain.com CNAME +short

# 4. DNSレコードのTTLを確認（短く設定）
dig _xxxxx.yourdomain.com CNAME +noall +answer
```

**注意点**:
- CNAMEレコードの最後のドット（.）を忘れずに
- プロキシ機能（Cloudflare等）はOFFにする

#### 問題: 複数の検証レコードが必要

**症状**:
- ワイルドカード証明書とルートドメインで異なる検証レコード

**解決方法**:
```bash
# 全ての検証レコードを確認
aws acm describe-certificate \
  --certificate-arn ARN \
  --query 'Certificate.DomainValidationOptions[*]' \
  --output json | jq -r '.[] | "Name: \(.ResourceRecord.Name)\nValue: \(.ResourceRecord.Value)\n"'
```

### 🚀 デプロイ関連

#### 問題: CDKブートストラップエラー

**エラーメッセージ**:
```
Error: This stack uses assets, so the toolkit stack must be deployed
```

**解決方法**:
```bash
# 1. 現在のリージョンでブートストラップ
cdk bootstrap

# 2. us-east-1でもブートストラップ（CloudFront証明書用）
cdk bootstrap aws://ACCOUNT-ID/us-east-1

# 3. 環境変数を確認
echo $CDK_DEFAULT_ACCOUNT
echo $CDK_DEFAULT_REGION
```

#### 問題: IAM権限エラー

**エラーメッセージ**:
```
User: arn:aws:iam::xxx:user/xxx is not authorized to perform: acm:RequestCertificate
```

**解決方法**:
```bash
# 1. 現在の権限を確認
aws sts get-caller-identity

# 2. 必要な権限を持つポリシーを作成
cat > acm-cdk-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "acm:*",
        "ssm:*Parameter*",
        "cloudformation:*",
        "iam:*Role*",
        "sns:*"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# 3. ポリシーをアタッチ
aws iam put-user-policy \
  --user-name YOUR-USERNAME \
  --policy-name ACMCDKPolicy \
  --policy-document file://acm-cdk-policy.json
```

#### 問題: リージョン不一致エラー

**エラーメッセージ**:
```
Error: DnsValidatedCertificate can only be created in us-east-1
```

**解決方法**:
```typescript
// lib/acm-stack.ts で明示的にリージョンを指定
this.cloudfrontCertificate = new acm.DnsValidatedCertificate(this, 'CloudFrontCertificate', {
  domainName: `*.${fullDomain}`,
  subjectAlternativeNames: [fullDomain],
  region: 'us-east-1', // 必須
});
```

### 📊 SSMパラメータ関連

#### 問題: パラメータが見つからない

**エラーメッセージ**:
```
ParameterNotFound: Parameter /acm/regional-certificate-arn not found
```

**解決方法**:
```bash
# 1. パラメータの存在確認
aws ssm describe-parameters \
  --parameter-filters "Key=Name,Values=/acm/*" \
  --query 'Parameters[*].Name'

# 2. 正しいパスを確認
aws ssm get-parameters-by-path \
  --path "/acm" \
  --recursive

# 3. 環境別パスの確認
aws ssm get-parameter \
  --name "/acm/${CDK_ENV}/regional-certificate-arn"
```

#### 問題: パラメータアクセス権限エラー

**解決方法**:
```json
// 各サービスのIAMロールに追加
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ssm:GetParameter",
      "ssm:GetParameters"
    ],
    "Resource": [
      "arn:aws:ssm:*:*:parameter/acm/*"
    ]
  }]
}
```

### 🔄 更新・変更関連

#### 問題: 証明書の変更ができない

**症状**:
- ドメイン名を変更したい
- 証明書の設定を変更したい

**解決方法**:
```bash
# 1. 新しい証明書を作成（別名で）
CDK_ENV=new cdk deploy

# 2. 各サービスを新しい証明書に切り替え

# 3. 古い証明書を削除
cdk destroy acm-certificate-old
```

#### 問題: 削除保護により削除できない

**解決方法**:
```bash
# 1. CloudFormationで削除保護を解除
aws cloudformation update-stack \
  --stack-name acm-certificate-shared \
  --use-previous-template \
  --parameters ParameterKey=EnableTerminationProtection,ParameterValue=false

# 2. リソースを手動削除
aws acm delete-certificate --certificate-arn ARN

# 3. スタックを削除
cdk destroy
```

### 🌍 マルチリージョン関連

#### 問題: クロスリージョンスタックエラー

**症状**:
- us-east-1の証明書作成に失敗

**解決方法**:
```typescript
// 別スタックとして作成
const cloudfrontStack = new CloudFrontCertificateStack(app, 'cf-cert', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1' // 固定
  },
  crossRegionReferences: true,
});
```

### 📧 通知関連

#### 問題: メール通知が届かない

**原因**:
1. SNSサブスクリプションの確認が未完了
2. メールアドレスが間違っている

**解決方法**:
```bash
# 1. SNSトピックを確認
aws sns list-topics --query 'Topics[?contains(TopicArn, `Certificate`)]'

# 2. サブスクリプションを確認
aws sns list-subscriptions-by-topic \
  --topic-arn ARN \
  --query 'Subscriptions[*].[Protocol,Endpoint,SubscriptionArn]'

# 3. 確認メールを再送信
aws sns subscribe \
  --topic-arn ARN \
  --protocol email \
  --notification-endpoint your-email@example.com
```

### 🐛 デバッグ方法

#### CloudFormationイベントの確認

```bash
# スタックイベントを確認
aws cloudformation describe-stack-events \
  --stack-name acm-certificate-shared \
  --query 'StackEvents[0:10].[Timestamp,ResourceStatus,ResourceType,ResourceStatusReason]' \
  --output table
```

#### CDKデバッグモード

```bash
# 詳細なログを出力
export CDK_DEBUG=true
cdk deploy --verbose
```

#### 証明書の詳細情報

```bash
# 証明書の完全な情報を取得
aws acm describe-certificate \
  --certificate-arn ARN \
  --output json | jq '.'
```

### 💡 予防策

1. **定期的な監視**
   ```bash
   # 証明書の状態を定期確認
   aws acm list-certificates \
     --query 'CertificateSummaryList[*].[DomainName,Status]' \
     --output table
   ```

2. **バックアップ**
   ```bash
   # 設定のバックアップ
   cdk synth > backup-$(date +%Y%m%d).json
   ```

3. **テスト環境での検証**
   ```bash
   # 開発環境で先にテスト
   CDK_ENV=dev cdk deploy
   ```

## サポート

問題が解決しない場合：

1. CloudFormationスタックのエラーログを確認
2. AWS Supportに問い合わせ
3. GitHub Issuesで報告
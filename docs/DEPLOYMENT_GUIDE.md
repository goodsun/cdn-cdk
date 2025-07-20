# ACM証明書CDK デプロイメントガイド

## 前提条件

### 必要なツール

- Node.js 18以上
- AWS CLI（設定済み）
- AWS CDK CLI 2.0以上

```bash
# CDK CLIインストール
npm install -g aws-cdk

# バージョン確認
cdk --version
```

### AWS権限

以下の権限を持つIAMユーザーまたはロール：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "acm:*",
        "ssm:PutParameter",
        "ssm:GetParameter",
        "ssm:DeleteParameter",
        "cloudformation:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PutRolePolicy",
        "iam:PassRole",
        "iam:DeleteRole",
        "iam:DeleteRolePolicy",
        "sns:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## 🚀 クイックスタート

### 1. プロジェクトセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/yourorg/acm-cdk.git
cd acm-cdk

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
```

### 2. 環境変数の設定

`.env`ファイルを編集：

```bash
# 必須
DOMAIN_NAME=yourdomain.com

# オプション
CDK_ENV=shared              # shared/dev/stg/prod
CDK_ACCOUNT=123456789012   # AWSアカウントID
CDK_REGION=ap-northeast-1  # リージョン
NOTIFICATION_EMAIL=admin@yourdomain.com  # 通知用メール
```

### 3. CDKブートストラップ

初回のみ実行：

```bash
# デフォルトリージョン
cdk bootstrap

# 特定のアカウント/リージョン
cdk bootstrap aws://123456789012/ap-northeast-1

# CloudFront用にus-east-1も必要
cdk bootstrap aws://123456789012/us-east-1
```

### 4. デプロイ

```bash
# 変更内容の確認
cdk diff

# デプロイ実行
cdk deploy

# 承認をスキップ（CI/CD用）
cdk deploy --require-approval never
```

## 📋 環境別デプロイ

### 開発環境

```bash
# .env.dev
DOMAIN_NAME=dev.yourdomain.com
ENVIRONMENT=dev
USE_CLOUDFRONT=true
ORIGIN_TYPE=s3-new

# デプロイ
source .env.dev && npm run deploy
```

作成されるリソース：
- ACM証明書（us-east-1）: `dev.yourdomain.com`
- CloudFrontディストリビューション
- S3バケット（新規作成の場合）

### ステージング環境

```bash
# .env.stg
DOMAIN_NAME=stg.yourdomain.com
ENVIRONMENT=stg
USE_CLOUDFRONT=true
ORIGIN_TYPE=s3-website-new  # SPAサイトの場合

# デプロイ
source .env.stg && npm run deploy
```

### 本番環境

```bash
# .env.prd
DOMAIN_NAME=yourdomain.com
ENVIRONMENT=prd
USE_CLOUDFRONT=true
ORIGIN_TYPE=http  # 既存サイトをCDN化する場合
ORIGIN_DOMAIN=origin.yourdomain.com

# デプロイ（承認あり）
source .env.prd && npm run deploy
```

## 🔍 DNS検証

### 1. 検証レコードの確認

```bash
# スクリプトを使用
npm run show-validation

# または手動で
aws acm describe-certificate \
  --certificate-arn $(aws ssm get-parameter \
    --name /acm/regional-certificate-arn \
    --query 'Parameter.Value' --output text) \
  --query 'Certificate.DomainValidationOptions'
```

### 2. DNSレコード追加

取得したCNAMEレコードをDNSプロバイダーに追加：

#### Cloudflareの場合
```
Type: CNAME
Name: _xxxxx.yourdomain.com
Target: _yyyyy.acm-validations.aws.
Proxy: OFF
```

#### お名前.comの場合
```
ホスト名: _xxxxx
TYPE: CNAME
VALUE: _yyyyy.acm-validations.aws.
```

### 3. 検証完了確認

```bash
# ステータス確認（ISSUEDになるまで待つ）
aws acm describe-certificate \
  --certificate-arn $(aws ssm get-parameter \
    --name /acm/regional-certificate-arn \
    --query 'Parameter.Value' --output text) \
  --query 'Certificate.Status'
```

## 📤 証明書ARNの取得

### SSM Parameter Storeから

```bash
# リージョナル証明書
aws ssm get-parameter \
  --name /acm/regional-certificate-arn \
  --query 'Parameter.Value' --output text

# CloudFront証明書
aws ssm get-parameter \
  --name /acm/cloudfront-certificate-arn \
  --query 'Parameter.Value' --output text
```

### CloudFormation Outputsから

```bash
# スタック出力を確認
aws cloudformation describe-stacks \
  --stack-name acm-certificate-shared \
  --query 'Stacks[0].Outputs'
```

### エクスポートスクリプト

```bash
# ARNをファイルに出力
./scripts/export-arns.sh > certificate-arns.txt
```

## 🔄 更新・メンテナンス

### スタックの更新

```bash
# コード変更後
npm run build
cdk diff
cdk deploy
```

### 証明書の更新

ACM証明書は自動更新されますが、手動確認する場合：

```bash
# 有効期限確認
aws acm describe-certificate \
  --certificate-arn $(aws ssm get-parameter \
    --name /acm/regional-certificate-arn \
    --query 'Parameter.Value' --output text) \
  --query 'Certificate.NotAfter'
```

## 🗑️ リソースの削除

### ⚠️ 注意事項

証明書には削除保護（RETAIN）が設定されています。

### 削除手順

1. **使用中のサービスを確認**
   ```bash
   # 証明書を使用しているリソースがないか確認
   aws acm describe-certificate \
     --certificate-arn ARN \
     --query 'Certificate.InUseBy'
   ```

2. **SSMパラメータの削除**
   ```bash
   aws ssm delete-parameter --name /acm/regional-certificate-arn
   aws ssm delete-parameter --name /acm/cloudfront-certificate-arn
   ```

3. **スタックの削除**
   ```bash
   cdk destroy
   ```

4. **証明書の手動削除**（必要な場合）
   ```bash
   aws acm delete-certificate --certificate-arn ARN
   ```

## 🚨 トラブルシューティング

### DNS検証が完了しない

**原因**: DNSレコードが正しく設定されていない

**解決策**:
```bash
# DNS伝播を確認
nslookup _xxxxx.yourdomain.com

# 正しいCNAMEが返るか確認
dig _xxxxx.yourdomain.com CNAME
```

### us-east-1の証明書作成エラー

**原因**: リージョンが異なる

**解決策**:
```bash
# us-east-1でブートストラップ
cdk bootstrap aws://ACCOUNT/us-east-1
```

### デプロイ権限エラー

**原因**: IAM権限不足

**解決策**:
```bash
# 現在の権限を確認
aws sts get-caller-identity

# 必要な権限を付与
aws iam attach-user-policy \
  --user-name USERNAME \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

## 📊 コスト

- ACM証明書: **無料**
- SSM Parameter Store（標準）: **無料**
- CloudFormation: **無料**
- 月額コスト: **$0**

## 🔐 セキュリティベストプラクティス

1. **本番環境の保護**
   ```bash
   # CloudFormationスタックの保護を有効化
   aws cloudformation update-termination-protection \
     --enable-termination-protection \
     --stack-name acm-certificate-prod
   ```

2. **アクセス制限**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": {
         "AWS": "arn:aws:iam::ACCOUNT:role/ServiceRole"
       },
       "Action": "ssm:GetParameter",
       "Resource": "arn:aws:ssm:*:*:parameter/acm/*"
     }]
   }
   ```

3. **監査ログ**
   - CloudTrailで証明書関連の操作を記録
   - 定期的なアクセスレビュー
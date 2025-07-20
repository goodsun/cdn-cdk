# ACM CDK 実際の使用場面

## 1. 新規Webサービス立ち上げ時

### シナリオ
既存ドメイン（example.com）で新しいWebサービスを開始する。

### 実際の手順

```bash
# 1. 環境設定
cp .env.example .env
vim .env
```

```env
DOMAIN_NAME=example.com
ENVIRONMENT=dev
NOTIFICATION_EMAIL=devops@example.com
```

```bash
# 2. 証明書の作成
npm install
npm run deploy:all

# 出力例：
# ACM-Certificate-dev.CertificateArn = arn:aws:acm:ap-northeast-1:123456:certificate/xxx
# ACM-CloudFront-Certificate-dev.CloudFrontCertificateArn = arn:aws:acm:us-east-1:123456:certificate/yyy
```

```bash
# 3. DNS検証（お名前.comの場合）
npx ts-node scripts/dns-validation-helper.ts \
  arn:aws:acm:ap-northeast-1:123456:certificate/xxx 0

# 以下のような出力が表示される：
# 
# お名前.comでの設定方法:
# 1. お名前.comの管理画面にログイン
# 2. DNS関連機能設定 > DNS設定/転送設定を選択
# 3. 対象ドメインを選択
# 4. DNSレコード設定を選択
# 5. 以下のCNAMEレコードを追加:
# 
# ホスト名: _abc123.dev.example.com
# タイプ: CNAME
# 値: _def456.acm-validations.aws.
```

```bash
# 4. 検証完了を待つ
npx ts-node scripts/dns-validation-helper.ts \
  arn:aws:acm:ap-northeast-1:123456:certificate/xxx 0 --wait

# 5. ALBやCloudFrontで証明書を使用
# SSM Parameter Storeから証明書ARNを取得
aws ssm get-parameter --name /acm/dev/example.com/certificate-arn
```

## 2. マルチ環境での運用

### シナリオ
開発・ステージング・本番環境で異なるサブドメインを使用。

### 環境構成
- 開発: dev.example.com
- ステージング: stg.example.com  
- 本番: example.com

### 実際の運用

```bash
# 開発環境
ENVIRONMENT=dev npm run deploy:all

# ステージング環境
ENVIRONMENT=stg npm run deploy:all

# 本番環境
ENVIRONMENT=prd npm run deploy:all
```

### 各環境での証明書
- dev: `*.dev.example.com`, `dev.example.com`
- stg: `*.stg.example.com`, `stg.example.com`
- prd: `*.example.com`, `example.com`, `www.example.com`

## 3. 既存インフラへの統合

### シナリオ
10年以上運用している既存サービスに、段階的にAWSサービスを追加。

### 現状
- ドメイン管理：さくらインターネット
- Webサーバー：オンプレミス
- 新規追加：S3 + CloudFront（静的コンテンツ配信）

### 実装手順

```bash
# 1. CloudFront用証明書のみ作成
cdk deploy ACM-CloudFront-Certificate-prd

# 2. さくらインターネットでDNS検証
npx ts-node scripts/dns-validation-helper.ts \
  arn:aws:acm:us-east-1:123456:certificate/zzz 1

# 3. 既存サーバーはそのまま、CDNだけAWSを使用
# cdn.example.com → CloudFront → S3
# www.example.com → 既存サーバー（変更なし）
```

## 4. 証明書の自動更新と監視

### ACMの自動更新機能
ACMは証明書を**自動的に更新**します。通常、人手での対応は不要です。

### 監視が必要な理由
自動更新が失敗する可能性があるケース：
- DNS検証レコードが削除された
- ドメインの所有権が変更された
- DNSプロバイダーを移行した際の設定漏れ

### 異常時のアラート例

```
件名: [エラー] ACM証明書の自動更新に失敗しました

証明書の自動更新に問題が発生しました。

証明書ARN: arn:aws:acm:ap-northeast-1:123456:certificate/xxx
ドメイン: example.com
現在の状態: FAILED
失敗理由: DNS validation records were not found

DNS検証レコードが見つかりません。すぐに確認が必要です。
```

### 対応手順（異常時のみ）

```bash
# 1. 証明書の状態確認
aws acm describe-certificate --certificate-arn arn:aws:acm:...

# 2. DNS検証レコードの再設定
npx ts-node scripts/dns-validation-helper.ts arn:aws:acm:... 0

# 3. DNSプロバイダーで検証レコードを追加
# （手順はヘルパーツールが表示）
```

**重要**: 正常に運用されていれば、これらの作業は不要です。

## 5. トラブルシューティング実例

### ケース1：DNS検証が完了しない

```bash
# 問題の診断
nslookup _abc123.example.com

# DNSレコードが見つからない場合
# → DNSプロバイダーで設定を確認

# TTLが長い場合
# → 最大48時間待つ
```

### ケース2：証明書の状態がFAILED

```
件名: [エラー] ACM証明書の検証に失敗しました

証明書の検証に失敗しました。

証明書ARN: arn:aws:acm:ap-northeast-1:123456:certificate/xxx
ドメイン: example.com
検証状態: FAILED

DNS検証レコードを確認してください。
```

```bash
# 新しい証明書を作成
cdk destroy ACM-Certificate-dev
cdk deploy ACM-Certificate-dev

# DNS検証をやり直す
npx ts-node scripts/dns-validation-helper.ts <新しいARN> 0
```

## 6. コスト最適化の実例

### Before（個別証明書）
- api.example.com用証明書
- admin.example.com用証明書  
- app.example.com用証明書
- www.example.com用証明書

### After（ワイルドカード証明書）
- *.example.com（すべてカバー）
- コスト：$0（ACMは無料）
- 管理：1つの証明書のみ

## まとめ

このACM CDKは以下のような実際の課題を解決します：

1. **既存環境との共存** - Route53なしでも使える
2. **運用の自動化** - 期限切れの心配なし
3. **環境別管理** - dev/stg/prdを簡単に分離
4. **コスト削減** - ワイルドカード証明書で統一
5. **トラブル対応** - 明確な手順とアラート
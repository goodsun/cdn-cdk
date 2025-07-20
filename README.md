# ACM CDK - 改善版

AWS Certificate Manager (ACM) 証明書を管理するための改善されたCDKプロジェクト。

## 主な改善点

1. **最新のCDKコンストラクトを使用** - 廃止予定のDnsValidatedCertificateを使用せず、最新のCertificateコンストラクトを採用
2. **既存DNS環境への対応** - Route53以外のDNSプロバイダーでも使いやすいヘルパーツールを提供
3. **監視・アラート機能** - 証明書の期限切れ前の通知、状態監視
4. **シンプルな実装** - 環境変数による簡単な設定

## クイックスタート

### 1. セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して、必要な値を設定
```

### 2. デプロイ

```bash
# すべてのスタックをデプロイ
npm run deploy:all

# または個別にデプロイ
cdk deploy ACM-Certificate-dev
cdk deploy ACM-CloudFront-Certificate-dev
cdk deploy ACM-Monitoring-dev
```

### 3. DNS検証

Route53を使用しない場合：

```bash
# DNS検証レコードの取得と設定手順の表示
npx ts-node scripts/dns-validation-helper.ts <certificate-arn> <provider-number>

# 例：お名前.comの場合
npx ts-node scripts/dns-validation-helper.ts arn:aws:acm:... 0

# 検証完了を待機する場合
npx ts-node scripts/dns-validation-helper.ts arn:aws:acm:... 0 --wait
```

## 機能

### 証明書管理
- リージョナル証明書（ALB、API Gateway用）
- CloudFront用証明書（us-east-1）
- ワイルドカード証明書のサポート
- 環境別の証明書管理（dev/stg/prd）

### DNS検証サポート
- Route53での自動検証（オプション）
- 主要DNSプロバイダー向けの設定ガイド
  - お名前.com
  - さくらインターネット
  - Value Domain
  - Cloudflare
- DNS検証レコードのJSON出力

### 監視機能
- 証明書期限の事前通知（30日、14日、7日、3日、1日前）
- 証明書の状態監視
- 検証失敗の通知
- CloudWatchダッシュボード
- メール通知

## 設定

### 環境変数

| 変数名 | 説明 | 必須 | デフォルト |
|--------|------|------|------------|
| DOMAIN_NAME | 証明書を発行するドメイン名 | ✓ | - |
| ENVIRONMENT | 環境名（dev/stg/prd） | - | dev |
| NOTIFICATION_EMAIL | アラート通知先メールアドレス | - | admin@example.com |
| HOSTED_ZONE_ID | Route53ホストゾーンID（自動DNS検証用） | - | - |
| HOSTED_ZONE_NAME | Route53ホストゾーン名（自動DNS検証用） | - | - |

### 既存DNS環境での使用

Route53を使用しない場合でも、以下の手順で簡単に証明書を発行できます：

1. 証明書スタックをデプロイ
2. `dns-validation-helper.ts`スクリプトを実行
3. 表示された手順に従ってDNSレコードを設定
4. 検証完了を待つ（自動更新されます）

## アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│                  監視スタック                     │
│  ・Lambda関数（毎日チェック）                    │
│  ・SNSトピック（メール通知）                     │
│  ・CloudWatchダッシュボード                      │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐ ┌────────────────────┐
│ リージョナル   │ │   CloudFront用     │
│ 証明書スタック │ │   証明書スタック    │
│ (ALB/API GW)  │ │   (us-east-1)      │
└───────────────┘ └────────────────────┘
        │                 │
        └────────┬────────┘
                 ▼
         SSM Parameter Store
         （証明書ARNの共有）
```

## トラブルシューティング

### 証明書の検証が完了しない
1. DNS検証レコードが正しく設定されているか確認
2. DNSの伝播を待つ（最大48時間）
3. `nslookup`コマンドで検証レコードを確認

### デプロイエラー
1. AWS認証情報が正しく設定されているか確認
2. 必要なIAM権限があるか確認
3. CloudFormationスタックの状態を確認

## ライセンス

MIT
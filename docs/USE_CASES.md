# CDN CDK 実際の使用場面

## 1. 新規Webサービス立ち上げ時

### シナリオ
新しいWebサービスをCloudFront + S3で高速配信する。

### 実際の手順

```bash
# 1. 対話型CLIでプロジェクト作成
npx create-cdn my-service

# プロンプトに答える：
# 🌐 ドメイン名: example.com
# ☁️  CloudFrontを使用: Y
# 📦 オリジンタイプ: 新規S3バケット（OAC経由・推奨）
# 📧 通知メール: admin@example.com
```

```bash
# 2. デプロイ
cd my-service
npm install
npm run deploy

# 出力例：
# BucketName: example-com-content
# DistributionDomain: d1234567890.cloudfront.net
# CloudFrontURL: https://example.com
# DNSRecordName: example
# DNSRecordValue: d1234567890.cloudfront.net
```

```bash
# 3. DNS設定
# デプロイ完了後に表示される指示に従ってDNSを設定

# お名前.comの場合:
# ホスト名: example
# タイプ: CNAME
# 値: d1234567890.cloudfront.net

# Cloudflareの場合:
# Type: CNAME
# Name: example.com
# Target: d1234567890.cloudfront.net
# Proxy: OFF（重要）
```

```bash
# 4. コンテンツのアップロード
aws s3 sync ./dist s3://example-com-content/

# 5. キャッシュの無効化（更新時）
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

## 2. マルチ環境での運用

### シナリオ
開発・ステージング・本番環境で異なるサブドメインを使用。

### 環境構成
- 開発: dev.example.com（S3新規）
- ステージング: stg.example.com（S3静的ウェブサイト）  
- 本番: example.com（既存Webサーバー）

### 実際の運用

```bash
# 開発環境（新規S3バケット）
npx create-cdn dev-example
# オリジンタイプ: s3-newを選択

# ステージング環境（SPAサイト）
npx create-cdn stg-example  
# オリジンタイプ: s3-website-newを選択

# 本番環境（既存サイトをCDN化）
npx create-cdn prd-example
# オリジンタイプ: httpを選択
# オリジンドメイン: origin.example.com
```

### 各環境の特徴
- dev: OACでセキュアなS3アクセス
- stg: 静的ウェブサイトホスティングでSPA対応
- prd: 既存サーバーをそのまま使用

## 3. 既存インフラへの統合

### シナリオ
長年運用している既存サービスをCloudFrontで高速化。

### 現状
- ドメイン管理：さくらインターネット
- Webサーバー：オンプレミス（www.example.com）
- 新規追加：CloudFrontでキャッシュ高速化

### 実装手順

```bash
# 1. 既存サイトをオリジンとしてCloudFrontを作成
npx create-cdn example-cdn

# プロンプトで以下を選択：
# ドメイン名: www.example.com
# オリジンタイプ: 既存のWebサイト（HTTP/HTTPS）
# オリジンドメイン: origin-www.example.com

# 2. デプロイ
cd example-cdn
npm install
npm run deploy

# 3. DNS切り替え
# 既存: www.example.com → origin-www.example.com（CNAME変更）
# 新規: www.example.com → d1234567890.cloudfront.net（CNAME追加）
```

## 4. API Gatewayとの統合

### シナリオ
REST APIをCloudFront経由で配信し、グローバルな高速アクセスを実現。

### 実装手順

```bash
# 1. API Gateway向けCloudFrontを作成
npx create-cdn api-cdn

# プロンプトで以下を選択：
# ドメイン名: api.example.com
# オリジンタイプ: API Gateway
# オリジンドメイン: xxxxxx.execute-api.ap-northeast-1.amazonaws.com
# オリジンパス: /prod
```

### API Gateway向けの特別設定
- キャッシュ無効化（動的APIのため）
- すべてのHTTPメソッドを許可
- カスタムヘッダーでホスト情報を転送

## 5. S3静的ウェブサイトホスティング（SPA対応）

### シナリオ
React/Vue/AngularのSPAをS3 + CloudFrontでホスティング。

### 実装手順

```bash
# 1. SPA用CloudFrontを作成
npx create-cdn spa-example

# プロンプトで以下を選択：
# オリジンタイプ: 新規S3バケット（静的ウェブサイトホスティング）
```

### SPA向けの特別設定
- 404エラーをindex.htmlにリダイレクト（クライアントサイドルーティング対応）
- S3はHTTP_ONLYプロトコルを使用
- パブリックアクセスを許可

## 6. 既存証明書の使用（開発環境）

### シナリオ
既に取得済みのACM証明書を使用してCloudFrontを作成。

### 実装手順

```bash
# 1. 既存証明書のARNを環境変数に設定
export CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/xxx

# 2. プロジェクト作成
npx create-cdn dev-site

# 3. .envファイルを編集
cd dev-site
vi .env
# CERTIFICATE_ARNのコメントを外してARNを設定

# 4. デプロイ
npm install
npm run deploy
```

## 7. トラブルシューティング実例

### ケース1：CloudFrontからS3にアクセスできない

```bash
# 問題の診断
curl -I https://example.com
# 403 Forbidden

# 解決方法：
# 1. オリジンタイプを確認
# - s3-new/s3-existing → OACを使用
# - s3-website-new/s3-website-existing → パブリックアクセス

# 2. S3バケットポリシーを確認
aws s3api get-bucket-policy --bucket example-com-content
```

### ケース2：CloudFrontキャッシュが更新されない

```bash
# キャッシュを無効化
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"

# 特定ファイルのみ無効化
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/index.html" "/css/style.css"

# 無効化の状態確認
aws cloudfront get-invalidation \
  --distribution-id E1234567890ABC \
  --id I1234567890ABC
```

## 8. コスト最適化の実例

### CloudFrontの料金最適化

```bash
# 1. 適切なキャッシュ設定
# 静的コンテンツ: 長期キャッシュ
Cache-Control: public, max-age=31536000

# 2. 圧縮を有効化
# CloudFrontが自動でgzip圧縮

# 3. 不要なログの無効化
# CloudFrontアクセスログをオフ
```

### 月額コスト目安
| 構成 | 月間10万PV | 月間100万PV |
|------|-----------|-------------|
| S3 + CloudFront | 約500円 | 約2,000円 |
| キャッシュ率高 | 約300円 | 約1,200円 |

## まとめ

このCDN CDKは以下のような実際の課題を解決します：

1. **簡単セットアップ** - 対話型CLIで5分で構築
2. **柔軟なオリジン対応** - 7種類のオリジンタイプをサポート
3. **セキュリティ** - OACやHTTPS強制などベストプラクティスを自動適用
4. **コスト最適化** - 適切なキャッシュ設定で料金を抑制
5. **DNS設定支援** - デプロイ後に明確なDNS設定指示を表示
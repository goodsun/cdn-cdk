# 🚀 create-cdn

AWS CloudFrontによるCDN構築ツールセット

CLI tool to easily create AWS CDN with CloudFront and ACM certificates

[![npm version](https://badge.fury.io/js/%40goodsun%2Fcreate-cdn.svg)](https://badge.fury.io/js/%40goodsun%2Fcreate-cdn)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📦 ツール構成

このパッケージは2つの独立したツールで構成されています：

### 1. create-cert - SSL/TLS証明書管理ツール
AWS Certificate Manager (ACM)でSSL/TLS証明書を作成・管理
- 通常のSSL証明書作成（example.com, www.example.com）
- ワイルドカード証明書にも対応（*.example.com）
- マルチドメイン証明書（SANs）のサポート
- 全リージョンの証明書を一括管理
- CDKスタックとは独立して永続的に管理

### 2. create-cdn - CDN構築ツール  
CloudFront CDNの構築・デプロイツール
- 対話形式でCDN環境を構築
- S3、ALB、既存Webサイトなど多様なオリジンに対応
- 証明書の自動検出と再利用

**推奨フロー**: `create-cert`で証明書を事前作成 → `create-cdn`でCDNを構築

## クイックスタート

### インストール
```bash
# グローバルインストール
npm install -g @goodsun/create-cdn
```

### 証明書の事前作成（推奨）
```bash
# SSL証明書を作成（対話形式）
create-cert
# → 通常の証明書: example.com, www.example.com
# → ワイルドカード証明書: *.example.com（全サブドメインで利用可能）

# 証明書の確認
create-cert --list
```

### CDN の作成とデプロイ
```bash
# 新規CDN作成
create-cdn my-cdn

# CDNディレクトリへ移動
cd my-cdn
vi .env
npm install
npm run deploy
```

### 管理コマンド
```bash
# デプロイ済みCDNの確認
create-cdn --list

# 証明書の管理
create-cert --help
```

## 🎯 効果

- ✅ **Web サイトが遅い** → CDN で最大 10 倍高速化
- ✅ **HTTPS 化したい** → 無料で SSL 証明書を自動発行
- ✅ **AWS が難しい** → 専門知識不要。質問に答えるだけ
- ✅ **料金が心配** → 月額 500 円程度から始められる

## 📋 必要なもの

- [ ] AWS アカウント（[無料枠で OK](https://aws.amazon.com/jp/free/)）
- [ ] ドメイン名（example.com など）
- [ ] Node.js v18 以上（[ダウンロード](https://nodejs.org/)）


## 💰 料金目安

月間アクセス数と概算料金の対応表：

| 月間アクセス数 | 概算料金     |
| -------------- | ------------ |
| 10 万 PV       | 約 500 円    |
| 100 万 PV      | 約 2,000 円  |
| 1000 万 PV     | 約 10,000 円 |

※ 実際の料金は使用量により変動

## 🏗️ アーキテクチャ

### 静的サイトの場合

```
ユーザー → example.com → CloudFront → S3バケット
```

### 既存 Web サイトの場合

```
ユーザー → example.com → CloudFront → 既存サーバー
                           ↓
                      キャッシュで高速化
```

CloudFront が世界中のエッジロケーションにコンテンツをキャッシュし、ユーザーに最も近い場所から配信します。

### 対応するオリジンタイプ

| オリジンタイプ              | .env 設定値         | 用途                         | 例                               |
| --------------------------- | ------------------- | ---------------------------- | -------------------------------- |
| 新規 S3 バケット（OAC）     | s3-new              | 静的サイト（推奨）           | React、Vue.js、HTML サイト       |
| 新規 S3 バケット（Website） | s3-website-new      | 静的サイト（公開バケット）   | シンプルな HTML サイト           |
| 既存 S3 バケット（OAC）     | s3-existing         | 既存のプライベートバケット   | セキュアな静的コンテンツ         |
| 既存 S3 バケット（Website） | s3-website-existing | 既存の公開バケット           | 既に S3 でホスティング中のサイト |
| 既存 Web サイト             | http                | 動的サイト                   | WordPress、EC2、外部サーバー     |
| ALB                         | alb                 | AWS でロードバランサー使用中 | ECS、EC2 クラスター              |
| API Gateway                 | apigateway          | REST/HTTP API                | Lambda 関数、マイクロサービス    |

## 📚 詳細ガイド

### CDN とは？

Content Delivery Network の略。世界中のサーバーにコンテンツをコピーして、ユーザーに最も近いサーバーから配信する仕組み。

### なぜ高速化するのか

東京のサーバーしかない場合、アメリカからのアクセスは遅くなります。CDN を使うと、アメリカのユーザーはアメリカのサーバーから取得できるため高速です。

### SSL 証明書について

https://でアクセスできるようにする証明書。このツールでは無料で自動取得されます。

## 🔧 設定

### 環境別デプロイ

```bash
# 開発環境
npm run deploy:dev

# 本番環境
npm run deploy:prod
```

### ワイルドカード証明書

既存のワイルドカード証明書を効率的に活用する方法は[ワイルドカード証明書の再利用ガイド](docs/wildcard-certificate-reuse.md)を参照してください。
技術的な詳細については[ワイルドカード証明書の仕様](docs/WILDCARD_CERTIFICATES.md)も参照してください。

### カスタム設定

`cdk.json`を編集して詳細設定が可能：

```json
{
  "context": {
    "domain": "example.com",
    "useCloudFront": true,
    "useMonitoring": true,
    "notificationEmail": "admin@example.com"
  }
}
```

### よく使うコマンド

```bash
# デプロイ（すべてのスタック）
npm run deploy

# 特定環境にデプロイ
npm run deploy:dev
npm run deploy:prod

# リソースの削除
npm run destroy

# 変更内容の確認（デプロイ前）
npm run cdk diff

# スタックの状態確認
npm run cdk list

# AWSブートストラップ（初回のみ）
npm run bootstrap
```

## 📚 ドキュメント

### 高度な設定

- [ワイルドカード証明書の使用方法](docs/WILDCARD_CERTIFICATES.md)
- [DNS 検証の手順](docs/DNS_VALIDATION.md)
- [複数ドメインの設定](docs/MULTIPLE_DOMAINS.md)
- [環境変数の詳細](template/.env.example)

### DNS 設定ガイド

各 DNS プロバイダーでの設定方法：

- [お名前.com](docs/dns/onamae.md)
- [Route53](docs/dns/route53.md)（自動設定対応）
- [Cloudflare](docs/dns/cloudflare.md)

## 🆘 トラブルシューティング

### AWS 認証エラー

```
Error: Need to perform AWS calls for account 123456789012
```

**解決方法**:

```bash
aws configure
# Access Key ID、Secret Access Key、Region、Output formatを入力
```

### DNS 検証が完了しない

```bash
# DNS検証レコードを自動取得
npm run show-validation

# DNS検証状態を確認
npm run check-validation
```

または手動で確認：

1. AWS Certificate Manager コンソールを開く
2. 該当する証明書を選択
3. 「検証」タブで CNAME レコードを確認
4. DNS プロバイダーで該当レコードを追加

### 証明書を単独で作成する (create-cert)

CDK とは別に証明書だけを作成・管理できる独立したツールです。

#### 基本的な使い方

```bash
# 新しい証明書を作成（対話形式）
create-cert

# 発行済み証明書の一覧を表示（全リージョン）
create-cert --list
create-cert -l

# 証明書を削除（対話形式で選択）
create-cert --delete
create-cert -d

# ヘルプを表示
create-cert --help
create-cert -h
```

#### 対話形式での証明書作成

```bash
$ create-cert
🔐 AWS Certificate Manager - 証明書作成ウィザード

🌐 証明書のドメイン名を入力: *.example.com
🗺️  リージョンを選択:
1. us-east-1 (CloudFront用)
2. ap-northeast-1 (東京)
3. その他のリージョン
選択 (1-3): 1

📝 追加のドメイン名 (SANs) を入力 (例: www.example.com, example.com):
→ example.com

✅ 証明書のリクエストが送信されました
📋 証明書ARN: arn:aws:acm:us-east-1:123456789012:certificate/xxxx-xxxx-xxxx

⚠️  DNS検証が必要です。以下のCNAMEレコードを追加してください：

ドメイン: _xxxxxx.example.com
タイプ: CNAME
値: _xxxxxx.acm-validations.aws.

💡 SSMパラメータに保存するコマンド:
aws ssm put-parameter --name "/cdk/certificates/example.com" --value "arn:aws:acm:us-east-1:123456789012:certificate/xxxx" --type String --overwrite
```

#### 証明書一覧の表示

```bash
$ create-cert --list
🔐 AWS Certificate Manager - 証明書一覧

📍 リージョン: us-east-1 (バージニア北部)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
証明書 #1
  ドメイン: *.example.com
  追加ドメイン: example.com
  ステータス: ✅ ISSUED
  有効期限: 2025-03-15
  ARN: arn:aws:acm:us-east-1:123456789012:certificate/xxxx-xxxx

証明書 #2
  ドメイン: dev.example.com
  ステータス: ⏳ PENDING_VALIDATION
  ARN: arn:aws:acm:us-east-1:123456789012:certificate/yyyy-yyyy

📍 リージョン: ap-northeast-1 (東京)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
証明書 #1
  ドメイン: api.example.com
  ステータス: ✅ ISSUED
  有効期限: 2025-04-20
  ARN: arn:aws:acm:ap-northeast-1:123456789012:certificate/zzzz-zzzz
```

#### メリット

- **永続性**: スタック削除時も証明書は残る
- **再利用性**: 複数プロジェクトで同じ証明書を使い回せる
- **効率性**: DNS検証は最初の1回だけ（ワイルドカード証明書なら特に有効）
- **管理性**: 全リージョンの証明書を一括管理
- **独立性**: CDKスタックとは完全に独立して管理

#### 推奨される使用パターン

1. **ワイルドカード証明書の事前作成**
   ```bash
   # *.example.com を作成しておけば、
   # dev.example.com, staging.example.com など
   # すべてのサブドメインで利用可能
   create-cert
   ```

2. **CloudFront用証明書の作成**
   ```bash
   # us-east-1リージョンを選択（CloudFront必須）
   create-cert
   # → リージョン選択で「1. us-east-1 (CloudFront用)」を選択
   ```

3. **マルチドメイン証明書**
   ```bash
   # example.com と www.example.com を1つの証明書で
   create-cert
   # → 追加ドメインに「example.com」を入力
   ```

### ワイルドカード証明書を活用する

既存のワイルドカード証明書（\*.example.com）がある場合、サブドメイン（dev.example.com）で自動的に再利用されます：

```bash
# 1. ワイルドカード証明書を作成
create-cert
# ドメイン: *.example.com
# リージョン: us-east-1

# 2. サブドメインのプロジェクトを作成
create-cdn dev-example
# → 既存の *.example.com 証明書を自動検出・登録

# 3. デプロイ（DNS検証なしで即座に使用可能）
cd dev-example
npm run deploy
```

**自動化された処理：**

- `create-cdn` 実行時に既存証明書を自動検索
- 使用可能な証明書があれば SSM に自動登録
- `npm run deploy` 時にも再度チェック
- DNS 検証の待ち時間をスキップ

### 料金を確認したい

```bash
# 今月の利用料金を確認
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```

## 🤝 コントリビューション

バグ報告や機能リクエストは[Issues](https://github.com/goodsun/create-cdn/issues)へお気軽にご提出ください。

詳細は[CONTRIBUTING.md](CONTRIBUTING.md)を参照。

## 📄 ライセンス

MIT License

---

<p align="center">
  powered by goodsun
</p>

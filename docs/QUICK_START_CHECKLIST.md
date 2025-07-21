# 🚀 クイックスタートチェックリスト

CDN を構築する前に、以下の項目を確認してください。このツールは CloudFront と S3 を使った高速な CDN 環境を簡単に構築できます。

## ✅ 事前準備チェックリスト

### 1. AWS アカウント

- [ ] AWS アカウントを作成済み
- [ ] クレジットカードを登録済み
- [ ] ルートユーザーではなく IAM ユーザーを使用

### 2. AWS CLI

- [ ] AWS CLI をインストール済み
  ```bash
  # インストール確認
  aws --version
  ```
- [ ] AWS 認証情報を設定済み

  ```bash
  # 設定確認
  aws configure list

  # まだの場合は設定
  aws configure
  ```

### 3. Node.js 環境

- [ ] Node.js v18 以上をインストール済み
  ```bash
  # バージョン確認
  node --version
  ```
- [ ] npm が使える
  ```bash
  # バージョン確認
  npm --version
  ```

### 4. ドメイン名

- [ ] 使用するドメイン名を所有している
- [ ] DNS レコードを編集できる権限がある
- [ ] 現在の DNS 設定をバックアップ済み

### 5. 必要な情報の準備

- [ ] 通知用メールアドレス
- [ ] AWS リージョンを決定（CloudFront を使用する場合は自動的に us-east-1 が使用されます）
- [ ] 月間想定 PV 数を把握（料金見積もり用）

## 📝 セットアップ手順

### Step 0: ツールのインストール

```bash
# グローバルインストール
npm install -g @goodsun/create-cdn
```

### Step 1: 証明書の事前作成（推奨）

```bash
# SSL証明書を作成
create-cert
```

### Step 2: CDNプロジェクト作成（対話型）

```bash
create-cdn my-website
```

対話型プロンプトで以下を設定：

- ドメイン名（例: example.com）
- CloudFront 使用の有無
- オリジンタイプの選択：
  - 新規 S3 バケット（OAC 経由・推奨）
  - 新規 S3 バケット（静的ウェブサイトホスティング）
  - 既存の S3 静的ウェブサイト
  - 既存の S3 バケット（OAC 経由）
  - 既存の Web サイト（HTTP/HTTPS）
  - Application Load Balancer (ALB)
  - API Gateway
- 証明書の有効期限監視設定
- 通知先メールアドレス

### Step 3: プロジェクトのセットアップとデプロイ

```bash
# プロジェクトに移動
cd my-website

# 環境変数の確認・編集（必要に応じて）
vi .env

# 依存関係インストール
npm install

# デプロイ実行
npm run deploy
```

### Step 4: DNS 設定

デプロイ完了後に表示される指示に従って DNS を設定：

```bash
# デプロイ完了後の表示例：
📌 DNSに以下のレコードを追加してください：
タイプ: CNAME
名前: example.com
値: d3quu6nulwb2s9.cloudfront.net

# 既存のCDNを確認する場合
create-cdn --list
```

## ⚠️ よくあるエラーと対処法

### 1. AWS 認証エラー

```
Error: Need to perform AWS calls for account 123456789012, but no credentials have been configured
```

**対処法:**

```bash
aws configure
# Access Key ID、Secret Access Key、Region、Output formatを入力
```

### 2. Node.js バージョンエラー

```
Error: Node.js version 16.x is not supported
```

**対処法:**
Node.js v18 以上にアップグレード

- [Node.js 公式サイト](https://nodejs.org/)からダウンロード

### 3. ドメイン検証エラー

```
Error: Certificate validation timed out
```

**対処法:**

1. AWS Certificate Manager コンソールを開く（us-east-1 リージョン）
2. 該当する証明書を選択
3. 「検証」タブで CNAME レコードを確認
4. DNS プロバイダーで該当レコードを追加

**注意:** CloudFront 用の証明書は必ず us-east-1 リージョンに作成されます。

### 4. クロスリージョンエラー

```
Error: Cross-region references are not supported
```

**対処法:**
CDK スタックで`crossRegionReferences: true`が設定されていることを確認

## 💡 Tips

### 料金を抑えるコツ

1. CloudFront のキャッシュ期間を長く設定
2. 不要なログ記録を無効化
3. 使用量アラートを設定

### セキュリティ強化

1. S3 バケットへのアクセス制御
   - OAC（Origin Access Control）を使用（推奨）
   - 静的ウェブサイトホスティングの場合は公開アクセスを許可
2. CloudFront のセキュリティポリシー
   - TLS 1.2 以上を強制
   - HTTPS への自動リダイレクト
3. WAF の設定を検討

### パフォーマンス最適化

1. 画像の圧縮・最適化
2. gzip 圧縮の有効化
3. 適切なキャッシュヘッダーの設定

### 複数オリジンタイプの特徴

| オリジンタイプ      | 用途                   | プロトコル | 認証方式       |
| ------------------- | ---------------------- | ---------- | -------------- |
| s3-new              | 新規静的コンテンツ配信 | HTTPS      | OAC            |
| s3-website-new      | 新規 SPA サイト        | HTTP_ONLY  | Public         |
| s3-website-existing | 既存 S3 静的サイト     | HTTP_ONLY  | Public         |
| s3-existing         | 既存 S3 バケット       | HTTPS      | OAC            |
| http                | 既存 Web サイト        | HTTPS      | -              |
| alb                 | EC2/ECS 等のアプリ     | HTTPS      | -              |
| apigateway          | REST/HTTP API          | HTTPS      | Custom Headers |

## 🆘 サポート

問題が解決しない場合：

1. [GitHub Issues](https://github.com/goodsun/create-cdn/issues)で質問
2. [AWS サポート](https://aws.amazon.com/jp/support/)に問い合わせ
3. [Stack Overflow](https://stackoverflow.com/questions/tagged/aws-cdk)で検索

---

準備ができたら、[README](../README.md)に戻ってセットアップを開始しましょう！

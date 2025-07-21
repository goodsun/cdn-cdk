# CloudFrontでS3静的サイトを独自ドメインで公開する完全ガイド

## 概要
このガイドでは、S3に保存した静的ウェブサイトを、CloudFront経由で独自ドメイン（例：`example.com`）でHTTPS公開する手順を、初学者向けに詳しく説明します。

## なぜこの構成が必要なのか？

### 問題点
1. **S3の静的ウェブサイトはHTTPのみ**
   - `http://example.s3-website-ap-northeast-1.amazonaws.com` という形式
   - HTTPSに対応していない（セキュリティ警告が出る）

2. **独自ドメインが使えない**
   - S3のURLは長くて覚えにくい
   - ブランディングに適さない

3. **パフォーマンスの問題**
   - S3は東京リージョンのみ
   - 海外からのアクセスが遅い

### 解決策：CloudFront
CloudFrontはAWSのCDN（Content Delivery Network）サービスで：
- HTTPS対応
- 独自ドメイン設定可能
- 世界中にコンテンツを配信（高速化）

## 必要なコンポーネント

```
[ユーザー] → [独自ドメイン] → [CloudFront] → [S3バケット]
             (HTTPS)           (CDN)         (静的サイト)
```

### 1. S3バケット
- **役割**：HTMLファイルなどのコンテンツを保存
- **必要な設定**：静的ウェブサイトホスティングを有効化

### 2. ACM証明書
- **役割**：HTTPS通信を可能にする証明書
- **なぜ必要？**：ブラウザがサイトを「安全」と認識するため

### 3. CloudFrontディストリビューション
- **役割**：S3とユーザーの間に入ってコンテンツを配信
- **メリット**：HTTPS対応、キャッシュによる高速化

### 4. DNS設定
- **役割**：独自ドメインをCloudFrontに向ける
- **仕組み**：`example.com` → `d1234567890.cloudfront.net`

## ステップバイステップ手順

### ステップ1: 証明書の作成（create-certツール使用）

#### なぜ証明書が必要？
HTTPSでサイトを公開するには、そのドメインの所有者であることを証明する「証明書」が必要です。これがないと、ブラウザが「このサイトは安全でない」と警告を出します。

#### 手順
```bash
# create-certツールで証明書を作成
create-cert

# プロンプトで以下を選択：
# - ドメイン名: *.example.com（ワイルドカード証明書）
# - リージョン: 1 (us-east-1 CloudFront用)
# - 追加ドメイン: example.com
```

**重要**: CloudFront用の証明書は必ずus-east-1（バージニア北部）リージョンで作成する必要があります。

### ステップ2: DNS検証

#### なぜDNS検証が必要？
AWSは「あなたが本当にこのドメインの所有者か」を確認する必要があります。

#### 検証の仕組み
create-certツールが表示するCNAMEレコードをDNSに追加します：

```
# create-certが表示する例：
レコードタイプ: CNAME
名前: _xxxxxxxx.example.com
値: _xxxxxxxx.acm-validations.aws.
```

詳細な手順は[DNSプロバイダー別ガイド](dns/)を参照してください。

### ステップ3: CDNの作成（create-cdnツール使用）

#### 手順
```bash
# CDNプロジェクトを作成
create-cdn my-website

# 対話形式で以下を設定：
# - ドメイン名: example.com
# - CloudFront使用: Y
# - オリジン選択: 2（新規S3バケット・静的ウェブサイトホスティング）
# - 証明書の監視: Y

# プロジェクトに移動してデプロイ
cd my-website
npm install
npm run deploy
```

#### 自動設定される項目
create-cdnツールが以下を自動的に設定します：

- **S3バケット**: 静的ウェブサイトホスティング有効化
- **CloudFront設定**:
  - Origin: S3静的ウェブサイトエンドポイント
  - Viewer Protocol Policy: HTTPSにリダイレクト
  - Alternate Domain Names: 指定したドメイン
  - SSL Certificate: create-certで作成した証明書を自動検出
  - Default Root Object: index.html

### ステップ4: DNS設定（最終段階）

デプロイ完了後、create-cdnが表示するDNS設定を追加します：

```bash
# デプロイ後の出力例：
🎉 デプロイが完了しました！

📌 DNSに以下のレコードを追加してください：
タイプ: CNAME
名前: example.com
値: d3quu6nulwb2s9.cloudfront.net

# または既存のCDNを確認
create-cdn --list
```

詳細な手順は[DNSプロバイダー別ガイド](dns/)を参照してください。

## トラブルシューティング

### 1. 「このサイトは安全に接続できません」エラー
**原因**：
- 証明書がまだ検証されていない → `create-cert --list`で確認
- DNS設定が未完了 → `create-cdn --list`でDNS設定を再確認

### 2. DNS解決の確認
```bash
# DNS設定の確認
dig example.com

# 証明書の状態確認
aws acm describe-certificate --certificate-arn <ARN> --region us-east-1
```

### 2. 403 Forbidden エラー
**原因**：
- CloudFrontのAlternate Domain Namesが未設定
- S3バケットが存在しない/アクセス権限がない

### 3. タイムラグについて
**デプロイ時間**：
- CloudFront新規作成：15-20分
- 設定変更：5-10分
- DNS伝播：数分〜最大48時間（通常5-10分）

## まとめ

### 全体の流れ
1. **証明書作成**：ドメインの所有を証明
2. **DNS検証**：AWSに所有者であることを証明
3. **CloudFront作成**：S3とユーザーをつなぐ配信システム
4. **DNS設定**：独自ドメインをCloudFrontに向ける

### なぜこれらすべてが必要？
- **S3だけ**：HTTPのみ、AWSのURLのみ
- **CloudFront追加**：HTTPS対応、高速化
- **証明書追加**：独自ドメインでHTTPS可能に
- **DNS設定**：わかりやすいURLでアクセス可能に

これらすべてが組み合わさって、安全で高速な独自ドメインのウェブサイトが実現します。
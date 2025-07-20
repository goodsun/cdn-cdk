# CloudFrontでS3静的サイトを独自ドメインで公開する完全ガイド

## 概要
このガイドでは、S3に保存した静的ウェブサイトを、CloudFront経由で独自ドメイン（例：`dev.bon-soleil.com`）でHTTPS公開する手順を、初学者向けに詳しく説明します。

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
- **仕組み**：`dev.bon-soleil.com` → `d3quu6nulwb2s9.cloudfront.net`

## ステップバイステップ手順

### ステップ1: ACM証明書の作成

#### なぜ証明書が必要？
HTTPSでサイトを公開するには、そのドメインの所有者であることを証明する「証明書」が必要です。これがないと、ブラウザが「このサイトは安全でない」と警告を出します。

#### 重要な注意点
**CloudFront用の証明書は必ずus-east-1（バージニア北部）リージョンで作成する必要があります。**

理由：CloudFrontは世界中にサーバーがあるグローバルサービスのため、証明書も特定のリージョン（us-east-1）に置く必要があります。

#### 手順
1. AWS Certificate Managerで証明書をリクエスト
2. ドメイン名を入力（例：`*.dev.bon-soleil.com`）
   - `*`（ワイルドカード）を使うと、すべてのサブドメインで使える

### ステップ2: DNS検証

#### なぜDNS検証が必要？
AWSは「あなたが本当にこのドメインの所有者か」を確認する必要があります。

#### 検証の仕組み
1. AWSが特殊なDNSレコードを生成
   ```
   _c98c02a6665d1d364b6a23f2ebedbf4b.dev.bon-soleil.com
   ```

2. あなたがこのレコードをDNSに追加

3. AWSがレコードの存在を確認 → 所有者と認定

#### DNS検証レコードの追加方法
```
# DNSプロバイダーで以下を追加
cname _c98c02a6665d1d364b6a23f2ebedbf4b.dev _4da1c2ba6bf8833681ffcf90209788f5.xlfgrmvvlj.acm-validations.aws.
```

### ステップ3: CloudFrontディストリビューションの作成

#### 主要な設定項目

##### 1. Origin（オリジン）
**設定値**：`example-frontend.s3-website-ap-northeast-1.amazonaws.com`

**なぜこの形式？**
- S3には2つのアクセス方法があります：
  - バケットURL：`example-frontend.s3.amazonaws.com`（APIアクセス用）
  - ウェブサイトURL：`example-frontend.s3-website-ap-northeast-1.amazonaws.com`（静的サイト用）
- 静的サイトにはウェブサイトURLを使う必要があります

##### 2. Origin Protocol Policy
**設定値**：`HTTP only`

**なぜHTTP？**
- S3の静的ウェブサイトはHTTPSに対応していません
- CloudFront → S3の通信はAWS内部なので、HTTPでも安全

##### 3. Viewer Protocol Policy
**設定値**：`Redirect HTTP to HTTPS`

**意味**：
- ユーザーが`http://`でアクセスしても、自動的に`https://`にリダイレクト
- セキュリティを確保

##### 4. Alternate Domain Names (CNAMEs)
**設定値**：`dev.bon-soleil.com`

**役割**：
- CloudFrontに「このドメインでのアクセスを受け付ける」と伝える
- これがないと、CloudFrontドメイン（`d3quu6nulwb2s9.cloudfront.net`）でしかアクセスできない

##### 5. SSL Certificate
**設定値**：先ほど作成した証明書を選択

**役割**：
- 独自ドメインでHTTPSアクセスを可能にする

##### 6. Default Root Object
**設定値**：`index.html`

**意味**：
- `https://dev.bon-soleil.com/`にアクセスしたとき、自動的に`index.html`を表示

### ステップ4: DNS設定（最終段階）

#### CNAMEレコードの追加
```
cname dev d3quu6nulwb2s9.cloudfront.net.
```

#### この設定の意味
- `dev.bon-soleil.com`へのアクセスを
- `d3quu6nulwb2s9.cloudfront.net`（CloudFront）に転送

#### 重要：ワイルドカードAレコードとの競合
もし以下のような設定があると：
```
a * 157.7.189.61  # すべてのサブドメインを特定のIPに向ける
```

CNAMEレコードが効かない場合があります。解決方法：
1. ワイルドカードを削除
2. または、必要なサブドメインだけ個別に設定

## トラブルシューティング

### 1. 「このサイトは安全に接続できません」エラー
**原因**：
- 証明書がまだ検証されていない
- CNAMEレコードが正しく設定されていない
- CloudFrontの設定が未完了

**確認方法**：
```bash
# DNS解決の確認
dig dev.bon-soleil.com

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
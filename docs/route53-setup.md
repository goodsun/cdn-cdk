# 🌐 create-route53 - Route53 DNS設定ヘルパー

AWS Route53のDNS設定を自動化するコマンドラインツールです。ACM証明書のDNS検証やCloudFrontエイリアスレコードの設定を簡単に行えます。

## 📋 目次

- [インストール](#インストール)
- [基本的な使い方](#基本的な使い方)
- [主な機能](#主な機能)
- [使用例](#使用例)
- [トラブルシューティング](#トラブルシューティング)
- [必要な権限](#必要な権限)

## インストール

```bash
# グローバルインストール
npm install -g @goodsun/create-cdn

# インストール確認
create-route53 --version
```

## 基本的な使い方

### 対話形式メニュー（推奨）

```bash
create-route53
```

対話形式のメニューが表示され、以下の操作を選択できます：
- Route53ホストゾーン一覧の表示
- 証明書のDNS検証レコード設定
- CloudFrontエイリアスレコード設定
- DNSレコードの設定確認

### コマンドラインオプション

```bash
create-route53 [オプション]
```

| オプション | 説明 |
|-----------|------|
| `-l, --list` | Route53のホストゾーン一覧を表示 |
| `-c, --cert-arn <arn>` | ACM証明書のDNS検証レコードを自動設定 |
| `--cloudfront <domain>` | CloudFrontディストリビューションのエイリアスレコードを設定 |
| `--domain <domain>` | 操作対象のドメイン名を指定 |
| `--subdomain <subdomain>` | サブドメインを指定（CloudFront設定時） |
| `--check <domain>` | 指定ドメインのDNSレコード設定を確認 |
| `-y, --yes` | すべての確認プロンプトを自動承認 |
| `-h, --help` | ヘルプを表示 |
| `-V, --version` | バージョンを表示 |

## 主な機能

### 1. ホストゾーンの自動検出

ドメイン名から適切なRoute53ホストゾーンを自動的に検出します。

```bash
# example.comのホストゾーンを自動検出
create-route53 --check example.com
```

- 完全一致を優先的に検索
- 親ドメインのゾーンも検索（例: sub.example.comに対してexample.comのゾーン）
- 複数候補がある場合は選択可能

### 2. ACM証明書のDNS検証自動化

AWS Certificate Manager（ACM）で発行した証明書のDNS検証を完全自動化します。

```bash
# 証明書ARNを指定してDNS検証レコードを設定
create-route53 --cert-arn arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
```

機能：
- 証明書から必要なCNAMEレコードを自動取得
- Route53に検証レコードを自動追加
- 検証完了まで進捗を監視（最大30分）
- 複数ドメインの証明書にも対応

### 3. CloudFrontエイリアスレコードの設定

CloudFrontディストリビューションへのエイリアスレコードを簡単に設定できます。

```bash
# www.example.comをCloudFrontにエイリアス設定
create-route53 --cloudfront d1234567890.cloudfront.net --domain www.example.com

# サブドメインを使用する場合
create-route53 --cloudfront d1234567890.cloudfront.net --subdomain www --domain example.com
```

### 4. DNS設定の確認

現在のDNSレコード設定を確認できます。

```bash
# example.comのすべてのDNSレコードを表示
create-route53 --check example.com
```

表示される情報：
- レコードタイプ（A、AAAA、CNAME、TXT等）
- レコード値またはエイリアス先
- TTL設定

## 使用例

### 例1: create-certと組み合わせた証明書設定

```bash
# 1. 証明書を作成
create-cert
# 出力: 証明書ARN: arn:aws:acm:us-east-1:123456789012:certificate/xxx-xxx-xxx

# 2. DNS検証レコードを自動設定
create-route53 --cert-arn arn:aws:acm:us-east-1:123456789012:certificate/xxx-xxx-xxx

# 3. 検証完了を確認
create-cert --list
```

### 例2: CDNデプロイ後のDNS設定

```bash
# 1. CDNをデプロイ
cd my-cdn-project
npm run deploy

# 2. CloudFrontドメインを確認
aws cloudformation describe-stacks --stack-name CdnStack-example-com \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text

# 3. DNSエイリアスを設定
create-route53 --cloudfront d1234567890.cloudfront.net --domain www.example.com
```

### 例3: 自動化スクリプトでの使用

```bash
#!/bin/bash

# 証明書ARNとドメインを変数で定義
CERT_ARN="arn:aws:acm:us-east-1:123456789012:certificate/xxx-xxx-xxx"
CF_DOMAIN="d1234567890.cloudfront.net"
DOMAIN="www.example.com"

# -yオプションで確認プロンプトをスキップ
create-route53 --cert-arn $CERT_ARN -y
create-route53 --cloudfront $CF_DOMAIN --domain $DOMAIN -y
```

## トラブルシューティング

### よくあるエラーと対処法

#### 1. "AccessDenied" エラー

```
❌ Route53へのアクセス権限がありません。
```

**解決方法**: IAMポリシーでRoute53への権限を追加してください。

#### 2. ホストゾーンが見つからない

```
❌ example.com に対応するホストゾーンが見つかりませんでした。
```

**解決方法**: 
- Route53でホストゾーンが作成されているか確認
- ドメイン名が正しいか確認（末尾の.は不要）

#### 3. DNS検証が完了しない

**確認事項**:
- DNSレコードが正しく設定されているか: `create-route53 --check _xxx.example.com`
- DNS伝播を待つ（通常5-30分）
- 証明書のリージョンが正しいか確認

### DNS設定の診断

```bash
# Route53の設定を確認
create-route53 --check example.com

# digコマンドで外部から確認
dig _xxx.example.com CNAME

# nslookupで確認
nslookup _xxx.example.com
```

## 必要な権限

create-route53を使用するには、以下のIAM権限が必要です：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "route53:ListHostedZones",
        "route53:ListResourceRecordSets",
        "route53:ChangeResourceRecordSets",
        "route53:GetChange"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "acm:DescribeCertificate",
        "acm:ListCertificates"
      ],
      "Resource": "*"
    }
  ]
}
```

## 関連ツール

- [`create-cert`](./standalone-certificate.md) - ACM証明書の作成と管理
- [`create-cdn`](../README.md) - CloudFront CDNの構築

## 注意事項

- DNS変更は即座に反映されない場合があります（通常5-30分、最大48時間）
- 既存のDNSレコードは`UPSERT`アクションで上書きされます
- CloudFrontのホストゾーンID（Z2FDTNDATAQYW2）は全リージョン共通の固定値です
- Route53の利用には料金が発生します（ホストゾーン: $0.50/月、クエリ: $0.40/100万クエリ）

## サポート

問題が発生した場合は、以下をお試しください：

1. `create-route53 --list`でホストゾーンの存在を確認
2. `create-route53 --check <domain>`で現在の設定を確認
3. AWS CLIの認証情報が正しく設定されているか確認: `aws sts get-caller-identity`
4. [GitHubのIssues](https://github.com/goodsun/create-cdn/issues)で報告
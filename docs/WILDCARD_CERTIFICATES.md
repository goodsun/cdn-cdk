# ワイルドカード証明書の使用方法

## 📋 概要

ワイルドカード証明書を使用すると、単一の証明書で複数のサブドメインをカバーできます。例えば、`*.example.com` の証明書は `www.example.com`、`api.example.com`、`blog.example.com` など、すべてのサブドメインで使用できます。

## ⚠️ 重要な仕様

**ワイルドカード証明書（`*.example.com`）を選択した場合：**
- ✅ ACM証明書のみが作成されます
- ❌ CloudFrontディストリビューションは作成されません
- ❌ S3バケットは作成されません

これは、CloudFrontがワイルドカードドメイン（`*.example.com`）をCNAMEとして受け付けないためです。CloudFrontを使用する場合は、具体的なドメイン名（`www.example.com`など）で再度実行してください。

## 🚀 設定方法

### 1. CLIでプロジェクト作成時

```bash
create-cdn my-website

# プロンプトでドメイン名を入力
ドメイン名を入力してください: *.example.com
```

### 2. 既存プロジェクトの設定変更

`.env` ファイルを編集：

```bash
# ワイルドカード証明書の設定
DOMAIN_NAME=*.example.com
```

### 3. 作成した証明書を使用してCloudFrontを構築

ワイルドカード証明書作成後、具体的なドメインでCloudFrontを構築する場合：

1. 新しいプロジェクトを作成（具体的なドメイン名で）
   ```bash
   create-cdn www-example
   # ドメイン名: www.example.com
   ```

2. 既存の証明書を使用するようにCDKコードをカスタマイズ

### 4. ルートドメインとワイルドカードの両方を使用

ルートドメイン（example.com）とワイルドカード（*.example.com）の両方を使用する場合は、CDKコードをカスタマイズする必要があります：

```typescript
// lib/acm-cdk-stack.ts を編集
const certificate = new acm.Certificate(this, 'Certificate', {
  domainName: '*.example.com',
  subjectAlternativeNames: ['example.com'], // ルートドメインを追加
  validation: acm.CertificateValidation.fromDns(hostedZone),
});

// CloudFrontディストリビューションの設定も更新
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  domainNames: ['*.example.com', 'example.com'],
  certificate: certificate,
  // ... その他の設定
});
```

## ⚠️ 注意事項

### 1. ワイルドカード証明書の制限

- `*.example.com` は第一レベルのサブドメインのみカバー
  - ✅ `www.example.com`
  - ✅ `api.example.com`
  - ❌ `v2.api.example.com`（第二レベルのサブドメイン）
  - ❌ `example.com`（ルートドメイン）

### 2. 複数レベルのワイルドカード

複数レベルのサブドメインをカバーする場合：

```typescript
// 複数のワイルドカード証明書が必要
const certificate = new acm.Certificate(this, 'Certificate', {
  domainName: '*.example.com',
  subjectAlternativeNames: [
    'example.com',
    '*.api.example.com',
    '*.dev.example.com'
  ],
  validation: acm.CertificateValidation.fromDns(hostedZone),
});
```

### 3. DNS検証の設定

ワイルドカード証明書のDNS検証では、以下のCNAMEレコードを設定する必要があります：

```
_acmechallengetoken.example.com → ACMが提供する値
```

## 🔍 トラブルシューティング

### 証明書の発行が完了しない

1. Route 53でDNS検証レコードが正しく設定されているか確認
2. ドメインの所有権が正しいか確認
3. CloudFormationスタックのイベントでエラーメッセージを確認

### ルートドメインが動作しない

ワイルドカード証明書（`*.example.com`）はルートドメイン（`example.com`）をカバーしません。両方必要な場合は、上記の「ルートドメインとワイルドカードの両方を使用」を参照してください。

## 📚 関連ドキュメント

- [AWS ACM ワイルドカード証明書](https://docs.aws.amazon.com/ja_jp/acm/latest/userguide/acm-certificate.html)
- [CloudFront での複数ドメイン設定](https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html)
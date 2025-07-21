# ワイルドカード証明書の使用方法

## 📋 概要

ワイルドカード証明書を使用すると、単一の証明書で複数のサブドメインをカバーできます。例えば、`*.example.com` の証明書は `www.example.com`、`api.example.com`、`blog.example.com` など、すべてのサブドメインで使用できます。

## 🚀 推奨される使用方法

### 1. ワイルドカード証明書の作成（create-cert）

```bash
# create-certツールで証明書を作成
create-cert

# プロンプトでの入力例：
# ドメイン名: *.example.com
# リージョン: 1 (us-east-1 CloudFront用)
# 追加ドメイン: example.com  # ルートドメインも含める
```

### 2. CDNプロジェクトの作成（create-cdn）

ワイルドカード証明書作成後、具体的なサブドメインでCDNを構築：

```bash
# 具体的なサブドメインでCDNを作成
create-cdn www-example

# プロンプトでの入力例：
# ドメイン名: www.example.com
# CloudFront使用: Y
# → 既存の*.example.com証明書が自動的に検出・使用されます
```

## ✨ 自動化された証明書の再利用

create-cdnツールは既存のワイルドカード証明書を自動的に検出します：

1. **証明書の自動検索**: `create-cdn`実行時に、入力されたドメインに適合する証明書を検索
2. **SSMへの自動登録**: 検出された証明書をSSMパラメータストアに自動登録
3. **即座に利用可能**: DNS検証の待ち時間なしでデプロイ可能


## ⚠️ 注意事項

### 1. ワイルドカード証明書の制限

- `*.example.com` は第一レベルのサブドメインのみカバー
  - ✅ `www.example.com`
  - ✅ `api.example.com`
  - ❌ `v2.api.example.com`（第二レベルのサブドメイン）
  - ❌ `example.com`（ルートドメイン）

### 2. 複数レベルのワイルドカード

複数レベルのサブドメインをカバーする場合は、それぞれのレベルで証明書が必要です：

```bash
# 第一レベル用
create-cert
# → ドメイン: *.example.com

# 第二レベル用（別途作成）
create-cert
# → ドメイン: *.api.example.com
```

### 3. DNS検証の設定

create-certツールが表示するDNS検証レコードを設定します。詳細は[DNSプロバイダー別ガイド](dns/)を参照してください。

## 🔍 トラブルシューティング

### 証明書の発行が完了しない

```bash
# 証明書の状態を確認
create-cert --list

# PENDING_VALIDATIONの場合：
# 1. 表示されたDNS検証レコードが正しく設定されているか確認
# 2. DNSの伝播を待つ（通常5-30分）
```

### ルートドメインが動作しない

ワイルドカード証明書（`*.example.com`）はルートドメイン（`example.com`）をカバーしません。create-certで証明書作成時に、追加ドメインとしてルートドメインを含めてください。

## 📚 関連ドキュメント

- [AWS ACM ワイルドカード証明書](https://docs.aws.amazon.com/ja_jp/acm/latest/userguide/acm-certificate.html)
- [CloudFront での複数ドメイン設定](https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html)
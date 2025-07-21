# DNS検証の手順

## 📋 概要

AWS Certificate Manager (ACM) で証明書を作成する際、ドメインの所有権を証明するためにDNS検証が必要です。この検証プロセスには通常5-30分程度かかります。

## 🚀 推奨される手順（create-certツール使用）

### 1. 証明書の作成

```bash
create-cert
```

create-certツールが即座にDNS検証レコードを表示します：

```
📝 DNS検証に必要なCNAMEレコード:
以下のレコードをDNSに追加してください:

  レコードタイプ: CNAME
  名前: _xxxxxxxx.example.com
  値: _yyyyyyyy.acm-validations.aws.

💡 DNSレコードに追加する場合（コピペ用）:
cname _xxxxxxxx _yyyyyyyy.acm-validations.aws.
```

### 2. 証明書の状態確認

```bash
# 証明書の一覧と状態を確認
create-cert --list

# ステータスの意味：
# - PENDING_VALIDATION: DNS検証待ち
# - ISSUED: 検証完了（使用可能）
```

### 3. DNSレコードの追加

取得したCNAMEレコードをDNSプロバイダーに追加：

| レコードタイプ | 名前 | 値 |
|------------|------|-----|
| CNAME | _xxxxxxxx.example.com | _yyyyyyyy.acm-validations.aws. |

### 4. 検証の完了を待つ

- DNS設定後、5-30分程度で自動的に検証されます
- 検証が完了すると、デプロイが自動的に再開されます

## 🔍 トラブルシューティング

### 30分以上経っても検証されない場合

1. **DNSレコードの確認**
   ```bash
   nslookup _xxxxxxxx.example.com
   ```

2. **TTLの確認**
   - DNSのTTL（Time To Live）が長い場合、反映に時間がかかることがあります

3. **レコードの再確認**
   - CNAMEレコードの名前と値が正確にコピーされているか確認
   - 末尾のドット（.）も含めて正確に入力

### デプロイをキャンセルする場合

```bash
# Ctrl+C でデプロイを中断
# スタックを削除
npm run destroy
```

## 📚 関連ドキュメント

- [AWS ACM DNS検証](https://docs.aws.amazon.com/ja_jp/acm/latest/userguide/dns-validation.html)
- [DNSプロバイダー別設定ガイド](./dns/)
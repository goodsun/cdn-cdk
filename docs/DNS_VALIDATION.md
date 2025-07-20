# DNS検証の手順

## 📋 概要

AWS Certificate Manager (ACM) で証明書を作成する際、ドメインの所有権を証明するためにDNS検証が必要です。この検証プロセスには通常5-30分程度かかります。

## 🚨 重要な注意事項

**デプロイが一時停止する理由**：
- `npm run deploy` 実行時、証明書の作成段階で一時停止します
- これは**正常な動作**です
- DNS検証が完了するまで待機しています

## 📝 DNS検証の手順

### 1. デプロイを開始

```bash
npm run deploy
```

### 2. CNAMEレコードの確認

デプロイが一時停止したら、以下のいずれかの方法でCNAMEレコードを確認：

#### 方法1: AWS ACMコンソール
1. [AWS ACMコンソール](https://console.aws.amazon.com/acm/)を開く
2. 作成中の証明書を選択
3. 「ドメイン」タブでCNAMEレコードを確認

#### 方法2: AWS CLI
```bash
aws acm list-certificates --region ap-northeast-1
aws acm describe-certificate --certificate-arn <証明書ARN> --region ap-northeast-1
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
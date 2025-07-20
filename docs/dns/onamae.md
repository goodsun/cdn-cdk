# お名前.com DNS設定ガイド

## 📋 必要な情報

デプロイ完了後に表示される以下の情報をメモしてください：

1. **証明書検証用CNAMEレコード**
   - 名前: `_xxxxx.example.com`
   - 値: `_yyyyy.acm-validations.aws.`

2. **CloudFrontドメイン**（CloudFrontを使用する場合）
   - `dxxxxx.cloudfront.net`

## 🔧 設定手順

### Step 1: お名前.comにログイン
1. [お名前.com Navi](https://navi.onamae.com/)にアクセス
2. ドメインNaviにログイン

### Step 2: DNS設定画面へ
1. 「ドメイン」タブをクリック
2. 該当ドメインの「DNS」をクリック
3. 「DNSレコード設定を利用する」を選択

### Step 3: 証明書検証用レコードの追加

1. 「入力」タブで以下を設定：
   - **ホスト名**: `_xxxxx`（実際の値を入力）
   - **TYPE**: `CNAME`
   - **TTL**: `3600`
   - **VALUE**: `_yyyyy.acm-validations.aws.`（実際の値を入力）

2. 「追加」をクリック

### Step 4: CloudFront用レコードの追加（CloudFront使用時）

1. 以下を設定：
   - **ホスト名**: `@`（ルートドメイン）または `www`
   - **TYPE**: `CNAME`
   - **TTL**: `3600`
   - **VALUE**: `dxxxxx.cloudfront.net`（実際の値を入力）

2. 「追加」をクリック

### Step 5: 設定の確認と保存

1. 追加したレコードを確認
2. 「確認画面へ進む」をクリック
3. 「設定する」をクリック

## ⏱️ 反映時間

- DNSレコードの反映：5分〜24時間
- 証明書の検証完了：通常30分以内

## ✅ 確認方法

### DNSレコードの確認
```bash
# Windowsの場合
nslookup _xxxxx.example.com

# Mac/Linuxの場合
dig _xxxxx.example.com CNAME
```

### 証明書の状態確認
1. AWS Certificate Managerコンソールを開く
2. 該当する証明書を選択
3. ステータスが「発行済み」になっていることを確認

## 🆘 トラブルシューティング

### レコードが見つからない
- DNSキャッシュをクリア
- 別のDNSサーバー（8.8.8.8）で確認

### 証明書が検証されない
- CNAMEレコードの値に余分なスペースがないか確認
- TTLを300に下げて再試行
- 24時間経っても検証されない場合は、レコードを再確認

## 📞 サポート

- [お名前.comサポート](https://help.onamae.com/)
- 電話: 0120-921-818（平日10:00-19:00）
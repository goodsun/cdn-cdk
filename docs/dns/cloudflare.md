# Cloudflare DNS設定ガイド

## 📋 必要な情報

デプロイ完了後に表示される以下の情報をメモしてください：

1. **証明書検証用CNAMEレコード**
   - 名前: `_xxxxx.example.com`
   - 値: `_yyyyy.acm-validations.aws.`

2. **CloudFrontドメイン**（CloudFrontを使用する場合）
   - `dxxxxx.cloudfront.net`

## 🔧 設定手順

### Step 1: Cloudflareにログイン
1. [Cloudflare Dashboard](https://dash.cloudflare.com/)にアクセス
2. 該当ドメインを選択

### Step 2: DNS設定画面へ
1. 左メニューから「DNS」をクリック
2. 「Records」タブが選択されていることを確認

### Step 3: 証明書検証用レコードの追加

1. 「Add record」をクリック
2. 以下を設定：
   - **Type**: `CNAME`
   - **Name**: `_xxxxx`（実際の値を入力）
   - **Target**: `_yyyyy.acm-validations.aws.`（実際の値を入力）
   - **Proxy status**: **グレー（DNS only）** ⚠️重要
   - **TTL**: `Auto`

3. 「Save」をクリック

### Step 4: CloudFront用レコードの追加（CloudFront使用時）

1. 「Add record」をクリック
2. 以下を設定：
   - **Type**: `CNAME`
   - **Name**: `@`（ルートドメイン）または `www`
   - **Target**: `dxxxxx.cloudfront.net`（実際の値を入力）
   - **Proxy status**: **グレー（DNS only）** ⚠️重要
   - **TTL**: `Auto`

3. 「Save」をクリック

## ⚠️ 重要な注意点

### Proxy設定について
- **必ずグレー（DNS only）に設定**してください
- オレンジ（Proxied）だとAWS側で検証できません
- CloudFrontを使用する場合、Cloudflareのプロキシは不要です

### ルートドメインのCNAME
- Cloudflareは「CNAME Flattening」により、ルートドメインでもCNAMEが使用可能
- 他のDNSプロバイダーでは使用できない場合があります

## ⏱️ 反映時間

- DNSレコードの反映：即時〜5分
- 証明書の検証完了：通常30分以内

## ✅ 確認方法

### Cloudflare内での確認
1. DNS設定画面でレコードが表示されていることを確認
2. ステータスが「Active」になっていることを確認

### コマンドラインでの確認
```bash
# DNSレコードの確認
dig _xxxxx.example.com CNAME @1.1.1.1

# CloudFrontレコードの確認
dig example.com CNAME @1.1.1.1
```

### 証明書の状態確認
1. AWS Certificate Managerコンソールを開く
2. 該当する証明書を選択
3. ステータスが「発行済み」になっていることを確認

## 🛡️ セキュリティ設定（オプション）

CloudFront設定後、以下のCloudflare機能を併用可能：

1. **Page Rules**
   - キャッシュ設定の最適化
   - HTTPSリダイレクト

2. **Firewall Rules**
   - 特定の国からのアクセス制限
   - ボット対策

3. **SSL/TLS設定**
   - 「Full」または「Full (strict)」に設定

## 🆘 トラブルシューティング

### レコードが保存できない
- レコード名に余分なドメイン名が含まれていないか確認
- 例: `_xxxxx.example.com.example.com` → `_xxxxx`

### 証明書が検証されない
- Proxy statusがグレー（DNS only）になっているか確認
- Universal SSLが干渉していないか確認

### CloudFrontに接続できない
- SSL/TLS設定を「Full」に変更
- Development Modeを一時的に有効化

## 💡 Tips

### パフォーマンス最適化
1. CloudFrontとCloudflareの二重キャッシュを避ける
2. どちらか一方でキャッシュを管理
3. 画像最適化はCloudflare側で実施

### 料金最適化
- CloudflareのFreeプランでも基本機能は利用可能
- 帯域幅はCloudFront側で課金されるため注意

## 📚 参考リンク

- [Cloudflare DNS ドキュメント](https://developers.cloudflare.com/dns/)
- [CNAME Flattening](https://developers.cloudflare.com/dns/cname-flattening/)
- [Cloudflare for SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/)
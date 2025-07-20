# Route53 DNS設定ガイド

## 🚀 自動設定（推奨）

Route53を使用している場合、証明書の検証は自動で行われます！

### 前提条件
- Route53でホストゾーンを作成済み
- ドメインのネームサーバーがRoute53に設定済み

### 自動設定の確認方法
```bash
# デプロイ時のログを確認
npm run deploy

# 以下のようなメッセージが表示されれば自動設定完了
# ✅ Certificate validation records created automatically
```

## 🔧 手動設定が必要な場合

自動設定がうまくいかない場合の手動設定手順：

### Step 1: Route53コンソールにアクセス
1. [AWS Console](https://console.aws.amazon.com/)にログイン
2. Route53サービスを開く

### Step 2: ホストゾーンを選択
1. 「ホストゾーン」をクリック
2. 該当ドメインを選択

### Step 3: 証明書検証用レコードの作成

1. 「レコードを作成」をクリック
2. 以下を設定：
   - **レコード名**: `_xxxxx`（ACMコンソールから取得）
   - **レコードタイプ**: `CNAME`
   - **値**: `_yyyyy.acm-validations.aws.`（ACMコンソールから取得）
   - **TTL**: `300`

3. 「レコードを作成」をクリック

### Step 4: CloudFront用レコードの作成（CloudFront使用時）

1. 「レコードを作成」をクリック
2. 以下を設定：
   - **レコード名**: 空欄（ルートドメイン）または `www`
   - **レコードタイプ**: `A`
   - **エイリアス**: オン
   - **トラフィックのルーティング先**: 
     - CloudFront ディストリビューション
     - 該当するディストリビューションを選択

3. 「レコードを作成」をクリック

## 🎯 Route53の利点

1. **自動検証**: ACM証明書の検証レコードが自動作成
2. **エイリアス**: CloudFrontへの接続が無料
3. **ヘルスチェック**: 自動フェイルオーバー設定可能
4. **統合管理**: AWSサービス間の連携がスムーズ

## 💰 料金

- ホストゾーン: $0.50/月
- クエリ: $0.40/100万クエリ
- エイリアスレコード: 無料

## ✅ 確認方法

### レコードの確認
```bash
# Route53のレコードを確認
aws route53 list-resource-record-sets --hosted-zone-id Z1234567890ABC

# DNSクエリで確認
dig example.com
dig _xxxxx.example.com CNAME
```

### 証明書の状態確認
```bash
# ACM証明書の状態を確認
aws acm describe-certificate --certificate-arn arn:aws:acm:region:account:certificate/xxxxx
```

## 🆘 トラブルシューティング

### ホストゾーンが見つからない
```bash
# ホストゾーン一覧を確認
aws route53 list-hosted-zones
```

### 自動検証が動作しない
- IAMロールに`route53:ChangeResourceRecordSets`権限があるか確認
- ホストゾーンIDが正しく設定されているか確認

### レコードが競合する
- 既存の同名レコードを削除または更新
- レコードセットとして一括更新

## 🔍 便利なコマンド

```bash
# ホストゾーンIDを取得
aws route53 list-hosted-zones-by-name --domain-name example.com

# レコードの作成状態を確認
aws route53 get-change --id /change/C1234567890ABC

# 全レコードをJSON形式で出力
aws route53 list-resource-record-sets --hosted-zone-id Z1234567890ABC --output json
```

## 📚 参考リンク

- [Route53 ドキュメント](https://docs.aws.amazon.com/ja_jp/route53/)
- [ACM DNS検証](https://docs.aws.amazon.com/ja_jp/acm/latest/userguide/dns-validation.html)
- [CloudFront エイリアス設定](https://docs.aws.amazon.com/ja_jp/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html)
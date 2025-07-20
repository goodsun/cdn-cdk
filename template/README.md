# CDN Project

AWS CDKで構築されたCDN (CloudFront) プロジェクト。

## 前提条件

- Node.js 18以上
- AWS CLI設定済み（`aws configure`）
- 有効なドメイン名

## セットアップ

### 1. 環境変数の設定

```bash
cp .env.example .env
# .envファイルを編集して必要な値を設定
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. CDKブートストラップ（初回のみ）

```bash
npm run bootstrap
```

### 4. デプロイ

```bash
npm run deploy
```

#### ⚠️ DNS検証による一時停止について

**重要**: デプロイ中、証明書作成の段階で**10-30分程度停止します**。これは正常な動作です。

1. **デプロイが停止したら**
   ```bash
   # 別のターミナルで実行
   npm run show-validation
   ```
   これでCNAMEレコードが自動的に表示されます

2. **DNSレコードを追加**
   - 表示されたCNAMEレコードをDNSプロバイダーに追加
   - 例: `_xxxxxxxx.example.com` → `_yyyyyyyy.acm-validations.aws.`

3. **検証完了を待つ**
   - 5-30分で自動的に検証されます
   - 検証が完了するとデプロイが自動的に再開されます

## 設定項目

`.env`ファイルで以下の設定が可能です：

- `CDK_DEFAULT_ACCOUNT`: AWSアカウントID
- `CDK_DEFAULT_REGION`: デフォルトリージョン
- `DOMAIN_NAME`: ドメイン名
- `USE_CLOUDFRONT`: CloudFrontを使用するか
- `ORIGIN_TYPE`: オリジンタイプ (s3-new, http, apigateway等)
- `ORIGIN_DOMAIN`: オリジンのドメイン（必要な場合）
- `USE_MONITORING`: 証明書監視を有効にするか
- `NOTIFICATION_EMAIL`: 通知先メールアドレス

## デプロイ後の作業

1. **DNS設定**: CloudFrontのドメイン名をCNAMEレコードとして設定
2. **証明書検証**: ACM証明書のDNS検証レコードを設定
3. **動作確認**: `https://your-domain.com` でアクセス確認

## コマンド一覧

- `npm run deploy`: デフォルト環境にデプロイ
- `npm run deploy:dev`: 開発環境にデプロイ
- `npm run deploy:prod`: 本番環境にデプロイ
- `npm run destroy`: リソースを削除
- `npm run cdk synth`: CloudFormationテンプレートを生成
- `npm run show-validation`: DNS検証レコードを表示
- `npm run check-validation`: 検証状況を確認

## トラブルシューティング

### 証明書の検証が完了しない

1. AWS Certificate Managerコンソールを開く
2. 該当する証明書を選択
3. 「検証」タブでCNAMEレコードを確認
4. DNSプロバイダーで該当レコードを追加

### CloudFrontのデプロイが遅い

CloudFrontのデプロイには15-30分かかることがあります。

## リソースの削除

```bash
npm run destroy
```

注意: S3バケットにファイルがある場合は、先に削除してください。
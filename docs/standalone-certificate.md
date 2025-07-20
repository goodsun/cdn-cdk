# スタンドアロン証明書の作成

## 概要

`create-cert` コマンドを使用して、CDK スタックとは独立した ACM 証明書を作成できます。これにより、証明書のライフサイクルをインフラストラクチャとは別に管理できます。

## なぜスタンドアロン証明書？

### メリット

1. **永続性**

   - CDK スタックを削除しても証明書は残る
   - 開発環境の再構築時も証明書を再作成する必要がない

2. **再利用性**

   - 複数のプロジェクト/スタックで同じ証明書を使用可能
   - ワイルドカード証明書（\*.example.com）を一度作成すれば、すべてのサブドメインで利用可能

3. **時間の節約**

   - DNS 検証は最初の 1 回のみ（10-30 分）
   - 以降は即座に使用可能

4. **柔軟性**
   - 証明書の更新タイミングを自由に管理
   - 複数のリージョンで同じドメインの証明書を管理しやすい

## 使用方法

### 1. インストール

```bash
npm install -g create-cdn
```

### 2. 証明書の作成

```bash
create-cert
```

対話形式で以下を入力：

```
🔐 AWS Certificate Manager (ACM) 証明書作成ツール

証明書を作成するドメイン名を入力してください (例: example.com, *.example.com): *.example.com

リージョンを選択してください:
1. us-east-1 (CloudFront用)
2. ap-northeast-1 (東京リージョン)
3. その他
選択 (1-3): 1

追加のドメイン名を含めますか？ (y/N): y
✓ ベースドメイン example.com を自動追加しました

📋 作成する証明書の情報:
  プライマリドメイン: *.example.com
  追加ドメイン: example.com
  リージョン: us-east-1

この内容で証明書を作成しますか？ (y/N): y
```

### 3. DNS 検証

作成後、DNS 検証用の CNAME レコードが表示されます：

```
📝 DNS検証に必要なCNAMEレコード:
以下のレコードをDNSに追加してください:

  レコードタイプ: CNAME
  名前: _abcdef.example.com
  値: _ghijkl.acm-validations.aws.
```

### 4. CDK での使用

#### 方法 1: SSM パラメータ経由（推奨）

```bash
# 証明書ARNをSSMに保存
aws ssm put-parameter \
  --name "/acm/wildcard.example.com/certificate-arn" \
  --value "arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx" \
  --type String \
  --region us-east-1
```

CDK コード内で自動的に検出されます。

#### 方法 2: 直接 ARN を指定

```typescript
const certificate = acm.Certificate.fromCertificateArn(
  this,
  "ImportedCert",
  "arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx"
);
```

## ベストプラクティス

### ワイルドカード証明書の活用

1. **ドメイン構成の計画**

   ```
   *.example.com（ワイルドカード）
   ├── dev.example.com
   ├── staging.example.com
   ├── api.example.com
   └── app.example.com
   ```

2. **リージョンの選択**

   - CloudFront 用: **必ず us-east-1**
   - ALB/APIGateway 用: 実際に使用するリージョン

3. **命名規則**
   - ワイルドカード: `*.domain.com`
   - 特定サブドメイン: `subdomain.domain.com`
   - 複数レベル: `*.subdomain.domain.com`

### 証明書の管理

1. **タグ付け**

   ```bash
   aws acm add-tags-to-certificate \
     --certificate-arn arn:aws:acm:... \
     --tags Key=Environment,Value=Production Key=Project,Value=MyApp
   ```

2. **一覧確認**

   ```bash
   aws acm list-certificates --region us-east-1
   ```

3. **詳細確認**
   ```bash
   aws acm describe-certificate --certificate-arn arn:aws:acm:...
   ```

## トラブルシューティング

### DNS 検証が完了しない

1. CNAME レコードが正しく設定されているか確認
2. DNS 伝播に時間がかかる場合があります（最大 72 時間）
3. ネームサーバーが正しく設定されているか確認

### 証明書が見つからない

1. 正しいリージョンを確認
2. 証明書のステータスが「ISSUED」になっているか確認
3. ARN が正しくコピーされているか確認

### 制限事項

- 同一ドメインの証明書は各リージョンで作成可能
- 証明書の削除は、使用中のリソースがない場合のみ可能
- DNS 検証の有効期限は作成から 1 年間

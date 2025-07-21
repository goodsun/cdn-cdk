# create-cdn E2Eテスト完全ガイド

## 更新履歴
- 2025-07-22: 自動クリーンアップ機能追加（スタックと証明書を自動削除）
- 2025-07-22: `create-cert -l`と`create-cdn -l`に削除コマンド表示機能追加

## 概要

このドキュメントでは、create-cdnのエンドツーエンド（E2E）テストを実行するための完全な手順を説明します。
実際のAWS環境とドメインを使用して、証明書作成からCDNデプロイまでの全プロセスをテストします。

## 前提条件

- AWSアカウント
- 管理可能なドメイン（例：example.com）
- AWS CLI設定済み
- Node.js 18以上
- AWS CDK v2インストール済み

## 目次

1. [DNS委任の設定](#1-dns委任の設定)
2. [Route 53ホストゾーンの作成](#2-route-53ホストゾーンの作成)
3. [E2Eテスト環境のセットアップ](#3-e2eテスト環境のセットアップ)
4. [E2Eテストの実行](#4-e2eテストの実行)
5. [テスト結果の確認](#5-テスト結果の確認)
6. [クリーンアップ](#6-クリーンアップ)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. DNS委任の設定

### 1.1 サブドメインの選択

E2Eテスト専用のサブドメインを決めます。推奨構成：

```
example.com              # メインドメイン（レジストラ管理）
└── aws.example.com      # AWSテスト用（Route 53に委任）
    ├── e2e.aws.example.com
    ├── dev.aws.example.com
    └── test.aws.example.com
```

### 1.2 Route 53でホストゾーン作成

```bash
# ホストゾーンを作成
aws route53 create-hosted-zone \
  --name aws.example.com \
  --caller-reference "e2e-test-$(date +%s)"
```

出力例：
```json
{
  "HostedZone": {
    "Id": "/hostedzone/Z1234567890ABC",
    "Name": "aws.example.com."
  },
  "DelegationSet": {
    "NameServers": [
      "ns-1234.awsdns-12.org",
      "ns-5678.awsdns-34.co.uk",
      "ns-9012.awsdns-56.com",
      "ns-3456.awsdns-78.net"
    ]
  }
}
```

### 1.3 レジストラでNS委任設定

#### ValueDomainの場合

1. ValueDomainにログイン
2. 「ドメイン」→「ドメインの設定操作」
3. 対象ドメインの「DNS/URL」をクリック
4. 以下のNSレコードを追加：

```
ns aws ns-1234.awsdns-12.org.
ns aws ns-5678.awsdns-34.co.uk.
ns aws ns-9012.awsdns-56.com.
ns aws ns-3456.awsdns-78.net.
```

#### お名前.comの場合

1. お名前.comにログイン
2. 「DNS」→「ドメインのDNS設定」
3. 「DNSレコード設定を利用する」を選択
4. 以下を追加：

```
ホスト名: aws
タイプ: NS
値: ns-1234.awsdns-12.org
（4つのNSレコードそれぞれを追加）
```

### 1.4 DNS委任の確認

```bash
# NSレコードが正しく設定されているか確認
dig ns aws.example.com +short

# 期待される出力：
# ns-1234.awsdns-12.org.
# ns-5678.awsdns-34.co.uk.
# ns-9012.awsdns-56.com.
# ns-3456.awsdns-78.net.
```

---

## 2. Route 53ホストゾーンの作成

### 2.1 既存のホストゾーン確認

```bash
# ホストゾーン一覧を確認
aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='aws.example.com.']"
```

### 2.2 ホストゾーンIDの取得

```bash
# ホストゾーンIDを環境変数に設定
export HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='aws.example.com.'].Id" \
  --output text | cut -d'/' -f3)

echo "Hosted Zone ID: $HOSTED_ZONE_ID"
```

---

## 3. E2Eテスト環境のセットアップ

### 3.1 プロジェクトのクローン

```bash
git clone https://github.com/your-org/create-cdn.git
cd create-cdn
```

### 3.2 依存関係のインストール

```bash
npm install
npm run build
```

### 3.3 E2E設定ファイルの作成

```bash
# 設定ファイルを作成
cat > .e2e-aws-config.json << EOF
{
  "hostedZoneId": "$HOSTED_ZONE_ID",
  "baseDomain": "aws.example.com",
  "testEnvironments": {
    "e2e": {
      "domain": "e2e.aws.example.com",
      "subdomains": [
        "test1.e2e.aws.example.com",
        "test2.e2e.aws.example.com",
        "test3.e2e.aws.example.com"
      ]
    },
    "dev": {
      "domain": "dev.aws.example.com",
      "wildcard": "*.dev.aws.example.com"
    },
    "demo": {
      "domain": "demo.aws.example.com"
    }
  }
}
EOF
```

### 3.4 テスト用ワークスペースの準備

```bash
# E2Eワークスペースディレクトリを作成
mkdir -p e2e-workspace

# .gitignoreに追加（既に追加済みの場合はスキップ）
echo "e2e-workspace/" >> .gitignore
```

---

## 4. E2Eテストの実行

### 4.1 基本的なE2Eテスト実行

```bash
# E2Eテストスクリプトを実行
./test-scenarios/run-e2e-test-aws-real.sh
```

### 4.2 カスタムオプションでの実行

```bash
# リソースを残してデバッグ
./test-scenarios/run-e2e-test-aws-real.sh --keep

# カスタムドメインでテスト
./test-scenarios/run-e2e-test-aws-real.sh --domain my-test.e2e.aws.example.com
```

### 4.3 テスト実行の流れ

1. **証明書の作成**
   ```
   - ACMで証明書リクエスト
   - DNS検証レコードの自動作成
   - 証明書発行の待機（最大10分）
   ```

2. **CDNプロジェクトの作成**
   ```
   - テンプレートからプロジェクト生成
   - 依存関係のインストール
   - 環境変数の設定
   ```

3. **CDKデプロイ**
   ```
   - CloudFormationスタック作成
   - S3バケット作成
   - CloudFrontディストリビューション作成
   - Route 53 Aレコード設定
   ```

4. **動作確認**
   ```
   - HTTPS接続テスト
   - SSL証明書確認
   - コンテンツ配信確認
   ```

---

## 5. テスト結果の確認

### 5.1 ログファイルの確認

```bash
# 最新のログファイルを表示
ls -la test-reports/
cat test-reports/e2e-aws-real-*.log
```

### 5.2 デプロイされたリソースの確認

```bash
# CloudFormationスタック
aws cloudformation describe-stacks \
  --query "Stacks[?contains(StackName, 'E2ETestStack')]"

# CloudFrontディストリビューション
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='CDN for test-*.e2e.aws.example.com']"

# Route 53レコード
aws route53 list-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --query "ResourceRecordSets[?contains(Name, 'e2e')]"
```

### 5.3 ブラウザでの確認

テストで作成されたURLにアクセス：
```
https://test-YYYYMMDD-HHMMSS.e2e.aws.example.com
```

期待される結果：
- SSL証明書が有効
- テストページが表示される
- HTTPSで正常にアクセス可能

---

## 6. クリーンアップ

### 6.1 自動クリーンアップ

テストスクリプトは終了時に自動的にリソースをクリーンアップします：

- CloudFormationスタックの削除
- Route 53レコードの削除
- ACM証明書の削除
- テストプロジェクトディレクトリの削除

### 6.2 手動クリーンアップ

自動クリーンアップが失敗した場合：

```bash
# スタック名を確認
STACK_NAME=$(aws cloudformation list-stacks \
  --query "StackSummaries[?contains(StackName, 'E2ETestStack') && StackStatus!='DELETE_COMPLETE'].StackName" \
  --output text)

# スタックを削除
aws cloudformation delete-stack --stack-name $STACK_NAME

# Route 53レコードを削除
aws route53 list-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --query "ResourceRecordSets[?contains(Name, 'test-')]" | \
  jq -c '.[]' | while read record; do
    # レコードを削除するコマンドを生成
    echo "Deleting: $(echo $record | jq -r .Name)"
done
```

---

## 7. トラブルシューティング

### 7.1 DNS委任が機能しない

**症状**: `dig ns aws.example.com`で結果が返らない

**解決策**:
1. レジストラでのNS設定を再確認
2. 48時間待つ（DNS伝播時間）
3. 親ドメインのDNSサーバーを直接確認：
   ```bash
   dig @ns1.example.com ns aws.example.com
   ```

### 7.2 証明書検証が失敗する

**症状**: 証明書が「Pending Validation」のまま

**解決策**:
1. DNS検証レコードが正しく設定されているか確認：
   ```bash
   dig txt _acme-challenge.test.e2e.aws.example.com
   ```
2. Route 53のホストゾーンIDが正しいか確認
3. ACMコンソールで検証レコードの値を再確認

### 7.3 CloudFrontデプロイが失敗する

**症状**: CDKデプロイでエラー

**解決策**:
1. AWS認証情報を確認：
   ```bash
   aws sts get-caller-identity
   ```
2. リージョンがus-east-1であることを確認
3. IAM権限が十分か確認

### 7.4 HTTPS接続ができない

**症状**: ブラウザでSSLエラー

**解決策**:
1. CloudFrontの展開状況を確認（15-20分かかる場合あり）
2. Route 53のAレコードが正しく設定されているか確認
3. 証明書のドメイン名とアクセスしているドメイン名が一致するか確認

---

## まとめ

このガイドに従うことで、create-cdnの完全なE2Eテストを実行できます。
定期的にE2Eテストを実行することで、ツールの品質と信頼性を確保できます。

### 次のステップ

1. CI/CDパイプラインへの統合
2. 複数リージョンでのテスト
3. パフォーマンステストの追加
4. セキュリティテストの実装

### 参考リンク

- [AWS Route 53ドキュメント](https://docs.aws.amazon.com/route53/)
- [AWS Certificate Manager](https://docs.aws.amazon.com/acm/)
- [AWS CloudFront](https://docs.aws.amazon.com/cloudfront/)
- [AWS CDK](https://docs.aws.amazon.com/cdk/)
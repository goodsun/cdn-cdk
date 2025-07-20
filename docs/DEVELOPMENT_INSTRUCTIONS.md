# ACM証明書管理CDK 開発指示書

## 🎯 プロジェクトの目的

複数のマイクロサービスで共有するACM証明書を一元管理し、各サービスからSSM Parameter Store経由で参照できるようにする。

## 📋 機能要件

### 必須機能

1. **対話型CLIツール (create-cdn)**
   - プロンプトで設定を入力
   - 自動でプロジェクトテンプレート生成
   - 環境変数の自動設定

2. **7種類のオリジンタイプ対応**
   - s3-new: 新規S3バケット（OAC経由）
   - s3-website-new: 新規S3静的ウェブサイト
   - s3-website-existing: 既存S3静的ウェブサイト
   - s3-existing: 既存S3バケット（OAC経由）
   - http: 既存HTTP/HTTPSサイト
   - alb: Application Load Balancer
   - apigateway: API Gateway

3. **クロスリージョン対応**
   - CloudFront証明書: us-east-1（必須）
   - リソース: デプロイリージョン
   - crossRegionReferencesで自動解決

4. **DNS設定支援**
   - デプロイ後にDNS設定指示を表示
   - サブドメインとCloudFrontドメインを明示

### オプション機能

1. **証明書監視**
   - 有効期限アラート
   - SNSメール通知
   - CloudWatchアラーム

2. **既存証明書の使用**
   - CERTIFICATE_ARN環境変数で指定
   - 開発環境での再利用

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────┐
│          ACM Stack                  │
├─────────────────────────────────────┤
│  Regional Certificate               │
│  - *.yourdomain.com                │
│  - yourdomain.com                  │
├─────────────────────────────────────┤
│  CloudFront Certificate (us-east-1) │
│  - *.yourdomain.com                │
│  - yourdomain.com                  │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│     SSM Parameter Store             │
│  /acm/regional-certificate-arn      │
│  /acm/cloudfront-certificate-arn    │
└─────────────────────────────────────┘
           │
    ┌──────┴──────┬──────────────┐
    ▼             ▼              ▼
Service A     Service B      Service C
```

## 📁 プロジェクト構造

```
acm-cdk/
├── bin/
│   └── acm-cdk.ts           # CDKアプリエントリーポイント
├── lib/
│   └── acm-stack.ts         # メインスタック定義
├── docs/
│   ├── DEVELOPMENT_INSTRUCTIONS.md  # この文書
│   ├── DEPLOYMENT_GUIDE.md          # デプロイガイド
│   └── TROUBLESHOOTING.md           # トラブルシューティング
├── scripts/
│   ├── validate-dns.sh      # DNS検証確認スクリプト
│   └── export-arns.sh       # ARNエクスポートスクリプト
├── test/
│   └── acm-stack.test.ts    # ユニットテスト
├── .env.example             # 環境変数テンプレート
├── .env.schema.yml          # 環境変数スキーマ
├── .gitignore
├── README.md
├── cdk.json                 # CDK設定
├── jest.config.js           # テスト設定
├── package.json
└── tsconfig.json
```

## 🔧 実装詳細

### 1. メインスタック実装

```typescript
// lib/acm-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface AcmStackProps extends cdk.StackProps {
  domainName: string;
  environment?: string;
  notificationEmail?: string;
}

export class AcmStack extends cdk.Stack {
  public readonly regionalCertificate: acm.Certificate;
  public readonly cloudfrontCertificate: acm.DnsValidatedCertificate;

  constructor(scope: Construct, id: string, props: AcmStackProps) {
    super(scope, id, props);

    const { domainName, environment = 'shared', notificationEmail } = props;
    const prefix = environment === 'prod' ? '' : `${environment}.`;
    const fullDomain = `${prefix}${domainName}`;

    // リージョナル証明書（API Gateway用）
    this.regionalCertificate = new acm.Certificate(this, 'RegionalCertificate', {
      domainName: `*.${fullDomain}`,
      subjectAlternativeNames: [fullDomain],
      validation: acm.CertificateValidation.fromDns(),
    });

    // CloudFront用証明書（us-east-1）
    this.cloudfrontCertificate = new acm.DnsValidatedCertificate(this, 'CloudFrontCertificate', {
      domainName: `*.${fullDomain}`,
      subjectAlternativeNames: [fullDomain],
      region: 'us-east-1',
    });

    // SSM Parameter Store
    const ssmPrefix = environment === 'shared' ? '/acm' : `/acm/${environment}`;

    new ssm.StringParameter(this, 'RegionalCertArnParameter', {
      parameterName: `${ssmPrefix}/regional-certificate-arn`,
      stringValue: this.regionalCertificate.certificateArn,
      description: `Regional ACM certificate ARN for *.${fullDomain}`,
    });

    new ssm.StringParameter(this, 'CloudFrontCertArnParameter', {
      parameterName: `${ssmPrefix}/cloudfront-certificate-arn`,
      stringValue: this.cloudfrontCertificate.certificateArn,
      description: `CloudFront ACM certificate ARN for *.${fullDomain}`,
    });

    new ssm.StringParameter(this, 'DomainNameParameter', {
      parameterName: `${ssmPrefix}/domain-name`,
      stringValue: domainName,
      description: 'Base domain name',
    });

    // CloudFormation Exports
    new cdk.CfnOutput(this, 'RegionalCertificateArn', {
      value: this.regionalCertificate.certificateArn,
      exportName: `${environment}-regional-certificate-arn`,
    });

    new cdk.CfnOutput(this, 'CloudFrontCertificateArn', {
      value: this.cloudfrontCertificate.certificateArn,
      exportName: `${environment}-cloudfront-certificate-arn`,
    });

    // 通知設定（オプション）
    if (notificationEmail) {
      const topic = new sns.Topic(this, 'CertificateNotificationTopic', {
        displayName: `ACM Certificate Notifications - ${fullDomain}`,
      });

      new sns.Subscription(this, 'EmailSubscription', {
        topic,
        protocol: sns.SubscriptionProtocol.EMAIL,
        endpoint: notificationEmail,
      });
    }

    // 削除保護
    this.regionalCertificate.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.cloudfrontCertificate.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // タグ付け
    cdk.Tags.of(this).add('Purpose', 'shared-certificates');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Domain', fullDomain);
    cdk.Tags.of(this).add('ManagedBy', 'acm-cdk');
  }
}
```

### 2. エントリーポイント

```typescript
// bin/acm-cdk.ts
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AcmStack } from '../lib/acm-stack';

const app = new cdk.App();

const domainName = process.env.DOMAIN_NAME;
if (!domainName) {
  throw new Error('DOMAIN_NAME environment variable is required');
}

const environment = process.env.CDK_ENV || 'shared';
const account = process.env.CDK_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_REGION || process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';
const notificationEmail = process.env.NOTIFICATION_EMAIL;

new AcmStack(app, `acm-certificate-${environment}`, {
  env: { account, region },
  domainName,
  environment,
  notificationEmail,
  description: `ACM certificates for ${environment === 'prod' ? '' : `${environment}.`}${domainName}`,
});
```

### 3. 環境変数設定

```yaml
# .env.schema.yml
environment_variables:
  - name: DOMAIN_NAME
    required: true
    description: "ベースドメイン名（例: yourdomain.com）"
    pattern: "^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$"
    
  - name: CDK_ENV
    required: false
    default: "shared"
    description: "環境名（shared/dev/stg/prod）"
    allowed_values:
      - shared
      - dev
      - stg
      - prod
      
  - name: CDK_ACCOUNT
    required: false
    description: "AWSアカウントID"
    pattern: "^[0-9]{12}$"
    
  - name: CDK_REGION
    required: false
    default: "ap-northeast-1"
    description: "デプロイリージョン"
    
  - name: NOTIFICATION_EMAIL
    required: false
    description: "通知用メールアドレス"
    pattern: "^[^@]+@[^@]+\\.[^@]+$"
```

## 🚀 デプロイ手順

### 1. 初回セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
vi .env  # DOMAIN_NAMEを設定

# CDKブートストラップ（初回のみ）
cdk bootstrap
```

### 2. デプロイ

```bash
# ドライラン
cdk synth

# デプロイ
cdk deploy
```

### 3. DNS検証

```bash
# 検証用スクリプト実行
./scripts/validate-dns.sh

# または手動で確認
aws acm describe-certificate \
  --certificate-arn $(aws ssm get-parameter \
    --name /acm/regional-certificate-arn \
    --query 'Parameter.Value' --output text)
```

## 🔒 セキュリティ考慮事項

1. **削除保護**
   - 全証明書にRETAINポリシー適用
   - CloudFormationスタックの削除保護も推奨

2. **アクセス制御**
   - SSMパラメータへの読み取り権限のみ付与
   - 各サービスは必要最小限の権限

3. **監査**
   - CloudTrailで証明書関連の操作を記録
   - 証明書の有効期限監視

## 📊 監視・アラート

### CloudWatchアラーム設定

```typescript
// 証明書の有効期限監視（30日前に通知）
new cloudwatch.Alarm(this, 'CertificateExpiryAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/CertificateManager',
    metricName: 'DaysToExpiry',
    dimensionsMap: {
      CertificateArn: this.regionalCertificate.certificateArn,
    },
  }),
  threshold: 30,
  evaluationPeriods: 1,
});
```

## ⚡ ベストプラクティス

1. **環境分離**
   - 本番用とそれ以外で証明書を分ける
   - dev/stgは共有でも可

2. **命名規則**
   ```
   shared: *.yourdomain.com
   dev:    *.dev.yourdomain.com
   stg:    *.stg.yourdomain.com
   prod:   *.yourdomain.com
   ```

3. **コスト最適化**
   - ACM証明書は無料
   - 環境ごとに証明書を作らない（ワイルドカードを活用）

## 🐛 既知の問題と回避策

1. **us-east-1の証明書作成**
   - クロスリージョンスタックが必要
   - DnsValidatedCertificateを使用

2. **DNS検証タイムアウト**
   - 手動でDNSレコード追加が必要
   - 自動化する場合はRoute53 HostedZone必須

## 📝 今後の拡張計画

1. **自動DNS検証**
   - Route53統合（オプション）

2. **証明書ローテーション通知**
   - 更新前アラート

3. **マルチアカウント対応**
   - Organizations連携
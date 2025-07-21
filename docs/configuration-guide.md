# 設定ガイド（上級者向け）

このガイドは、create-cdnツールで生成されたCDKプロジェクトをカスタマイズしたい上級者向けの内容です。通常のユーザーは、create-cdnツールの対話形式で十分に設定できます。

## 注意事項

このドキュメントは生成されたCDKコードの内部構造に関する説明です。一般的な使用では、以下のツールを使用してください：

- `create-cert`: SSL証明書の作成・管理
- `create-cdn`: CDNプロジェクトの作成・デプロイ

## 設定方法

create-cdn は複数の設定方法をサポートしており、優先順位は以下の通りです：

1. **直接指定** （最優先）
2. **環境変数**
3. **CDK コンテキスト**
4. **設定ファイル**

## 1. 直接指定（推奨）

最も明確で型安全な方法です：

```typescript
import { CdnStack } from "./lib/cdn-stack";

new CdnStack(app, "MyCdn", {
  domain: "example.com",
  useCloudFront: true,
  useMonitoring: true,
  notificationEmail: "admin@example.com",
  originType: "s3-new", // 7種類から選択
  env: {
    account: "123456789012",
    region: "ap-northeast-1",
  },
  crossRegionReferences: true, // CloudFront証明書用
});
```

### メリット:

- TypeScript による型安全性
- 明確で分かりやすい
- バージョン管理しやすい
- 外部依存なし

## 2. 環境変数

CI/CD パイプラインや環境別設定に便利です：

```bash
# 基本設定
export DOMAIN_NAME=example.com
export USE_CLOUDFRONT=true
export USE_MONITORING=true
export NOTIFICATION_EMAIL=admin@example.com

# CloudFront設定
export ORIGIN_TYPE=s3-new  # s3-new/s3-website-new/s3-website-existing/s3-existing/http/alb/apigateway
export ORIGIN_DOMAIN=origin.example.com  # http/alb/apigatewayの場合
export ORIGIN_PATH=/api  # オプション


# AWS環境
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=ap-northeast-1

# 既存証明書を使用（オプション）
export CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/abc-123
```

### コード内での使用方法:

```typescript
new CdnStack(app, "MyCdn", {
  domain: process.env.DOMAIN_NAME!,
  useCloudFront: process.env.USE_CLOUDFRONT === "true",
  useMonitoring: process.env.USE_MONITORING === "true",
  notificationEmail: process.env.NOTIFICATION_EMAIL,
  originType: process.env.ORIGIN_TYPE,
  originDomain: process.env.ORIGIN_DOMAIN,
  originPath: process.env.ORIGIN_PATH,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
});
```

### メリット:

- 環境間での切り替えが簡単
- コード変更不要
- 秘密情報の管理に適している（適切なセキュリティ対策と併用）

## 3. CDK コンテキスト

CDK の組み込みコンテキストシステムを使用：

### コマンドライン:

```bash
cdk deploy -c domainName=example.com
```

### cdk.json:

```json
{
  "app": "npx ts-node bin/app.ts",
  "context": {
    "domainName": "example.com",
    "useCloudFront": true,
    "originType": "s3-new",
    "notificationEmail": "admin@example.com"
  },
  "requireApproval": "never",
  "toolkitStackName": "CDKToolkit",
  "toolkitBucketName": "cdk-toolkit-bucket"
}
```

### コード内での使用方法:

```typescript
const domain = app.node.tryGetContext("domainName") || "example.com";
const useCloudFront = app.node.tryGetContext("useCloudFront") ?? true;
const originType = app.node.tryGetContext("originType") || "s3-new";

new CdnStack(app, "MyCdn", {
  domain: domain,
  useCloudFront: useCloudFront,
  originType: originType,
  notificationEmail: app.node.tryGetContext("notificationEmail"),
  useMonitoring: !!app.node.tryGetContext("notificationEmail"),
  crossRegionReferences: true,
});
```

### メリット:

- CDK と統合されている
- デプロイ時に上書き可能
- スタック固有の設定に適している

## 4. 設定ファイル

複雑な設定に対応：

### config.json:

```json
{
  "domainName": "example.com",
  "originType": "http",
  "originDomain": "origin.example.com",
  "useCloudFront": true,
  "useMonitoring": true,
  "notificationEmail": "ops@example.com"
}
```

### 使用方法:

```typescript
import * as fs from "fs";

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

new CdnStack(app, "CdnStack", {
  domain: config.domainName,
  useCloudFront: config.useCloudFront,
  originType: config.originType,
  originDomain: config.originDomain,
  originPath: config.originPath,
  useMonitoring: config.useMonitoring,
  notificationEmail: config.notificationEmail,
  crossRegionReferences: true,
});
```

### メリット:

- 複雑な設定に対応
- 環境別設定が可能
- 複数ドメインの管理が簡単

## ベストプラクティス

### 1. 環境別設定

```typescript
// 推奨パターン
const isProd = process.env.IS_PRODUCTION === "true";

new CdnStack(app, "CdnStack", {
  domain: isProd ? "example.com" : "dev.example.com",
  useCloudFront: true,
  originType: isProd ? "http" : "s3-new",
  originDomain: isProd ? "origin.example.com" : undefined,
  useMonitoring: true,
  notificationEmail: isProd ? "ops@example.com" : "dev@example.com",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "ap-northeast-1",
  },
  crossRegionReferences: true,
});
```

### 2. 検証

設定は必ず検証しましょう：

```typescript
function validateConfig(config: any) {
  if (!config.domain) {
    throw new Error("domainは必須です");
  }

  if (!config.domain.includes(".")) {
    throw new Error("domainは有効なドメインである必要があります");
  }

  if (config.useCloudFront && !config.originType) {
    throw new Error("CloudFrontを使用する場合、originTypeは必須です");
  }

  const validOriginTypes = [
    "s3-new",
    "s3-website-new",
    "s3-website-existing",
    "s3-existing",
    "http",
    "alb",
    "apigateway",
  ];
  if (config.originType && !validOriginTypes.includes(config.originType)) {
    throw new Error(
      `originTypeは次のいずれかである必要があります: ${validOriginTypes.join(
        ", "
      )}`
    );
  }

  const requiresOriginDomain = [
    "http",
    "alb",
    "apigateway",
    "s3-website-existing",
    "s3-existing",
  ];
  if (
    requiresOriginDomain.includes(config.originType) &&
    !config.originDomain
  ) {
    throw new Error(
      `originType '${config.originType}' の場合、originDomainは必須です`
    );
  }
}
```

### 3. 秘密情報の管理

機密データは決してコミットしないでください：

```typescript
// 悪い例 - これはやらないで
new CdnStack(app, "MyCdn", {
  domain: "example.com",
  notificationEmail: "admin@example.com", // メールアドレスが露出
  certificateArn: "arn:aws:acm:us-east-1:123456789012:certificate/abc-123", // ARNが露出
});

// 良い例 - 環境変数を使用
new CdnStack(app, "MyCdn", {
  domain: process.env.DOMAIN_NAME!,
  notificationEmail: process.env.NOTIFICATION_EMAIL!,
  certificateArn: process.env.CERTIFICATE_ARN,
});
```

## 完全な例

複数の方法を組み合わせた例：

```typescript
import { App } from "aws-cdk-lib";
import { CdnStack } from "./lib/cdn-stack";

const app = new App();

// 1. 複数のソースから設定を構築
const config = {
  // 環境変数から（最優先）
  domain:
    process.env.DOMAIN_NAME ||
    // CDKコンテキストから
    app.node.tryGetContext("domainName") ||
    // デフォルト
    "example.com",

  useCloudFront:
    (process.env.USE_CLOUDFRONT === "true" ||
      app.node.tryGetContext("useCloudFront")) ??
    true,

  originType:
    process.env.ORIGIN_TYPE || app.node.tryGetContext("originType") || "s3-new",

  originDomain:
    process.env.ORIGIN_DOMAIN || app.node.tryGetContext("originDomain"),

  originPath: process.env.ORIGIN_PATH || app.node.tryGetContext("originPath"),

  useMonitoring:
    (process.env.USE_MONITORING === "true" ||
      app.node.tryGetContext("useMonitoring")) ??
    true,

  notificationEmail:
    process.env.NOTIFICATION_EMAIL ||
    app.node.tryGetContext("notificationEmail") ||
    "admin@example.com",

  certificateArn:
    process.env.CERTIFICATE_ARN || app.node.tryGetContext("certificateArn"),

  account: process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext("account"),

  region:
    process.env.CDK_DEFAULT_REGION ||
    app.node.tryGetContext("region") ||
    "ap-northeast-1",
};

// 2. 設定を検証
validateConfig(config);

// 3. スタックを作成
const cdnStack = new CdnStack(app, "CdnStack", {
  domain: config.domain,
  useCloudFront: config.useCloudFront,
  originType: config.originType,
  originDomain: config.originDomain,
  originPath: config.originPath,
  useMonitoring: config.useMonitoring,
  notificationEmail: config.notificationEmail,
  env: {
    account: config.account,
    region: config.region,
  },
  crossRegionReferences: true,
});

// 4. 監視スタックを別途作成（必要な場合）
// ※ cdn-stack.ts内で自動的に作成されるため、通常は不要
```

## 設定リファレンス

### CdnStackProps

| プロパティ            | 型      | 必須   | デフォルト | 説明                    |
| --------------------- | ------- | ------ | ---------- | ----------------------- |
| domain                | string  | はい   | -          | CDN のドメイン名        |
| useCloudFront         | boolean | はい   | -          | CloudFront を使用するか |
| useMonitoring         | boolean | はい   | -          | 証明書監視を有効化      |
| notificationEmail     | string  | いいえ | -          | 監視通知用メール        |
| originType            | string  | いいえ | -          | オリジンタイプ          |
| originDomain          | string  | いいえ | -          | オリジンドメイン        |
| originPath            | string  | いいえ | -          | オリジンパス            |
| certificateArn        | string  | いいえ | -          | 既存証明書 ARN          |
| crossRegionReferences | boolean | いいえ | true       | クロスリージョン参照    |

### OriginType の選択肢

| 値                  | 説明                      | プロトコル | アクセス制御   |
| ------------------- | ------------------------- | ---------- | -------------- |
| s3-new              | 新規 S3 バケット（推奨）  | HTTPS      | OAC            |
| s3-website-new      | 新規 S3 静的ウェブサイト  | HTTP_ONLY  | Public         |
| s3-website-existing | 既存 S3 静的ウェブサイト  | HTTP_ONLY  | Public         |
| s3-existing         | 既存 S3 バケット          | HTTPS      | OAC            |
| http                | 既存 HTTP/HTTPS サイト    | HTTPS_ONLY | -              |
| alb                 | Application Load Balancer | HTTPS_ONLY | -              |
| apigateway          | API Gateway               | HTTPS_ONLY | Custom Headers |

### 環境変数

| 環境変数            | 必須   | デフォルト     | 説明              |
| ------------------- | ------ | -------------- | ----------------- |
| DOMAIN_NAME         | はい   | -              | CDN のドメイン名  |
| USE_CLOUDFRONT      | いいえ | true           | CloudFront を使用 |
| USE_MONITORING      | いいえ | true           | 監視を有効化      |
| NOTIFICATION_EMAIL  | いいえ | -              | 通知メール        |
| ORIGIN_TYPE         | いいえ | s3-new         | オリジンタイプ    |
| ORIGIN_DOMAIN       | いいえ | -              | オリジンドメイン  |
| ORIGIN_PATH         | いいえ | -              | オリジンパス      |
| CERTIFICATE_ARN     | いいえ | -              | 既存証明書 ARN    |
| CDK_DEFAULT_ACCOUNT | いいえ | -              | AWS アカウント ID |
| CDK_DEFAULT_REGION  | いいえ | ap-northeast-1 | AWS リージョン    |

## トラブルシューティング

### 設定が動作しない場合

1. 優先順位を確認（直接 > 環境変数 > コンテキスト > ファイル）
2. `console.log(config)`でデバッグ
3. 環境変数がエクスポートされているか確認
4. プロパティ名のタイポをチェック

### よくある問題

```typescript
// 問題: 環境変数が見つからない
const domain = process.env.DOMAIN_NAME; // undefinedかもしれない

// 解決法: 検証を追加
const domain = process.env.DOMAIN_NAME;
if (!domain) {
  throw new Error("DOMAIN_NAME環境変数が必須です");
}

// または、デフォルト値を提供
const domain = process.env.DOMAIN_NAME || "example.com";
```

### オリジンタイプ別の注意点

| オリジンタイプ      | originDomain 必須 | 特記事項                   |
| ------------------- | ----------------- | -------------------------- |
| s3-new              | 不要              | 新規バケットを自動作成     |
| s3-website-new      | 不要              | 静的ウェブサイトを自動作成 |
| s3-website-existing | 必須              | S3 ウェブサイト URL を指定 |
| s3-existing         | 必須              | バケット名を指定           |
| http                | 必須              | 完全なドメイン名を指定     |
| alb                 | 必須              | ALB の DNS 名を指定        |
| apigateway          | 必須              | API Gateway の URL を指定  |

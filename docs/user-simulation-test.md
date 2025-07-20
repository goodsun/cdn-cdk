# create-cdn ユーザーシミュレーションテスト仕様書

## 1. 概要

本文書は、実際のユーザーが create-cdn パッケージを使用する際の手順に沿ったテスト仕様を定義します。

## 2. 想定ユーザーシナリオ

### シナリオ 1: 新規 CDK プロジェクトでの利用

**ユーザー**: CDK の基本知識があり、CloudFront + ACM 証明書を構築したい開発者

#### ステップ 1: プロジェクトの初期化

```bash
mkdir my-cdn-project
cd my-cdn-project
npm init -y
npm install aws-cdk-lib constructs
npm install create-cdn
```

**確認ポイント**:

- [ ] create-cdn が正しくインストールされる
- [ ] package.json に依存関係が追加される

#### ステップ 2: CDK アプリケーションの作成

```bash
mkdir lib
touch lib/my-cdn-stack.ts
touch bin/app.ts
touch cdk.json
```

**cdk.json**:

```json
{
  "app": "npx ts-node bin/app.ts"
}
```

#### ステップ 3: スタックの実装

**lib/my-cdn-stack.ts**:

```typescript
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  CertificateStack,
  CloudFrontCertificateStack,
  MonitoringStack,
} from "create-cdn";

export class MyCdnStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ここで何を設定すればいい？ドキュメントが必要
  }
}
```

**問題点**:

- ユーザーは各スタックに何を渡せばいいか分からない
- props の型定義は見えるが、具体的な設定例がない

### シナリオ 2: 既存プロジェクトへの統合

**ユーザー**: 既存の CDK プロジェクトに CDN 機能を追加したい

#### 必要な情報:

1. どのような props が必要か
2. 環境変数での設定方法
3. 既存リソースとの連携方法

## 3. 改善されたテストシナリオ

### TC-USER-001: インストールと初期設定

**前提条件**:

- Node.js 環境がセットアップ済み
- AWS 認証情報が設定済み

**手順**:

1. 新規ディレクトリを作成
2. `npm install create-cdn aws-cdk-lib constructs`を実行
3. TypeScript プロジェクトをセットアップ
4. 設定ファイルを作成

**提供すべきドキュメント**:

```typescript
// 使用例
import { CertificateStack } from "create-cdn";

const certStack = new CertificateStack(app, "MyCertStack", {
  domainName: "example.com", // 必須
  alternativeDomains: ["*.example.com"], // オプション
  certificateArn: "arn:aws:acm:...", // 既存証明書を使う場合
  env: {
    account: "123456789012",
    region: "ap-northeast-1",
  },
});
```

### TC-USER-002: 証明書の作成フロー

**シナリオ**: ユーザーが新規に証明書を作成する

**必要な設定情報**:

```typescript
// 設定ファイル: cdk.context.json または環境変数
{
  "domainName": "example.com",
  "alternativeDomains": ["www.example.com", "api.example.com"],
  "notificationEmail": "admin@example.com",
  "environment": "production"
}
```

**手順**:

1. 設定ファイルまたは環境変数を準備
2. スタックを実装
3. `cdk deploy`を実行
4. DNS 検証を完了

**確認ポイント**:

- [ ] 設定方法が明確か
- [ ] エラーメッセージが分かりやすいか
- [ ] DNS 検証の手順が理解できるか

### TC-USER-003: CloudFront との統合

**シナリオ**: 証明書を使用して CloudFront を構築

**必要な情報**:

- オリジンの設定方法
- 証明書の参照方法
- カスタムドメインの設定

**サンプルコード**:

```typescript
import { CloudFrontCertificateStack } from "create-cdn";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";

// 1. 証明書スタックを作成
const certStack = new CloudFrontCertificateStack(app, "CertStack", {
  domainName: "cdn.example.com",
  env: { region: "us-east-1" }, // CloudFront用は必須
});

// 2. CloudFrontディストリビューションを作成
const distribution = new cloudfront.Distribution(this, "Distribution", {
  defaultBehavior: {
    origin: new origins.S3Origin(bucket),
  },
  domainNames: ["cdn.example.com"],
  certificate: certStack.certificate, // どうやって参照する？
});
```

## 4. 設定方法の整理

### 方法 1: 環境変数

```bash
export CDN_DOMAIN_NAME=example.com
export CDN_ALTERNATIVE_DOMAINS=www.example.com,api.example.com
export CDN_NOTIFICATION_EMAIL=admin@example.com
```

### 方法 2: CDK コンテキスト

```bash
cdk deploy -c domainName=example.com -c environment=production
```

### 方法 3: 設定ファイル

```json
// cdk.json
{
  "context": {
    "create-cdn": {
      "domainName": "example.com",
      "alternativeDomains": ["www.example.com"],
      "notificationEmail": "admin@example.com"
    }
  }
}
```

### 方法 4: プログラマティック

```typescript
new CertificateStack(app, "Stack", {
  domainName: "example.com",
  // 他のプロパティ
});
```

## 5. ドキュメント要件

### 5.1 必須ドキュメント

1. **はじめに**

   - インストール方法
   - 最小構成の例
   - 設定方法

2. **API リファレンス**

   - 各スタックのプロパティ
   - メソッド
   - 返り値

3. **サンプル**
   - 基本的な使用例
   - 高度な使用例
   - トラブルシューティング

### 5.2 サンプルプロジェクト

```
examples/
├── basic-setup/           # 最小構成
├── with-cloudfront/       # CloudFront統合
├── multi-domain/          # 複数ドメイン
└── existing-certificate/  # 既存証明書利用
```

## 6. テスト実施チェックリスト

### ユーザビリティテスト

- [ ] README だけで基本的な使い方が理解できる
- [ ] 設定方法が明確で迷わない
- [ ] エラーメッセージが親切
- [ ] 必要な前提条件が明記されている

### 機能テスト

- [ ] 各設定方法が正しく動作する
- [ ] スタック間の依存関係が適切
- [ ] 既存リソースとの統合が可能

### ドキュメントテスト

- [ ] コード例が実際に動作する
- [ ] 型定義と実装が一致している
- [ ] よくある質問がカバーされている

## 7. 改善提案

### 7.1 設定の簡素化

```typescript
// 現状: ユーザーが全てを指定
new CertificateStack(app, "Stack", {
  /* 多数のプロパティ */
});

// 改善案: デフォルト設定を提供
import { CdnCdk } from "create-cdn";

const cdn = new CdnCdk(app, "MyCdn", {
  domainName: "example.com",
  // 他は自動設定
});

// 個別にアクセス可能
cdn.certificate;
cdn.distribution;
cdn.monitoring;
```

### 7.2 CLI ツールの提供

```bash
npx create-cdn init
npx create-cdn add-domain example.com
npx create-cdn validate-dns
```

### 7.3 設定ウィザード

```typescript
import { CdnCdkWizard } from "create-cdn";

const config = await CdnCdkWizard.run();
// 対話的に設定を生成
```

## 8. まとめ

現状の課題:

1. 設定方法が不明確
2. 使用例が不足
3. スタック間の連携方法が不明

必要なアクション:

1. 包括的な README の作成
2. サンプルプロジェクトの提供
3. 設定方法の統一と簡素化
4. エラーハンドリングの改善

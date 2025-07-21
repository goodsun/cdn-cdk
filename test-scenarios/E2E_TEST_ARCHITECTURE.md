# create-cdn E2Eテストアーキテクチャ

## システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                     Domain Registrar                         │
│                  (ValueDomain/お名前.com等)                   │
│                                                             │
│  example.com                                                │
│  └── NS aws → Route 53 Name Servers                        │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ DNS委任
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                        AWS Route 53                          │
│                                                             │
│  Hosted Zone: aws.example.com                               │
│  ├── e2e.aws.example.com                                   │
│  │   └── test-YYYYMMDD-HHMMSS.e2e.aws.example.com         │
│  ├── dev.aws.example.com                                   │
│  └── demo.aws.example.com                                  │
└─────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│      AWS Certificate        │ │      AWS CloudFront         │
│        Manager (ACM)        │ │                             │
│                             │ │  Distribution:              │
│  Region: us-east-1          │ │  - Custom Domain            │
│  - SSL/TLS証明書            │ │  - Origin: S3               │
│  - DNS検証                  │ │  - SSL証明書適用            │
└─────────────────────────────┘ └─────────────────────────────┘
                                            │
                                            ▼
                                ┌─────────────────────────────┐
                                │         AWS S3              │
                                │                             │
                                │  Bucket:                    │
                                │  - Static Website Content   │
                                │  - OAC (Origin Access)      │
                                └─────────────────────────────┘
```

## E2Eテストフロー詳細

### 1. 環境準備フェーズ

```mermaid
sequenceDiagram
    participant User
    participant Script
    participant Route53
    participant Config

    User->>Script: ./run-e2e-test-aws-real.sh
    Script->>Config: .e2e-aws-config.json読み込み
    Config-->>Script: ホストゾーンID、ドメイン情報
    Script->>Route53: ホストゾーン確認
    Route53-->>Script: ゾーン情報
    Script->>Script: テストID生成（YYYYMMDD-HHMMSS）
```

### 2. 証明書作成フェーズ

```mermaid
sequenceDiagram
    participant Script
    participant ACM
    participant Route53
    participant DNS

    Script->>ACM: 証明書リクエスト（test-*.e2e.aws.example.com）
    ACM-->>Script: 証明書ARN、検証レコード情報
    Script->>Route53: DNS検証レコード作成
    Route53->>DNS: レコード伝播
    
    loop 検証待機（最大10分）
        Script->>ACM: 証明書ステータス確認
        ACM-->>Script: PENDING_VALIDATION | ISSUED
    end
    
    Note over Script,ACM: 証明書発行完了
```

### 3. CDKデプロイフェーズ

```mermaid
sequenceDiagram
    participant Script
    participant CDK
    participant CloudFormation
    participant S3
    participant CloudFront

    Script->>Script: プロジェクトテンプレートコピー
    Script->>CDK: npm install & 環境設定
    Script->>CDK: cdk deploy
    CDK->>CloudFormation: スタック作成
    
    CloudFormation->>S3: バケット作成
    CloudFormation->>CloudFront: ディストリビューション作成
    CloudFormation->>CloudFormation: OAC設定
    
    CloudFormation-->>Script: デプロイ完了、出力値
```

### 4. DNS設定フェーズ

```mermaid
sequenceDiagram
    participant Script
    participant Route53
    participant CloudFront

    Script->>Script: CloudFrontドメイン取得
    Script->>Route53: Aレコード作成（エイリアス）
    Route53-->>Script: 変更ID
    
    Note over Route53: test-*.e2e.aws.example.com → d*.cloudfront.net
```

### 5. 動作確認フェーズ

```mermaid
sequenceDiagram
    participant Script
    participant S3
    participant CloudFront
    participant Browser

    Script->>S3: index.htmlアップロード
    Script->>Script: 30秒待機（CloudFront展開）
    Script->>CloudFront: HTTPS接続テスト
    CloudFront->>S3: コンテンツ取得
    CloudFront-->>Script: 200 OK
    Script->>Script: SSL証明書確認
    
    Note over Script: テスト成功
```

### 6. クリーンアップフェーズ

```mermaid
sequenceDiagram
    participant Script
    participant CloudFormation
    participant Route53
    participant ACM

    Script->>CloudFormation: スタック削除
    CloudFormation->>CloudFront: ディストリビューション削除
    CloudFormation->>S3: バケット削除
    CloudFormation-->>Script: 削除完了
    
    Script->>Route53: Aレコード削除
    Script->>ACM: 証明書削除
    Script->>Script: ローカルファイル削除
    
    Note over Script: クリーンアップ完了
```

## ディレクトリ構造

```
create-cdn/
├── .e2e-aws-config.json        # E2E設定ファイル
├── e2e-workspace/              # テスト作業ディレクトリ（.gitignore）
│   ├── test-project-*/         # 一時的なCDKプロジェクト
│   └── test-index.html         # テスト用HTMLファイル
├── test-scenarios/             # テストスクリプト
│   ├── run-e2e-test-aws-real.sh
│   ├── setup-aws-subdomain-e2e.sh
│   └── test-config/
│       └── mock-dns-config.json
├── test-reports/               # テストレポート
│   └── e2e-aws-real-*.log
└── template/                   # CDKプロジェクトテンプレート
    ├── bin/
    ├── lib/
    ├── cdk.json
    └── package.json
```

## 設定ファイル詳細

### .e2e-aws-config.json

```json
{
  "hostedZoneId": "Z1234567890ABC",     // Route 53ホストゾーンID
  "baseDomain": "aws.example.com",      // 委任されたベースドメイン
  "testEnvironments": {
    "e2e": {
      "domain": "e2e.aws.example.com",  // E2Eテスト用サブドメイン
      "subdomains": [                   // 追加のテストドメイン
        "test1.e2e.aws.example.com",
        "test2.e2e.aws.example.com"
      ]
    }
  }
}
```

### 環境変数（.env）

```bash
DOMAIN_NAME=test-20250122-123456.e2e.aws.example.com
CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/xxx
USE_CLOUDFRONT=true
CDK_DEFAULT_REGION=us-east-1
```

## セキュリティ考慮事項

1. **IAM権限**
   - Route 53: ホストゾーンとレコードの管理
   - ACM: 証明書の作成と削除
   - CloudFormation: スタックの作成と削除
   - S3: バケットの作成と削除
   - CloudFront: ディストリビューションの管理

2. **リソースタグ**
   ```
   Environment: e2e-test
   TestID: YYYYMMDD-HHMMSS
   ManagedBy: create-cdn-e2e
   ```

3. **自動削除設定**
   - S3バケット: RemovalPolicy.DESTROY
   - 自動オブジェクト削除: 有効
   - スタック削除時の完全クリーンアップ

## パフォーマンス最適化

1. **並列処理**
   - DNS検証レコードの一括作成
   - 複数リソースの並行削除

2. **タイムアウト設定**
   - 証明書検証: 最大10分
   - CloudFormationデプロイ: 最大15分
   - 全体のテスト: 最大30分

3. **キャッシュ活用**
   - npm依存関係のキャッシュ
   - CDKアセットのキャッシュ

## 監視とログ

1. **ログ出力**
   - リアルタイムコンソール出力
   - タイムスタンプ付きログファイル
   - 構造化されたJSONサマリー

2. **エラーハンドリング**
   - 各フェーズでのエラーキャッチ
   - 自動リトライ（DNS検証）
   - 失敗時の部分的クリーンアップ

3. **メトリクス**
   - 各フェーズの実行時間
   - 成功/失敗率
   - リソース作成数
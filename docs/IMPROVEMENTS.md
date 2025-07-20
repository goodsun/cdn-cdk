# ACM CDK 改善内容まとめ

## 実施した改善

### 1. 廃止予定のコンストラクトを最新版に更新 ✅

**変更前：**
```typescript
new acm.DnsValidatedCertificate(this, 'Certificate', {
  domainName: domain,
  hostedZone: zone,
  region: 'us-east-1'
});
```

**変更後：**
```typescript
new acm.Certificate(this, 'Certificate', {
  domainName: `*.${fullDomain}`,
  subjectAlternativeNames: [fullDomain, ...subjectAlternativeNames],
  validation: acm.CertificateValidation.fromDns(),
  certificateName: `${environment}-${domainName}-certificate`
});
```

### 2. 既存DNS環境対応の改善 ✅

**DNSプロバイダー別ヘルパーツール（dns-validation-helper.ts）:**
- お名前.com、さくらインターネット、Value Domain、Cloudflareに対応
- プロバイダー別の設定手順を日本語で表示
- DNS検証レコードをJSON形式で出力
- 検証完了の待機機能

**使用例：**
```bash
# お名前.comの場合
npx ts-node scripts/dns-validation-helper.ts arn:aws:acm:... 0 --wait
```

### 3. 監視・アラート機能の追加 ✅

**MonitoringStack の機能：**
- 証明書期限の事前通知（30日、14日、7日、3日、1日前）
- 証明書の状態異常検出
- DNS検証失敗の通知
- CloudWatchダッシュボード
- SNSによるメール通知

### 4. 実装の簡略化 ✅

**環境変数による設定：**
```env
DOMAIN_NAME=example.com
ENVIRONMENT=dev
NOTIFICATION_EMAIL=admin@example.com
```

**ワンコマンドデプロイ：**
```bash
npm run deploy:all
```

### 5. プロジェクト構造の整理 ✅

```
acm-cdk/
├── bin/
│   └── acm-cdk.ts          # エントリーポイント
├── lib/
│   ├── certificate-stack.ts # リージョナル証明書
│   ├── cloudfront-certificate-stack.ts # CloudFront用
│   └── monitoring-stack.ts  # 監視機能
├── scripts/
│   └── dns-validation-helper.ts # DNS検証支援
├── .env.example            # 環境変数サンプル
├── README.md              # ドキュメント
└── package.json           # 依存関係
```

## 主な利点

1. **既存環境への配慮**
   - Route53不要でも使いやすい
   - 日本の主要DNSプロバイダーに対応
   - 手動DNS検証の手順を明確化

2. **運用面の改善**
   - 証明書期限の自動監視
   - 問題の早期発見
   - メール通知による即時対応

3. **開発者体験の向上**
   - シンプルな設定
   - 明確なドキュメント
   - エラーハンドリングの改善

4. **将来性**
   - 最新のCDKベストプラクティスに準拠
   - 廃止予定APIの排除
   - 拡張しやすい構造

## 今後の拡張可能性

1. **API化**
   - REST APIでの証明書管理
   - Web UIの追加

2. **自動化の強化**
   - DNSプロバイダーAPIとの連携
   - 証明書の自動ローテーション

3. **マルチアカウント対応**
   - Organizations統合
   - クロスアカウント証明書共有
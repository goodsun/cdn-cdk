# API Gateway 統合テスト計画

## 🎯 テスト目的

create-cdn パッケージの CLI ツールで API Gateway をオリジンとして選択した場合に、正しく CDK プロジェクトが生成され、デプロイ可能な状態になることを確認する。

## 📋 テスト範囲

### 1. CLI ツールの動作確認

- [ ] API Gateway オプション（選択肢 5）が表示される
- [ ] REST API と HTTP API の選択プロンプトが表示される
- [ ] 必要な入力項目（URL、ステージ名）が正しく収集される
- [ ] cdk.json に設定が正しく保存される

### 2. 生成されたコードの検証

- [ ] TypeScript コンパイルエラーがない
- [ ] API Gateway 用の CloudFront 設定が含まれている
  - [ ] キャッシュ無効化（CACHING_DISABLED）
  - [ ] 全 HTTP メソッド許可（ALLOW_ALL）
  - [ ] カスタムヘッダー（X-Forwarded-Host）
- [ ] オリジンパスの設定が正しく反映される

### 3. CDK シンセサイズの確認

- [ ] `cdk synth`が成功する
- [ ] CloudFormation テンプレートに API Gateway 関連設定が含まれる
- [ ] エラーや警告がない

## 🧪 テストシナリオ

### シナリオ 1: REST API 選択

```bash
# テストプロジェクト作成
npx create-cdn test-api-rest
cd test-api-rest

# 入力値
# ドメイン名: api.example.com
# CloudFront使用: Y
# オリジンタイプ: 5 (API Gateway)
# APIタイプ: 1 (REST API)
# URL: xxx.execute-api.ap-northeast-1.amazonaws.com
# ステージ名: /prod
# 説明: Test REST API CDN
# 監視: Y
# メール: test@example.com
# リージョン: ap-northeast-1
```

### シナリオ 2: HTTP API 選択

```bash
# テストプロジェクト作成
npx create-cdn test-api-http
cd test-api-http

# 入力値
# ドメイン名: api.example.com
# CloudFront使用: Y
# オリジンタイプ: 5 (API Gateway)
# APIタイプ: 2 (HTTP API)
# URL: yyy.execute-api.ap-northeast-1.amazonaws.com
# 説明: Test HTTP API CDN
# 監視: N
# リージョン: ap-northeast-1
```

## 🔍 確認項目

### 1. cdk.json の内容確認

```json
{
  "context": {
    "domain": "api.example.com",
    "useCloudFront": true,
    "originType": "apigateway",
    "originDomain": "xxx.execute-api.ap-northeast-1.amazonaws.com",
    "originPath": "/prod",
    "distributionComment": "Test REST API CDN"
  }
}
```

### 2. 生成された CDK コードの確認

`lib/cdn-stack.ts`内に以下が含まれているか：

```typescript
case 'apigateway':
  // API Gateway
  origin = new origins.HttpOrigin(props.originDomain!, {
    protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    originPath: props.originPath,
    readTimeout: cdk.Duration.seconds(30),
    httpPort: 443,
    httpsPort: 443,
    customHeaders: {
      'X-Forwarded-Host': props.domain
    }
  });
  break;
```

### 3. CloudFront 設定の確認

```typescript
cachePolicy: props.originType === 'apigateway'
  ? cloudfront.CachePolicy.CACHING_DISABLED
  : cloudfront.CachePolicy.CACHING_OPTIMIZED,
originRequestPolicy: props.originType === 'apigateway'
  ? cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
  : undefined,
allowedMethods: props.originType === 'apigateway'
  ? cloudfront.AllowedMethods.ALLOW_ALL
  : cloudfront.AllowedMethods.ALLOW_GET_HEAD,
```

## 📊 期待される結果

1. **CLI ツール実行**: エラーなく完了し、プロジェクトが生成される
2. **npm install**: 依存関係が正しくインストールされる
3. **npm run build**: TypeScript コンパイルが成功する
4. **cdk synth**: CloudFormation テンプレートが生成される
5. **cdk deploy**: AWS へのデプロイが成功する
6. **動作確認**:
   - CloudFront 経由で API Gateway にアクセスできる
   - キャッシュが無効化されている（API 応答が常に最新）
   - 全 HTTP メソッドが通る
7. **cdk destroy**: リソースのクリーンアップが成功する

## ⚠️ 注意事項

- 実際の AWS デプロイを行い、動作を確認する
- テスト後は必ず`cdk destroy`でリソースを削除する
- API Gateway は実際のエンドポイントが必要（モックでも可）

## 🐛 既知の問題・リスク

1. **依存関係の問題**

   - aws-cdk-lib のバージョン不整合
   - TypeScript バージョンの互換性

2. **設定の問題**
   - originPath の扱い（REST API と HTTP API で異なる）
   - カスタムヘッダーの適用

## ✅ テスト完了基準

- [ ] 全テストシナリオが成功
- [ ] 生成されたコードにエラーがない
- [ ] CloudFormation テンプレートが正しく生成される
- [ ] AWS へのデプロイが成功する
- [ ] CloudFront 経由で API Gateway にアクセスできる
- [ ] キャッシュ設定が正しく動作する
- [ ] リソースのクリーンアップが完了する
- [ ] ドキュメントの更新が完了している

## 🧪 テスト用 API Gateway の準備

テストのために簡単なモック API Gateway を作成：

```bash
# AWS CLIでモックAPI作成（REST API）
aws apigateway create-rest-api --name "test-cdn-api" --region ap-northeast-1

# またはHTTP API
aws apigatewayv2 create-api --name "test-cdn-http-api" --protocol-type HTTP --region ap-northeast-1
```

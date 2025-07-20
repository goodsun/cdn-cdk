#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CertificateStack } from '../lib/certificate-stack';
import { CloudFrontCertificateStack } from '../lib/cloudfront-certificate-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import * as dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

const app = new cdk.App();

// 環境変数から設定を読み込み
const domainName = process.env.DOMAIN_NAME || 'example.com';
const environment = (process.env.ENVIRONMENT || 'dev') as 'dev' | 'stg' | 'prd';
const notificationEmail = process.env.NOTIFICATION_EMAIL || 'admin@example.com';
const hostedZoneId = process.env.HOSTED_ZONE_ID;
const hostedZoneName = process.env.HOSTED_ZONE_NAME;
const accountId = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';

// 基本の環境設定
const env = {
  account: accountId,
  region: region,
};

// リージョナル証明書スタック（ALB、API Gateway等で使用）
const certificateStack = new CertificateStack(app, `ACM-Certificate-${environment}`, {
  env,
  domainName,
  environment,
  hostedZoneId,
  hostedZoneName,
  stackName: `acm-certificate-${environment}`,
  description: `ACM Certificate for ${domainName} (${environment})`,
});

// CloudFront用証明書スタック（us-east-1リージョン）
const cloudfrontCertificateStack = new CloudFrontCertificateStack(app, `ACM-CloudFront-Certificate-${environment}`, {
  env: {
    account: accountId,
    region: 'us-east-1', // CloudFront用は必ずus-east-1
  },
  domainName,
  environment,
  hostedZoneId,
  hostedZoneName,
  stackName: `acm-cloudfront-certificate-${environment}`,
  description: `ACM CloudFront Certificate for ${domainName} (${environment})`,
});

// 監視スタック
const monitoringStack = new MonitoringStack(app, `ACM-Monitoring-${environment}`, {
  env,
  certificateArns: [
    certificateStack.certificateArn,
    // CloudFront証明書のARNは実行時に解決されるため、ここでは静的な値として渡す必要がある
    // 実際の運用では、SSM Parameter Storeから取得するか、Stack間の依存関係を使用
  ],
  notificationEmail,
  environment,
  stackName: `acm-monitoring-${environment}`,
  description: `ACM Certificate Monitoring for ${environment}`,
});

// スタック間の依存関係を設定
monitoringStack.addDependency(certificateStack);

// タグの追加
cdk.Tags.of(app).add('Project', 'ACM-CDK');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
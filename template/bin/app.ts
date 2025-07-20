#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import { CdnStack } from '../lib/cdn-stack';

// Load environment variables with override option to prioritize .env file
dotenv.config({ override: true });

const app = new cdk.App();

// Get configuration from environment variables or CDK context
const config = {
  account: process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account'),
  region: process.env.CDK_DEFAULT_REGION || app.node.tryGetContext('region') || 'ap-northeast-1',
  domain: process.env.DOMAIN_NAME || app.node.tryGetContext('domain'),
  useCloudFront: process.env.USE_CLOUDFRONT === 'true' || app.node.tryGetContext('useCloudFront'),
  originType: process.env.ORIGIN_TYPE || app.node.tryGetContext('originType') || 's3-new',
  originDomain: process.env.ORIGIN_DOMAIN || app.node.tryGetContext('originDomain'),
  originPath: process.env.ORIGIN_PATH || app.node.tryGetContext('originPath'),
  useMonitoring: process.env.USE_MONITORING === 'true' || app.node.tryGetContext('useMonitoring'),
  notificationEmail: process.env.NOTIFICATION_EMAIL || app.node.tryGetContext('notificationEmail')
};

// Validate required configuration
if (!config.domain) {
  throw new Error('Domain name is required. Set DOMAIN_NAME in .env file');
}

if (config.useMonitoring && !config.notificationEmail) {
  throw new Error('Notification email is required when monitoring is enabled. Set NOTIFICATION_EMAIL in .env file');
}

// ワイルドカード証明書の処理
if (config.domain.startsWith('*.')) {
  // ワイルドカード証明書はus-east-1に作成（将来のCloudFront利用のため）
  if (config.region !== 'us-east-1') {
    console.log('\n📍 ワイルドカード証明書をus-east-1に作成します（CloudFront対応のため）。');
    config.region = 'us-east-1';
  }
  
  // ワイルドカード証明書ではCloudFrontディストリビューションは作成しない
  if (config.useCloudFront) {
    console.log('⚠️  ワイルドカード証明書では証明書のみ作成します。');
    console.log('   CloudFrontディストリビューションは作成されません。');
    config.useCloudFront = false;
  }
} else {
  // 通常のドメインでCloudFrontを使用する場合は自動的にus-east-1を使用
  if (config.useCloudFront && config.region !== 'us-east-1') {
    console.log('\n📍 CloudFront用にリージョンをus-east-1に自動設定しました。');
    config.region = 'us-east-1';
  }
}

// Create the CDN stack
new CdnStack(app, 'CdnStack', {
  env: {
    account: config.account,
    region: config.region
  },
  ...config
});

app.synth();
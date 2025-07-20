#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { CertificateStack, CloudFrontCertificateStack, MonitoringStack } from '../../lib';
import * as fs from 'fs';

const app = new App();

// Load domain configuration
interface DomainConfig {
  primary: string;
  alternatives: string[];
  email?: string;
}

let config: DomainConfig;

// Try to load from domains.json or use environment variables
if (fs.existsSync('domains.json')) {
  config = JSON.parse(fs.readFileSync('domains.json', 'utf8'));
} else {
  config = {
    primary: process.env.PRIMARY_DOMAIN || 'example.com',
    alternatives: process.env.ALTERNATIVE_DOMAINS?.split(',') || [
      '*.example.com',
      'www.example.com'
    ],
    email: process.env.NOTIFICATION_EMAIL || 'admin@example.com'
  };
}

// Create regional certificate (for ALB, API Gateway, etc.)
const regionalCert = new CertificateStack(app, 'MultiDomainRegionalCert', {
  domainName: config.primary,
  additionalDomains: config.alternatives,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1'
  }
});

// Create CloudFront certificate
const cfCert = new CloudFrontCertificateStack(app, 'MultiDomainCloudFrontCert', {
  domainName: config.primary,
  additionalDomains: config.alternatives,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1' // Required for CloudFront
  }
});

// Set up monitoring for both certificates
const monitoring = new MonitoringStack(app, 'MultiDomainMonitoring', {
  certificateArns: [
    regionalCert.certificateArn,
    cfCert.certificateArn
  ],
  notificationEmail: config.email || 'admin@example.com',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1'
  }
});

// Add dependencies
monitoring.addDependency(regionalCert);
monitoring.addDependency(cfCert);

console.log('Configuration:');
console.log(`Primary domain: ${config.primary}`);
console.log(`Alternative domains: ${config.alternatives.join(', ')}`);
console.log(`Notification email: ${config.email}`);

app.synth();
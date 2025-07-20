#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { CertificateStack } from '../../lib';

const app = new App();

// Get domain from environment or use default
const domainName = process.env.DOMAIN_NAME || 'example.com';

// Create a basic certificate
new CertificateStack(app, 'BasicCertificate', {
  domainName: domainName,
  includeWww: true,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

app.synth();
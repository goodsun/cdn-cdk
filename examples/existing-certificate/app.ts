#!/usr/bin/env node
import { App, Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { CertificateStack, MonitoringStack } from "../../lib";
import { Construct } from "constructs";

const app = new App();

// Configuration
const existingCertArn =
  process.env.EXISTING_CERT_ARN ||
  "arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id";
const domainName = process.env.DOMAIN_NAME || "example.com";
const notificationEmail = process.env.NOTIFICATION_EMAIL || "admin@example.com";

// Example 1: Create new certificate with create-cdn
const certStack = new CertificateStack(app, "NewCertificate", {
  domainName: domainName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});

// Example 2: Reference certificate directly
class ExistingCertificateStack extends Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Import existing certificate
    this.certificate = acm.Certificate.fromCertificateArn(
      this,
      "ImportedCert",
      existingCertArn
    );

    // You can now use this.certificate in CloudFront, ALB, etc.

    new CfnOutput(this, "CertificateArn", {
      value: this.certificate.certificateArn,
      description: "Imported certificate ARN",
    });
  }
}

const importStack = new ExistingCertificateStack(
  app,
  "ImportedCertificateStack",
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || "us-east-1",
    },
  }
);

// Example 3: Monitor certificates
const monitoringStack = new MonitoringStack(app, "CertificateMonitoring", {
  certificateArns: [existingCertArn],
  notificationEmail: notificationEmail,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});

console.log(`Using existing certificate: ${existingCertArn}`);
console.log(`Monitoring notifications will be sent to: ${notificationEmail}`);

app.synth();

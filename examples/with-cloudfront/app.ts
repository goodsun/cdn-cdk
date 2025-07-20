#!/usr/bin/env node
import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cdk from 'aws-cdk-lib';
import { CloudFrontCertificateStack } from '../../lib';
import { Construct } from 'constructs';

const app = new App();

const domainName = process.env.CDN_DOMAIN_NAME || 'cdn.example.com';
const bucketName = process.env.S3_BUCKET_NAME || 'my-static-assets';

// Step 1: Create certificate in us-east-1
const certStack = new CloudFrontCertificateStack(app, 'CloudFrontCertificate', {
  domainName: domainName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1' // Required for CloudFront
  }
});

// Step 2: Create CloudFront distribution
class CloudFrontStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create S3 bucket for static assets
    const bucket = new s3.Bucket(this, 'StaticAssets', {
      bucketName: bucketName,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'CDN', {
      defaultBehavior: {
        origin: new origins.S3Origin(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true
      },
      domainNames: [domainName],
      certificate: certStack.certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: cdk.Duration.minutes(5)
        }
      ]
    });

    // Output the distribution domain
    new CfnOutput(this, 'DistributionDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain'
    });

    new CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID'
    });

    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket for static assets'
    });
  }
}

const cfStack = new CloudFrontStack(app, 'CloudFrontCDN', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

// Add dependency
cfStack.addDependency(certStack);

app.synth();
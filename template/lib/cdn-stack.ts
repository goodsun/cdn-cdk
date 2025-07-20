import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { CertificateUtils } from './utils/certificate-utils';

export interface CdnStackProps extends cdk.StackProps {
  domain: string;
  useCloudFront: boolean;
  useMonitoring: boolean;
  notificationEmail?: string;
  originType?: string;
  originDomain?: string;
  originPath?: string;
}

export class CdnStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, {
      ...props,
      crossRegionReferences: true,
      description: `CDN stack for ${props.domain}`
    });

    // Create or use existing certificate
    let certificate: acm.ICertificate;
    
    // 証明書を取得（既存のワイルドカード証明書があれば使用）
    certificate = CertificateUtils.getOrCreateCertificate(
      this,
      'Certificate',
      props.domain,
      this.region
    );

    if (props.useCloudFront) {
      let origin;
      let bucket;
      
      // Configure origin based on type
      switch (props.originType) {
        case 's3-new':
          // S3バケット with OAC (推奨)
          bucket = new s3.Bucket(this, 'ContentBucket', {
            bucketName: `${props.domain.replace(/\./g, '-')}-content`,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true
          });
          origin = new origins.S3Origin(bucket);
          break;
          
        case 's3-website-new':
          // 新規S3バケット（静的ウェブサイトホスティング）
          bucket = new s3.Bucket(this, 'WebsiteBucket', {
            bucketName: `${props.domain.replace(/\./g, '-')}-website`,
            publicReadAccess: true,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'error.html',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: new s3.BlockPublicAccess({
              blockPublicAcls: false,
              blockPublicPolicy: false,
              ignorePublicAcls: false,
              restrictPublicBuckets: false
            })
          });
          
          // バケットポリシーを追加して公開アクセスを許可
          bucket.addToResourcePolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [`${bucket.bucketArn}/*`],
            principals: [new iam.AnyPrincipal()]
          }));
          
          // S3ウェブサイトエンドポイントをHTTPオリジンとして使用
          origin = new origins.HttpOrigin(
            `${bucket.bucketName}.s3-website-${cdk.Stack.of(this).region}.amazonaws.com`,
            {
              protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
              originPath: props.originPath
            }
          );
          break;
          
        case 's3-existing':
          // 既存のS3バケット（OAC経由）
          const existingBucket = s3.Bucket.fromBucketName(
            this, 
            'ExistingBucket', 
            props.originDomain!
          );
          origin = new origins.S3Origin(existingBucket);
          break;
          
        case 's3-website-existing':
          // 既存のS3静的ウェブサイト
          origin = new origins.HttpOrigin(props.originDomain!, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            originPath: props.originPath
          });
          break;
          
        case 'http':
          origin = new origins.HttpOrigin(props.originDomain!, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            originPath: props.originPath,
            readTimeout: cdk.Duration.seconds(60)
          });
          break;
          
        case 'alb':
          origin = new origins.HttpOrigin(props.originDomain!, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            readTimeout: cdk.Duration.seconds(60)
          });
          break;
          
        case 'apigateway':
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
          
        default:
          throw new Error(`Unknown origin type: ${props.originType}`);
      }

      // Create CloudFront distribution
      const distribution = new cloudfront.Distribution(this, 'Distribution', {
        defaultBehavior: {
          origin: origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: props.originType === 'apigateway' 
            ? cloudfront.CachePolicy.CACHING_DISABLED
            : cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: props.originType === 'apigateway'
            ? cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
            : undefined,
          allowedMethods: props.originType === 'apigateway'
            ? cloudfront.AllowedMethods.ALLOW_ALL
            : cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          compress: true
        },
        domainNames: [props.domain],
        certificate: certificate,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        defaultRootObject: ['s3-new', 's3-website-new'].includes(props.originType || '') ? 'index.html' : undefined,
        comment: `CDN for ${props.domain}`,
        errorResponses: ['s3-new', 's3-website-new'].includes(props.originType || '') ? [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.seconds(0)
          }
        ] : undefined
      });

      // Outputs
      if (bucket) {
        new cdk.CfnOutput(this, 'BucketName', {
          value: bucket.bucketName,
          description: 'S3 bucket name'
        });
      }
      
      new cdk.CfnOutput(this, 'DistributionDomain', {
        value: distribution.distributionDomainName,
        description: 'CloudFront distribution domain (use for CNAME)'
      });
      
      // DNS設定の詳細を出力
      new cdk.CfnOutput(this, 'DNSSetupInstructions', {
        value: `Add the following DNS record:\nType: CNAME\nName: ${props.domain}\nValue: ${distribution.distributionDomainName}`,
        description: 'DNS configuration instructions'
      });
      
      // サブドメインのみを抽出
      const subdomain = props.domain.split('.')[0];
      new cdk.CfnOutput(this, 'DNSRecordName', {
        value: subdomain,
        description: 'DNS record name (subdomain only)'
      });
      
      new cdk.CfnOutput(this, 'DNSRecordValue', {
        value: distribution.distributionDomainName,
        description: 'DNS record value (CloudFront domain)'
      });
      
      // コピペ用のDNS設定（短い形式）
      new cdk.CfnOutput(this, 'DNSCopyPasteShort', {
        value: `cname ${subdomain} ${distribution.distributionDomainName}.`,
        description: 'DNS record (copy-paste format - short)'
      });
      
      // コピペ用のDNS設定（フルネーム形式）
      new cdk.CfnOutput(this, 'DNSCopyPasteFull', {
        value: `cname ${props.domain} ${distribution.distributionDomainName}.`,
        description: 'DNS record (copy-paste format - full)'
      });
      
      // Value Domain用の設定
      new cdk.CfnOutput(this, 'ValueDomainSetup', {
        value: `【Value Domain設定】\nホスト名: ${subdomain}\nターゲット: ${distribution.distributionDomainName}\nタイプ: CNAME`,
        description: 'Value Domain specific setup'
      });

      new cdk.CfnOutput(this, 'DistributionId', {
        value: distribution.distributionId,
        description: 'CloudFront distribution ID'
      });
      
      new cdk.CfnOutput(this, 'CloudFrontURL', {
        value: `https://${props.domain}`,
        description: 'Your site URL (after DNS setup)'
      });
    }

    // Add monitoring if enabled
    if (props.useMonitoring && props.notificationEmail) {
      // Create SNS topic for alerts
      const alertTopic = new cdk.aws_sns.Topic(this, 'CertificateAlertTopic', {
        displayName: 'ACM Certificate Alerts',
      });
      
      alertTopic.addSubscription(
        new cdk.aws_sns_subscriptions.EmailSubscription(props.notificationEmail)
      );
      
      // Create CloudWatch alarm for certificate expiration
      new cdk.aws_cloudwatch.Alarm(this, 'CertificateExpirationAlarm', {
        metric: new cdk.aws_cloudwatch.Metric({
          namespace: 'AWS/CertificateManager',
          metricName: 'DaysToExpiry',
          dimensionsMap: {
            CertificateArn: certificate.certificateArn,
          },
          statistic: 'Average',
          period: cdk.Duration.days(1),
        }),
        threshold: 30,
        evaluationPeriods: 1,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'Certificate will expire in less than 30 days',
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.BREACHING,
      }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alertTopic));
    }

    // Output certificate ARN
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: certificate.certificateArn,
      description: 'ACM certificate ARN'
    });

    // Output domain name
    new cdk.CfnOutput(this, 'DomainName', {
      value: props.domain,
      description: 'Domain name for this CDN'
    });

    // DNS validation instructions
    new cdk.CfnOutput(this, 'DnsValidationInstructions', {
      value: `DNS検証が必要です。以下のコマンドでCNAMEレコードを確認してください: npm run show-validation`,
      description: 'DNS validation instructions'
    });
  }
}
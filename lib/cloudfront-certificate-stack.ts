import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CloudFrontCertificateStackProps extends cdk.StackProps {
  domainName: string;
  environment: 'dev' | 'stg' | 'prd';
  includeWww?: boolean;
  additionalDomains?: string[];
  hostedZoneId?: string;
  hostedZoneName?: string;
}

export class CloudFrontCertificateStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CloudFrontCertificateStackProps) {
    super(scope, id, props);

    const { domainName, environment, includeWww = true, additionalDomains = [], hostedZoneId, hostedZoneName } = props;
    
    // CloudFront用の証明書は必ずus-east-1リージョンである必要がある
    if (this.region !== 'us-east-1') {
      throw new Error('CloudFront certificates must be created in us-east-1 region');
    }

    // 環境別のドメイン名
    const fullDomain = environment === 'prd' ? domainName : `${environment}.${domainName}`;
    
    // SANs (Subject Alternative Names) の設定
    const subjectAlternativeNames: string[] = [];
    if (includeWww) {
      subjectAlternativeNames.push(`www.${fullDomain}`);
    }
    if (additionalDomains.length > 0) {
      subjectAlternativeNames.push(...additionalDomains);
    }

    // DNS検証の設定
    let validation: acm.CertificateValidation;
    
    if (hostedZoneId && hostedZoneName) {
      // Route53を使用した自動DNS検証
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId,
        zoneName: hostedZoneName,
      });
      
      validation = acm.CertificateValidation.fromDns(hostedZone);
    } else {
      // 手動DNS検証
      validation = acm.CertificateValidation.fromDns();
    }

    // CloudFront用証明書の作成（最新のコンストラクトを使用）
    this.certificate = new acm.Certificate(this, 'CloudFrontCertificate', {
      domainName: `*.${fullDomain}`,
      subjectAlternativeNames: [fullDomain, ...subjectAlternativeNames],
      validation,
      certificateName: `${environment}-${domainName}-cloudfront-certificate`,
    });

    // 証明書のARNをSSM Parameter Storeに保存（クロスリージョンアクセス用）
    const certificateArnParam = new ssm.StringParameter(this, 'CloudFrontCertificateArnParameter', {
      parameterName: `/acm/${environment}/${domainName}/cloudfront-certificate-arn`,
      stringValue: this.certificate.certificateArn,
      description: `CloudFront Certificate ARN for ${fullDomain}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    this.certificateArn = this.certificate.certificateArn;

    // 出力
    new cdk.CfnOutput(this, 'CloudFrontCertificateArn', {
      value: this.certificate.certificateArn,
      description: 'The ARN of the CloudFront certificate',
      exportName: `${environment}-cloudfront-certificate-arn`,
    });

    new cdk.CfnOutput(this, 'CloudFrontCertificateDomains', {
      value: JSON.stringify([`*.${fullDomain}`, fullDomain, ...subjectAlternativeNames]),
      description: 'Domains covered by this CloudFront certificate',
    });

    new cdk.CfnOutput(this, 'CloudFrontSSMParameterName', {
      value: certificateArnParam.parameterName,
      description: 'SSM Parameter name for CloudFront certificate ARN',
    });

    // タグ付け
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Service', 'ACM-CloudFront');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Region', 'us-east-1');
  }
}
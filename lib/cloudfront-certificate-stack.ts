import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CloudFrontCertificateStackProps extends cdk.StackProps {
  domainName: string;
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

    const { domainName, includeWww = true, additionalDomains = [], hostedZoneId, hostedZoneName } = props;
    
    // CloudFront用の証明書は必ずus-east-1リージョンである必要がある
    if (this.region !== 'us-east-1') {
      throw new Error('CloudFront certificates must be created in us-east-1 region');
    }

    // ワイルドカード証明書かどうかを判定
    const isWildcard = domainName.startsWith('*.');
    
    // 証明書のプライマリドメイン
    const certificateDomain = domainName;
    const subjectAlternativeNames: string[] = [];
    
    if (isWildcard) {
      // ワイルドカード証明書の場合、ベースドメインも含める
      const baseDomain = domainName.substring(2);
      subjectAlternativeNames.push(baseDomain);
    } else {
      // 通常の証明書の場合
      if (includeWww) {
        subjectAlternativeNames.push(`www.${domainName}`);
      }
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
      domainName: certificateDomain,
      subjectAlternativeNames: subjectAlternativeNames.length > 0 ? subjectAlternativeNames : undefined,
      validation,
      certificateName: `${domainName.replace(/[*.]/g, '-')}-cloudfront-certificate`,
    });

    // 証明書のARNをSSM Parameter Storeに保存（クロスリージョンアクセス用）
    // ワイルドカード証明書の場合、パラメータ名の*を-wildcard-に置換
    const parameterSafeDomain = domainName.replace(/^\*\./, 'wildcard.');
    const certificateArnParam = new ssm.StringParameter(this, 'CloudFrontCertificateArnParameter', {
      parameterName: `/acm/${parameterSafeDomain}/cloudfront-certificate-arn`,
      stringValue: this.certificate.certificateArn,
      description: `CloudFront Certificate ARN for ${certificateDomain}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    this.certificateArn = this.certificate.certificateArn;

    // 出力
    new cdk.CfnOutput(this, 'CloudFrontCertificateArn', {
      value: this.certificate.certificateArn,
      description: 'The ARN of the CloudFront certificate',
    });

    new cdk.CfnOutput(this, 'CloudFrontCertificateDomains', {
      value: JSON.stringify([certificateDomain, ...subjectAlternativeNames]),
      description: 'Domains covered by this CloudFront certificate',
    });

    new cdk.CfnOutput(this, 'CloudFrontSSMParameterName', {
      value: certificateArnParam.parameterName,
      description: 'SSM Parameter name for CloudFront certificate ARN',
    });

    // タグ付け
    cdk.Tags.of(this).add('Service', 'ACM-CloudFront');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Region', 'us-east-1');
  }
}
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CertificateStackProps extends cdk.StackProps {
  domainName: string;
  environment: 'dev' | 'stg' | 'prd';
  includeWww?: boolean;
  additionalDomains?: string[];
  hostedZoneId?: string;
  hostedZoneName?: string;
}

export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const { domainName, environment, includeWww = true, additionalDomains = [], hostedZoneId, hostedZoneName } = props;
    
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

    // 証明書の作成（最新のコンストラクトを使用）
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: `*.${fullDomain}`,
      subjectAlternativeNames: [fullDomain, ...subjectAlternativeNames],
      validation,
      certificateName: `${environment}-${domainName}-certificate`,
    });

    // 証明書のARNをSSM Parameter Storeに保存
    const certificateArnParam = new ssm.StringParameter(this, 'CertificateArnParameter', {
      parameterName: `/acm/${environment}/${domainName}/certificate-arn`,
      stringValue: this.certificate.certificateArn,
      description: `Certificate ARN for ${fullDomain}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    this.certificateArn = this.certificate.certificateArn;

    // 出力
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'The ARN of the certificate',
      exportName: `${environment}-certificate-arn`,
    });

    new cdk.CfnOutput(this, 'CertificateDomains', {
      value: JSON.stringify([`*.${fullDomain}`, fullDomain, ...subjectAlternativeNames]),
      description: 'Domains covered by this certificate',
    });

    new cdk.CfnOutput(this, 'SSMParameterName', {
      value: certificateArnParam.parameterName,
      description: 'SSM Parameter name for certificate ARN',
    });

    // タグ付け
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Service', 'ACM');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
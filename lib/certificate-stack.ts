import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CertificateStackProps {
  domainName: string;
  includeWww?: boolean;
  additionalDomains?: string[];
  hostedZoneId?: string;
  hostedZoneName?: string;
}

export class CertificateStack extends Construct {
  public readonly certificate: acm.Certificate;
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id);

    const { domainName, includeWww = true, additionalDomains = [], hostedZoneId, hostedZoneName } = props;
    
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

    // 証明書の作成（最新のコンストラクトを使用）
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: certificateDomain,
      subjectAlternativeNames: subjectAlternativeNames.length > 0 ? subjectAlternativeNames : undefined,
      validation,
      certificateName: `${domainName.replace(/[*.]/g, '-')}-certificate`,
    });

    // 証明書のARNをSSM Parameter Storeに保存
    // ワイルドカード証明書の場合、パラメータ名の*を-wildcard-に置換
    const parameterSafeDomain = domainName.replace(/^\*\./, 'wildcard.');
    const certificateArnParam = new ssm.StringParameter(this, 'CertificateArnParameter', {
      parameterName: `/acm/${parameterSafeDomain}/certificate-arn`,
      stringValue: this.certificate.certificateArn,
      description: `Certificate ARN for ${certificateDomain}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    this.certificateArn = this.certificate.certificateArn;

    // タグ付け（証明書リソースに直接適用）
    cdk.Tags.of(this.certificate).add('Service', 'ACM');
    cdk.Tags.of(this.certificate).add('ManagedBy', 'CDK');
  }
}
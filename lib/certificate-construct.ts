import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import * as chalk from 'chalk';

export interface CertificateConstructProps {
  domainName: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
}

export class CertificateConstruct extends Construct {
  public readonly certificate: acm.Certificate;
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CertificateConstructProps) {
    super(scope, id);

    const { domainName, hostedZoneId, hostedZoneName } = props;

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

    // 証明書の作成
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: domainName,
      validation,
    });

    this.certificateArn = this.certificate.certificateArn;

    // DNS検証情報を出力として追加
    new cdk.CfnOutput(this, 'ValidationDomain', {
      value: domainName,
      description: 'Domain being validated',
    });

    // カスタムリソースでDNS検証レコードを表示
    const showValidationRecords = new cdk.CustomResource(this, 'ShowValidationRecords', {
      serviceToken: cdk.CustomResourceProvider.getOrCreate(this, 'Custom::ShowDnsValidation', {
        codeDirectory: `${__dirname}/../scripts`,
        runtime: cdk.CustomResourceProviderRuntime.NODEJS_18_X,
        policyStatements: [{
          Effect: 'Allow',
          Action: ['acm:DescribeCertificate'],
          Resource: this.certificate.certificateArn,
        }],
      }),
      properties: {
        CertificateArn: this.certificate.certificateArn,
        Region: cdk.Stack.of(this).region,
      },
    });

    showValidationRecords.node.addDependency(this.certificate);
  }
}
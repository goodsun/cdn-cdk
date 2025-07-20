import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface ExistingCertificateInfo {
  certificateArn: string;
  domainName: string;
  isWildcard: boolean;
}

export class CertificateUtils {
  /**
   * Check if a domain can use an existing wildcard certificate
   * @param domain The domain to check (e.g., "dev.example.com")
   * @returns The wildcard domain if applicable (e.g., "*.example.com"), null otherwise
   */
  static getWildcardDomainForSubdomain(domain: string): string | null {
    // ワイルドカード証明書自体の場合はnull
    if (domain.startsWith('*.')) {
      return null;
    }
    
    // サブドメインを持つドメインの場合
    const parts = domain.split('.');
    if (parts.length >= 3) {
      // dev.example.com -> *.example.com
      return `*.${parts.slice(1).join('.')}`;
    }
    
    return null;
  }

  /**
   * Check for existing certificate in SSM Parameter Store
   * @param scope CDK construct scope
   * @param domain The domain to check
   * @returns Certificate ARN if exists, null otherwise
   */
  static checkExistingCertificateInSSM(scope: Construct, domain: string): string | null {
    try {
      // ワイルドカード証明書の場合、パラメータ名の*をwildcardに置換
      const parameterSafeDomain = domain.replace(/^\*\./, 'wildcard.');
      const parameterName = `/acm/${parameterSafeDomain}/certificate-arn`;
      
      const certificateArn = ssm.StringParameter.valueFromLookup(scope, parameterName);
      
      // 値が見つからなかった場合（ダミー値が返される）
      if (!certificateArn || certificateArn.includes('dummy-value')) {
        return null;
      }
      
      return certificateArn;
    } catch (error) {
      // パラメータが存在しない場合
      return null;
    }
  }

  /**
   * Get or create certificate with wildcard support
   * @param scope CDK construct scope
   * @param id Construct ID
   * @param domain The domain name
   * @param region The AWS region
   * @returns Certificate interface
   */
  static getOrCreateCertificate(
    scope: Construct, 
    id: string, 
    domain: string,
    region: string
  ): acm.ICertificate {
    // まず、サブドメインの場合はワイルドカード証明書が使えるかチェック
    const wildcardDomain = this.getWildcardDomainForSubdomain(domain);
    
    if (wildcardDomain) {
      // ワイルドカード証明書がSSMに存在するかチェック
      const wildcardCertArn = this.checkExistingCertificateInSSM(scope, wildcardDomain);
      
      if (wildcardCertArn) {
        console.log(`\n🎯 既存のワイルドカード証明書を使用: ${wildcardDomain}`);
        console.log(`   証明書ARN: ${wildcardCertArn}`);
        console.log(`   対象ドメイン: ${domain}`);
        
        // 既存の証明書を参照
        return acm.Certificate.fromCertificateArn(
          scope,
          `${id}-existing-wildcard`,
          wildcardCertArn
        );
      }
      
      // SSMに見つからない場合、AWS CLIでチェック
      console.log(`\n🔍 既存のワイルドカード証明書を検索中: ${wildcardDomain}`);
      console.log(`   注意: 既存の証明書がある場合は、以下のコマンドでSSMに登録してください:`);
      console.log(`   aws ssm put-parameter --name "/acm/wildcard.${wildcardDomain.substring(2)}/certificate-arn" --value "証明書ARN" --type String --region ${region}`);
    }
    
    // 既存の証明書が見つからない場合は新規作成
    console.log(`\n📋 新しい証明書を作成: ${domain}`);
    return new acm.Certificate(scope, id, {
      domainName: domain,
      validation: acm.CertificateValidation.fromDns(),
    });
  }
}
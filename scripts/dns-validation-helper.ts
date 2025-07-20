#!/usr/bin/env node
import * as AWS from 'aws-sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// リージョンを環境変数から取得、デフォルトはus-east-1
const region = process.env.AWS_REGION || 'us-east-1';

interface DnsValidationRecord {
  Name: string;
  Type: string;
  Value: string;
}

interface DnsProvider {
  name: string;
  instructions: string;
  scriptPath?: string;
}

const DNS_PROVIDERS: DnsProvider[] = [
  {
    name: 'お名前.com',
    instructions: `
1. お名前.comの管理画面にログイン
2. DNS関連機能設定 > DNS設定/転送設定を選択
3. 対象ドメインを選択
4. DNSレコード設定を選択
5. 以下のCNAMEレコードを追加:`,
    scriptPath: './providers/onamae.js'
  },
  {
    name: 'さくらインターネット',
    instructions: `
1. さくらのコントロールパネルにログイン
2. ドメイン/SSL > ドメイン一覧を選択
3. 対象ドメインの「ゾーン編集」をクリック
4. 以下のCNAMEレコードを追加:`,
    scriptPath: './providers/sakura.js'
  },
  {
    name: 'Value Domain',
    instructions: `
1. Value Domainにログイン
2. ドメイン > ドメインの設定操作を選択
3. DNS/URL転送の設定を選択
4. 以下のCNAMEレコードを追加:`,
    scriptPath: './providers/value-domain.js'
  },
  {
    name: 'Cloudflare',
    instructions: `
1. Cloudflareダッシュボードにログイン
2. 対象ドメインを選択
3. DNS設定を開く
4. 以下のCNAMEレコードを追加（プロキシはOFF）:`,
    scriptPath: './providers/cloudflare.js'
  },
  {
    name: '手動設定',
    instructions: `
お使いのDNSプロバイダーの管理画面で以下のCNAMEレコードを追加してください:`
  }
];

class DnsValidationHelper {
  private acm: AWS.ACM;
  
  constructor(regionParam?: string) {
    this.acm = new AWS.ACM({ region: regionParam || region });
  }

  async getCertificateValidationRecords(certificateArn: string): Promise<DnsValidationRecord[]> {
    try {
      const response = await this.acm.describeCertificate({ CertificateArn: certificateArn }).promise();
      const certificate = response.Certificate;
      
      if (!certificate || !certificate.DomainValidationOptions) {
        throw new Error('証明書情報を取得できませんでした');
      }

      const records: DnsValidationRecord[] = [];
      
      for (const option of certificate.DomainValidationOptions) {
        if (option.ValidationMethod === 'DNS' && option.ResourceRecord) {
          records.push({
            Name: option.ResourceRecord.Name,
            Type: option.ResourceRecord.Type,
            Value: option.ResourceRecord.Value
          });
        }
      }
      
      return records;
    } catch (error) {
      console.error('エラー:', error);
      throw error;
    }
  }

  displayProviderInstructions(provider: DnsProvider, records: DnsValidationRecord[]) {
    console.log(`\n${provider.name}での設定方法:`);
    console.log(provider.instructions);
    console.log('\n設定するレコード:');
    console.log('─'.repeat(80));
    
    records.forEach(record => {
      console.log(`ホスト名: ${record.Name}`);
      console.log(`タイプ: ${record.Type}`);
      console.log(`値: ${record.Value}`);
      console.log('─'.repeat(80));
    });
  }

  generateDnsRecordsFile(records: DnsValidationRecord[], filename: string = 'dns-validation-records.json') {
    const filePath = path.join(process.cwd(), filename);
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
    console.log(`\nDNSレコード情報を${filePath}に保存しました`);
  }

  async checkValidationStatus(certificateArn: string): Promise<boolean> {
    try {
      const response = await this.acm.describeCertificate({ CertificateArn: certificateArn }).promise();
      const certificate = response.Certificate;
      
      if (!certificate) {
        throw new Error('証明書情報を取得できませんでした');
      }

      console.log('\n検証状態:');
      console.log(`証明書の状態: ${certificate.Status}`);
      
      if (certificate.DomainValidationOptions) {
        for (const option of certificate.DomainValidationOptions) {
          console.log(`\nドメイン: ${option.DomainName}`);
          console.log(`検証状態: ${option.ValidationStatus || '保留中'}`);
        }
      }

      return certificate.Status === 'ISSUED';
    } catch (error) {
      console.error('エラー:', error);
      return false;
    }
  }

  async waitForValidation(certificateArn: string, maxAttempts: number = 60) {
    console.log('\n証明書の検証を待機しています...');
    
    for (let i = 0; i < maxAttempts; i++) {
      const isValid = await this.checkValidationStatus(certificateArn);
      
      if (isValid) {
        console.log('\n✅ 証明書の検証が完了しました！');
        return true;
      }
      
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30秒待機
    }
    
    console.log('\n⏰ タイムアウト: 証明書の検証が完了しませんでした');
    return false;
  }
}

// CLIとして実行
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('使用方法: dns-validation-helper.ts <certificate-arn> [provider] [--wait]');
    console.log('\nプロバイダー:');
    DNS_PROVIDERS.forEach((p, i) => {
      console.log(`  ${i}: ${p.name}`);
    });
    process.exit(1);
  }

  const certificateArn = args[0];
  const providerIndex = args[1] ? parseInt(args[1]) : DNS_PROVIDERS.length - 1;
  const shouldWait = args.includes('--wait');
  
  // 証明書ARNからリージョンを抽出
  const arnParts = certificateArn.split(':');
  const certificateRegion = arnParts.length >= 4 ? arnParts[3] : region;

  const helper = new DnsValidationHelper(certificateRegion);
  
  try {
    console.log('証明書の検証レコードを取得しています...');
    const records = await helper.getCertificateValidationRecords(certificateArn);
    
    if (records.length === 0) {
      console.log('DNS検証レコードが見つかりません。証明書の状態を確認してください。');
      process.exit(1);
    }

    const provider = DNS_PROVIDERS[providerIndex];
    helper.displayProviderInstructions(provider, records);
    helper.generateDnsRecordsFile(records);

    if (shouldWait) {
      await helper.waitForValidation(certificateArn);
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DnsValidationHelper, DnsValidationRecord };
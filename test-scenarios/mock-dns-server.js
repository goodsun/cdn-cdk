#!/usr/bin/env node
// mock-dns-server.js
// テスト用のモックDNSレスポンスを提供するヘルパー

const fs = require('fs');
const path = require('path');

class MockDNSServer {
  constructor(configPath) {
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    this.validationRecords = new Map();
  }

  // DNS TXTレコードのクエリをシミュレート
  queryTXT(domain) {
    console.log(`[MockDNS] Querying TXT record for: ${domain}`);
    
    const record = this.config.mockDNSRecords[domain];
    if (record && record.type === 'TXT') {
      console.log(`[MockDNS] Found TXT record: ${record.value}`);
      return {
        found: true,
        value: record.value,
        ttl: record.ttl
      };
    }
    
    // 動的に追加されたレコードをチェック
    if (this.validationRecords.has(domain)) {
      const dynamicRecord = this.validationRecords.get(domain);
      console.log(`[MockDNS] Found dynamic TXT record: ${dynamicRecord}`);
      return {
        found: true,
        value: dynamicRecord,
        ttl: 300
      };
    }
    
    console.log(`[MockDNS] No TXT record found for: ${domain}`);
    return { found: false };
  }

  // テスト用に検証レコードを追加
  addValidationRecord(domain, value) {
    console.log(`[MockDNS] Adding validation record: ${domain} => ${value}`);
    this.validationRecords.set(domain, value);
  }

  // 証明書の検証をシミュレート
  async simulateCertificateValidation(scenario = 'successfulValidation') {
    const testScenario = this.config.testScenarios[scenario];
    
    console.log(`[MockDNS] Starting certificate validation simulation: ${scenario}`);
    console.log(`[MockDNS] Waiting ${testScenario.delay}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, testScenario.delay));
    
    if (testScenario.status === 'SUCCESS') {
      console.log('[MockDNS] Certificate validation successful!');
      return {
        status: 'ISSUED',
        certificateArn: this.config.mockCertificateArns['us-east-1'],
        domainValidationOptions: this.config.mockValidationOptions.map(opt => ({
          ...opt,
          ValidationStatus: 'SUCCESS'
        }))
      };
    } else if (testScenario.status === 'TIMEOUT') {
      console.log('[MockDNS] Certificate validation timed out!');
      throw new Error('Validation timeout: DNS records not propagated in time');
    } else if (testScenario.status === 'FAILED') {
      console.log('[MockDNS] Certificate validation failed!');
      throw new Error(testScenario.error);
    }
  }

  // ACM証明書のステータスをシミュレート
  getCertificateStatus(certificateArn) {
    if (certificateArn.includes('mock-cert-id')) {
      return {
        Certificate: {
          CertificateArn: certificateArn,
          DomainName: this.config.testDomains.primary,
          Status: 'ISSUED',
          Type: 'AMAZON_ISSUED',
          KeyAlgorithm: 'RSA-2048',
          CreatedAt: new Date().toISOString(),
          IssuedAt: new Date().toISOString(),
          DomainValidationOptions: this.config.mockValidationOptions
        }
      };
    }
    
    throw new Error(`Certificate not found: ${certificateArn}`);
  }

  // テスト環境情報を出力
  printTestEnvironment() {
    console.log('\n=== Mock DNS Test Environment ===');
    console.log(`Primary domain: ${this.config.testDomains.primary}`);
    console.log(`Wildcard domain: ${this.config.testDomains.wildcard}`);
    console.log('Multi-domain setup:', this.config.testDomains.multiDomain.join(', '));
    console.log('\nConfigured DNS records:');
    
    Object.entries(this.config.mockDNSRecords).forEach(([domain, record]) => {
      console.log(`  ${domain}: ${record.type} "${record.value}"`);
    });
    
    console.log('\nTest scenarios available:');
    Object.keys(this.config.testScenarios).forEach(scenario => {
      console.log(`  - ${scenario}`);
    });
    console.log('=================================\n');
  }
}

// CLIとして実行された場合
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const configPath = path.join(__dirname, 'test-config/mock-dns-config.json');
  const mockDNS = new MockDNSServer(configPath);
  
  switch (command) {
    case 'query':
      const domain = args[1];
      if (!domain) {
        console.error('Usage: mock-dns-server.js query <domain>');
        process.exit(1);
      }
      const result = mockDNS.queryTXT(domain);
      console.log(JSON.stringify(result, null, 2));
      break;
      
    case 'validate':
      const scenario = args[1] || 'successfulValidation';
      mockDNS.simulateCertificateValidation(scenario)
        .then(result => {
          console.log('Validation result:', JSON.stringify(result, null, 2));
        })
        .catch(error => {
          console.error('Validation failed:', error.message);
          process.exit(1);
        });
      break;
      
    case 'info':
      mockDNS.printTestEnvironment();
      break;
      
    default:
      console.log('Mock DNS Server for create-cdn testing');
      console.log('\nUsage:');
      console.log('  mock-dns-server.js query <domain>     - Query TXT record');
      console.log('  mock-dns-server.js validate [scenario] - Simulate certificate validation');
      console.log('  mock-dns-server.js info               - Show test environment info');
      console.log('\nScenarios: successfulValidation, validationTimeout, validationFailure');
  }
}

module.exports = MockDNSServer;
#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DnsValidationHelper = void 0;
const AWS = __importStar(require("aws-sdk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// リージョンを環境変数から取得、デフォルトはus-east-1
const region = process.env.AWS_REGION || 'us-east-1';
const DNS_PROVIDERS = [
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
    constructor(regionParam) {
        this.acm = new AWS.ACM({ region: regionParam || region });
    }
    async getCertificateValidationRecords(certificateArn) {
        try {
            const response = await this.acm.describeCertificate({ CertificateArn: certificateArn }).promise();
            const certificate = response.Certificate;
            if (!certificate || !certificate.DomainValidationOptions) {
                throw new Error('証明書情報を取得できませんでした');
            }
            const records = [];
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
        }
        catch (error) {
            console.error('エラー:', error);
            throw error;
        }
    }
    displayProviderInstructions(provider, records) {
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
    generateDnsRecordsFile(records, filename = 'dns-validation-records.json') {
        const filePath = path.join(process.cwd(), filename);
        fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
        console.log(`\nDNSレコード情報を${filePath}に保存しました`);
    }
    async checkValidationStatus(certificateArn) {
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
        }
        catch (error) {
            console.error('エラー:', error);
            return false;
        }
    }
    async waitForValidation(certificateArn, maxAttempts = 60) {
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
exports.DnsValidationHelper = DnsValidationHelper;
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
    }
    catch (error) {
        console.error('エラーが発生しました:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG5zLXZhbGlkYXRpb24taGVscGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZG5zLXZhbGlkYXRpb24taGVscGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSw2Q0FBK0I7QUFFL0IsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUU3QixpQ0FBaUM7QUFDakMsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksV0FBVyxDQUFDO0FBY3JELE1BQU0sYUFBYSxHQUFrQjtJQUNuQztRQUNFLElBQUksRUFBRSxTQUFTO1FBQ2YsWUFBWSxFQUFFOzs7OztvQkFLRTtRQUNoQixVQUFVLEVBQUUsdUJBQXVCO0tBQ3BDO0lBQ0Q7UUFDRSxJQUFJLEVBQUUsWUFBWTtRQUNsQixZQUFZLEVBQUU7Ozs7b0JBSUU7UUFDaEIsVUFBVSxFQUFFLHVCQUF1QjtLQUNwQztJQUNEO1FBQ0UsSUFBSSxFQUFFLGNBQWM7UUFDcEIsWUFBWSxFQUFFOzs7O29CQUlFO1FBQ2hCLFVBQVUsRUFBRSw2QkFBNkI7S0FDMUM7SUFDRDtRQUNFLElBQUksRUFBRSxZQUFZO1FBQ2xCLFlBQVksRUFBRTs7Ozs4QkFJWTtRQUMxQixVQUFVLEVBQUUsMkJBQTJCO0tBQ3hDO0lBQ0Q7UUFDRSxJQUFJLEVBQUUsTUFBTTtRQUNaLFlBQVksRUFBRTswQ0FDd0I7S0FDdkM7Q0FDRixDQUFDO0FBRUYsTUFBTSxtQkFBbUI7SUFHdkIsWUFBWSxXQUFvQjtRQUM5QixJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sRUFBRSxXQUFXLElBQUksTUFBTSxFQUFFLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRUQsS0FBSyxDQUFDLCtCQUErQixDQUFDLGNBQXNCO1FBQzFELElBQUksQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFD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QyxJQUFJLEtBQUssTUFBTSxFQUFFLENBQUM7SUFDNUIsSUFBSSxFQUFFLENBQUM7QUFDVCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICogYXMgQVdTIGZyb20gJ2F3cy1zZGsnO1xuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8vIOODquODvOOCuOODp+ODs+OCkueSsOWig+WkieaVsOOBi+OCieWPluW+l+OAgeODh+ODleOCqeODq+ODiOOBr3VzLWVhc3QtMVxuY29uc3QgcmVnaW9uID0gcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiB8fCAndXMtZWFzdC0xJztcblxuaW50ZXJmYWNlIERuc1ZhbGlkYXRpb25SZWNvcmQge1xuICBOYW1lOiBzdHJpbmc7XG4gIFR5cGU6IHN0cmluZztcbiAgVmFsdWU6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIERuc1Byb3ZpZGVyIHtcbiAgbmFtZTogc3RyaW5nO1xuICBpbnN0cnVjdGlvbnM6IHN0cmluZztcbiAgc2NyaXB0UGF0aD86IHN0cmluZztcbn1cblxuY29uc3QgRE5TX1BST1ZJREVSUzogRG5zUHJvdmlkZXJbXSA9IFtcbiAge1xuICAgIG5hbWU6ICfjgYrlkI3liY0uY29tJyxcbiAgICBpbnN0cnVjdGlvbnM6IGBcbjEuIOOBiuWQjeWJjS5jb23jga7nrqHnkIbnlLvpnaLjgavjg63jgrDjgqTjg7NcbjIuIEROU+mWoumAo+apn+iDveioreWumiA+IEROU+ioreWumi/ou6LpgIHoqK3lrprjgpLpgbjmip5cbjMuIOWvvuixoeODieODoeOCpOODs+OCkumBuOaKnlxuNC4gRE5T44Os44Kz44O844OJ6Kit5a6a44KS6YG45oqeXG41LiDku6XkuIvjga5DTkFNReODrOOCs+ODvOODieOCkui/veWKoDpgLFxuICAgIHNjcmlwdFBhdGg6ICcuL3Byb3ZpZGVycy9vbmFtYWUuanMnXG4gIH0sXG4gIHtcbiAgICBuYW1lOiAn44GV44GP44KJ44Kk44Oz44K/44O844ON44OD44OIJyxcbiAgICBpbnN0cnVjdGlvbnM6IGBcbjEuIOOBleOBj+OCieOBruOCs+ODs+ODiOODreODvOODq+ODkeODjeODq+OBq+ODreOCsOOCpOODs1xuMi4g44OJ44Oh44Kk44OzL1NTTCA+IOODieODoeOCpOODs+S4gOimp+OCkumBuOaKnlxuMy4g5a++6LGh44OJ44Oh44Kk44Oz44Gu44CM44K+44O844Oz57eo6ZuG44CN44KS44Kv44Oq44OD44KvXG40LiDku6XkuIvjga5DTkFNReODrOOCs+ODvOODieOCkui/veWKoDpgLFxuICAgIHNjcmlwdFBhdGg6ICcuL3Byb3ZpZGVycy9zYWt1cmEuanMnXG4gIH0sXG4gIHtcbiAgICBuYW1lOiAnVmFsdWUgRG9tYWluJyxcbiAgICBpbnN0cnVjdGlvbnM6IGBcbjEuIFZhbHVlIERvbWFpbuOBq+ODreOCsOOCpOODs1xuMi4g44OJ44Oh44Kk44OzID4g44OJ44Oh44Kk44Oz44Gu6Kit5a6a5pON5L2c44KS6YG45oqeXG4zLiBETlMvVVJM6Lui6YCB44Gu6Kit5a6a44KS6YG45oqeXG40LiDku6XkuIvjga5DTkFNReODrOOCs+ODvOODieOCkui/veWKoDpgLFxuICAgIHNjcmlwdFBhdGg6ICcuL3Byb3ZpZGVycy92YWx1ZS1kb21haW4uanMnXG4gIH0sXG4gIHtcbiAgICBuYW1lOiAnQ2xvdWRmbGFyZScsXG4gICAgaW5zdHJ1Y3Rpb25zOiBgXG4xLiBDbG91ZGZsYXJl44OA44OD44K344Ol44Oc44O844OJ44Gr44Ot44Kw44Kk44OzXG4yLiDlr77osaHjg4njg6HjgqTjg7PjgpLpgbjmip5cbjMuIEROU+ioreWumuOCkumWi+OBj1xuNC4g5Lul5LiL44GuQ05BTUXjg6zjgrPjg7zjg4njgpLov73liqDvvIjjg5fjg63jgq3jgrfjga9PRkbvvIk6YCxcbiAgICBzY3JpcHRQYXRoOiAnLi9wcm92aWRlcnMvY2xvdWRmbGFyZS5qcydcbiAgfSxcbiAge1xuICAgIG5hbWU6ICfmiYvli5XoqK3lrponLFxuICAgIGluc3RydWN0aW9uczogYFxu44GK5L2/44GE44GuRE5T44OX44Ot44OQ44Kk44OA44O844Gu566h55CG55S76Z2i44Gn5Lul5LiL44GuQ05BTUXjg6zjgrPjg7zjg4njgpLov73liqDjgZfjgabjgY/jgaDjgZXjgYQ6YFxuICB9XG5dO1xuXG5jbGFzcyBEbnNWYWxpZGF0aW9uSGVscGVyIHtcbiAgcHJpdmF0ZSBhY206IEFXUy5BQ007XG4gIFxuICBjb25zdHJ1Y3RvcihyZWdpb25QYXJhbT86IHN0cmluZykge1xuICAgIHRoaXMuYWNtID0gbmV3IEFXUy5BQ00oeyByZWdpb246IHJlZ2lvblBhcmFtIHx8IHJlZ2lvbiB9KTtcbiAgfVxuXG4gIGFzeW5jIGdldENlcnRpZmljYXRlVmFsaWRhdGlvblJlY29yZHMoY2VydGlmaWNhdGVBcm46IHN0cmluZyk6IFByb21pc2U8RG5zVmFsaWRhdGlvblJlY29yZFtdPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5hY20uZGVzY3JpYmVDZXJ0aWZpY2F0ZSh7IENlcnRpZmljYXRlQXJuOiBjZXJ0aWZpY2F0ZUFybiB9KS5wcm9taXNlKCk7XG4gICAgICBjb25zdCBjZXJ0aWZpY2F0ZSA9IHJlc3BvbnNlLkNlcnRpZmljYXRlO1xuICAgICAgXG4gICAgICBpZiAoIWNlcnRpZmljYXRlIHx8ICFjZXJ0aWZpY2F0ZS5Eb21haW5WYWxpZGF0aW9uT3B0aW9ucykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+iovOaYjuabuOaDheWgseOCkuWPluW+l+OBp+OBjeOBvuOBm+OCk+OBp+OBl+OBnycpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZWNvcmRzOiBEbnNWYWxpZGF0aW9uUmVjb3JkW10gPSBbXTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBvcHRpb24gb2YgY2VydGlmaWNhdGUuRG9tYWluVmFsaWRhdGlvbk9wdGlvbnMpIHtcbiAgICAgICAgaWYgKG9wdGlvbi5WYWxpZGF0aW9uTWV0aG9kID09PSAnRE5TJyAmJiBvcHRpb24uUmVzb3VyY2VSZWNvcmQpIHtcbiAgICAgICAgICByZWNvcmRzLnB1c2goe1xuICAgICAgICAgICAgTmFtZTogb3B0aW9uLlJlc291cmNlUmVjb3JkLk5hbWUsXG4gICAgICAgICAgICBUeXBlOiBvcHRpb24uUmVzb3VyY2VSZWNvcmQuVHlwZSxcbiAgICAgICAgICAgIFZhbHVlOiBvcHRpb24uUmVzb3VyY2VSZWNvcmQuVmFsdWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gcmVjb3JkcztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcign44Ko44Op44O8OicsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIGRpc3BsYXlQcm92aWRlckluc3RydWN0aW9ucyhwcm92aWRlcjogRG5zUHJvdmlkZXIsIHJlY29yZHM6IERuc1ZhbGlkYXRpb25SZWNvcmRbXSkge1xuICAgIGNvbnNvbGUubG9nKGBcXG4ke3Byb3ZpZGVyLm5hbWV944Gn44Gu6Kit5a6a5pa55rOVOmApO1xuICAgIGNvbnNvbGUubG9nKHByb3ZpZGVyLmluc3RydWN0aW9ucyk7XG4gICAgY29uc29sZS5sb2coJ1xcbuioreWumuOBmeOCi+ODrOOCs+ODvOODiTonKTtcbiAgICBjb25zb2xlLmxvZygn4pSAJy5yZXBlYXQoODApKTtcbiAgICBcbiAgICByZWNvcmRzLmZvckVhY2gocmVjb3JkID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGDjg5vjgrnjg4jlkI06ICR7cmVjb3JkLk5hbWV9YCk7XG4gICAgICBjb25zb2xlLmxvZyhg44K/44Kk44OXOiAke3JlY29yZC5UeXBlfWApO1xuICAgICAgY29uc29sZS5sb2coYOWApDogJHtyZWNvcmQuVmFsdWV9YCk7XG4gICAgICBjb25zb2xlLmxvZygn4pSAJy5yZXBlYXQoODApKTtcbiAgICB9KTtcbiAgfVxuXG4gIGdlbmVyYXRlRG5zUmVjb3Jkc0ZpbGUocmVjb3JkczogRG5zVmFsaWRhdGlvblJlY29yZFtdLCBmaWxlbmFtZTogc3RyaW5nID0gJ2Rucy12YWxpZGF0aW9uLXJlY29yZHMuanNvbicpIHtcbiAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBmaWxlbmFtZSk7XG4gICAgZnMud3JpdGVGaWxlU3luYyhmaWxlUGF0aCwgSlNPTi5zdHJpbmdpZnkocmVjb3JkcywgbnVsbCwgMikpO1xuICAgIGNvbnNvbGUubG9nKGBcXG5ETlPjg6zjgrPjg7zjg4nmg4XloLHjgpIke2ZpbGVQYXRofeOBq+S/neWtmOOBl+OBvuOBl+OBn2ApO1xuICB9XG5cbiAgYXN5bmMgY2hlY2tWYWxpZGF0aW9uU3RhdHVzKGNlcnRpZmljYXRlQXJuOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmFjbS5kZXNjcmliZUNlcnRpZmljYXRlKHsgQ2VydGlmaWNhdGVBcm46IGNlcnRpZmljYXRlQXJuIH0pLnByb21pc2UoKTtcbiAgICAgIGNvbnN0IGNlcnRpZmljYXRlID0gcmVzcG9uc2UuQ2VydGlmaWNhdGU7XG4gICAgICBcbiAgICAgIGlmICghY2VydGlmaWNhdGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfoqLzmmI7mm7jmg4XloLHjgpLlj5blvpfjgafjgY3jgb7jgZvjgpPjgafjgZfjgZ8nKTtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coJ1xcbuaknOiovOeKtuaFizonKTtcbiAgICAgIGNvbnNvbGUubG9nKGDoqLzmmI7mm7jjga7nirbmhYs6ICR7Y2VydGlmaWNhdGUuU3RhdHVzfWApO1xuICAgICAgXG4gICAgICBpZiAoY2VydGlmaWNhdGUuRG9tYWluVmFsaWRhdGlvbk9wdGlvbnMpIHtcbiAgICAgICAgZm9yIChjb25zdCBvcHRpb24gb2YgY2VydGlmaWNhdGUuRG9tYWluVmFsaWRhdGlvbk9wdGlvbnMpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgXFxu44OJ44Oh44Kk44OzOiAke29wdGlvbi5Eb21haW5OYW1lfWApO1xuICAgICAgICAgIGNvbnNvbGUubG9nKGDmpJzoqLznirbmhYs6ICR7b3B0aW9uLlZhbGlkYXRpb25TdGF0dXMgfHwgJ+S/neeVmeS4rSd9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGNlcnRpZmljYXRlLlN0YXR1cyA9PT0gJ0lTU1VFRCc7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+OCqOODqeODvDonLCBlcnJvcik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgd2FpdEZvclZhbGlkYXRpb24oY2VydGlmaWNhdGVBcm46IHN0cmluZywgbWF4QXR0ZW1wdHM6IG51bWJlciA9IDYwKSB7XG4gICAgY29uc29sZS5sb2coJ1xcbuiovOaYjuabuOOBruaknOiovOOCkuW+heapn+OBl+OBpuOBhOOBvuOBmS4uLicpO1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWF4QXR0ZW1wdHM7IGkrKykge1xuICAgICAgY29uc3QgaXNWYWxpZCA9IGF3YWl0IHRoaXMuY2hlY2tWYWxpZGF0aW9uU3RhdHVzKGNlcnRpZmljYXRlQXJuKTtcbiAgICAgIFxuICAgICAgaWYgKGlzVmFsaWQpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1xcbuKchSDoqLzmmI7mm7jjga7mpJzoqLzjgYzlrozkuobjgZfjgb7jgZfjgZ/vvIEnKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKCcuJyk7XG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMzAwMDApKTsgLy8gMzDnp5LlvoXmqZ9cbiAgICB9XG4gICAgXG4gICAgY29uc29sZS5sb2coJ1xcbuKPsCDjgr/jgqTjg6DjgqLjgqbjg4g6IOiovOaYjuabuOOBruaknOiovOOBjOWujOS6huOBl+OBvuOBm+OCk+OBp+OBl+OBnycpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG4vLyBDTEnjgajjgZfjgablrp/ooYxcbmFzeW5jIGZ1bmN0aW9uIG1haW4oKSB7XG4gIGNvbnN0IGFyZ3MgPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XG4gIFxuICBpZiAoYXJncy5sZW5ndGggPCAxKSB7XG4gICAgY29uc29sZS5sb2coJ+S9v+eUqOaWueazlTogZG5zLXZhbGlkYXRpb24taGVscGVyLnRzIDxjZXJ0aWZpY2F0ZS1hcm4+IFtwcm92aWRlcl0gWy0td2FpdF0nKTtcbiAgICBjb25zb2xlLmxvZygnXFxu44OX44Ot44OQ44Kk44OA44O8OicpO1xuICAgIEROU19QUk9WSURFUlMuZm9yRWFjaCgocCwgaSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYCAgJHtpfTogJHtwLm5hbWV9YCk7XG4gICAgfSk7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9XG5cbiAgY29uc3QgY2VydGlmaWNhdGVBcm4gPSBhcmdzWzBdO1xuICBjb25zdCBwcm92aWRlckluZGV4ID0gYXJnc1sxXSA/IHBhcnNlSW50KGFyZ3NbMV0pIDogRE5TX1BST1ZJREVSUy5sZW5ndGggLSAxO1xuICBjb25zdCBzaG91bGRXYWl0ID0gYXJncy5pbmNsdWRlcygnLS13YWl0Jyk7XG4gIFxuICAvLyDoqLzmmI7mm7hBUk7jgYvjgonjg6rjg7zjgrjjg6fjg7PjgpLmir3lh7pcbiAgY29uc3QgYXJuUGFydHMgPSBjZXJ0aWZpY2F0ZUFybi5zcGxpdCgnOicpO1xuICBjb25zdCBjZXJ0aWZpY2F0ZVJlZ2lvbiA9IGFyblBhcnRzLmxlbmd0aCA+PSA0ID8gYXJuUGFydHNbM10gOiByZWdpb247XG5cbiAgY29uc3QgaGVscGVyID0gbmV3IERuc1ZhbGlkYXRpb25IZWxwZXIoY2VydGlmaWNhdGVSZWdpb24pO1xuICBcbiAgdHJ5IHtcbiAgICBjb25zb2xlLmxvZygn6Ki85piO5pu444Gu5qSc6Ki844Os44Kz44O844OJ44KS5Y+W5b6X44GX44Gm44GE44G+44GZLi4uJyk7XG4gICAgY29uc3QgcmVjb3JkcyA9IGF3YWl0IGhlbHBlci5nZXRDZXJ0aWZpY2F0ZVZhbGlkYXRpb25SZWNvcmRzKGNlcnRpZmljYXRlQXJuKTtcbiAgICBcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKCdETlPmpJzoqLzjg6zjgrPjg7zjg4njgYzopovjgaTjgYvjgorjgb7jgZvjgpPjgILoqLzmmI7mm7jjga7nirbmhYvjgpLnorroqo3jgZfjgabjgY/jgaDjgZXjgYTjgIInKTtcbiAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG5cbiAgICBjb25zdCBwcm92aWRlciA9IEROU19QUk9WSURFUlNbcHJvdmlkZXJJbmRleF07XG4gICAgaGVscGVyLmRpc3BsYXlQcm92aWRlckluc3RydWN0aW9ucyhwcm92aWRlciwgcmVjb3Jkcyk7XG4gICAgaGVscGVyLmdlbmVyYXRlRG5zUmVjb3Jkc0ZpbGUocmVjb3Jkcyk7XG5cbiAgICBpZiAoc2hvdWxkV2FpdCkge1xuICAgICAgYXdhaXQgaGVscGVyLndhaXRGb3JWYWxpZGF0aW9uKGNlcnRpZmljYXRlQXJuKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcign44Ko44Op44O844GM55m655Sf44GX44G+44GX44GfOicsIGVycm9yKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG4gIH1cbn1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIG1haW4oKTtcbn1cblxuZXhwb3J0IHsgRG5zVmFsaWRhdGlvbkhlbHBlciwgRG5zVmFsaWRhdGlvblJlY29yZCB9OyJdfQ==
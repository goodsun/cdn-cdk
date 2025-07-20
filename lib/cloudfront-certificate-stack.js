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
exports.CloudFrontCertificateStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
class CloudFrontCertificateStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        const subjectAlternativeNames = [];
        if (isWildcard) {
            // ワイルドカード証明書の場合、ベースドメインも含める
            const baseDomain = domainName.substring(2);
            subjectAlternativeNames.push(baseDomain);
        }
        else {
            // 通常の証明書の場合
            if (includeWww) {
                subjectAlternativeNames.push(`www.${domainName}`);
            }
        }
        if (additionalDomains.length > 0) {
            subjectAlternativeNames.push(...additionalDomains);
        }
        // DNS検証の設定
        let validation;
        if (hostedZoneId && hostedZoneName) {
            // Route53を使用した自動DNS検証
            const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
                hostedZoneId,
                zoneName: hostedZoneName,
            });
            validation = acm.CertificateValidation.fromDns(hostedZone);
        }
        else {
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
exports.CloudFrontCertificateStack = CloudFrontCertificateStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWRmcm9udC1jZXJ0aWZpY2F0ZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsb3VkZnJvbnQtY2VydGlmaWNhdGUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHdFQUEwRDtBQUMxRCx5REFBMkM7QUFDM0MsaUVBQW1EO0FBV25ELE1BQWEsMEJBQTJCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFJdkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQztRQUM5RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsVUFBVSxFQUFFLFVBQVUsR0FBRyxJQUFJLEVBQUUsaUJBQWlCLEdBQUcsRUFBRSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFdEcsMkNBQTJDO1FBQzNDLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUUsQ0FBQztZQUNoQyxNQUFNLElBQUksS0FBSyxDQUFDLDZEQUE2RCxDQUFDLENBQUM7UUFDakYsQ0FBQztRQUVELG9CQUFvQjtRQUNwQixNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRS9DLGdCQUFnQjtRQUNoQixNQUFNLGlCQUFpQixHQUFHLFVBQVUsQ0FBQztRQUNyQyxNQUFNLHVCQUF1QixHQUFhLEVBQUUsQ0FBQztRQUU3QyxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2YsNEJBQTRCO1lBQzVCLE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0MsdUJBQXVCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzNDLENBQUM7YUFBTSxDQUFDO1lBQ04sWUFBWTtZQUNaLElBQUksVUFBVSxF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Q0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDL0MsQ0FBQztDQUNGO0FBN0ZELGdFQTZGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBhY20gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNlcnRpZmljYXRlbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBzc20gZnJvbSAnYXdzLWNkay1saWIvYXdzLXNzbSc7XG5pbXBvcnQgKiBhcyByb3V0ZTUzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yb3V0ZTUzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENsb3VkRnJvbnRDZXJ0aWZpY2F0ZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgaW5jbHVkZVd3dz86IGJvb2xlYW47XG4gIGFkZGl0aW9uYWxEb21haW5zPzogc3RyaW5nW107XG4gIGhvc3RlZFpvbmVJZD86IHN0cmluZztcbiAgaG9zdGVkWm9uZU5hbWU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBDbG91ZEZyb250Q2VydGlmaWNhdGVTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBjZXJ0aWZpY2F0ZTogYWNtLkNlcnRpZmljYXRlO1xuICBwdWJsaWMgcmVhZG9ubHkgY2VydGlmaWNhdGVBcm46IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQ2xvdWRGcm9udENlcnRpZmljYXRlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBkb21haW5OYW1lLCBpbmNsdWRlV3d3ID0gdHJ1ZSwgYWRkaXRpb25hbERvbWFpbnMgPSBbXSwgaG9zdGVkWm9uZUlkLCBob3N0ZWRab25lTmFtZSB9ID0gcHJvcHM7XG4gICAgXG4gICAgLy8gQ2xvdWRGcm9udOeUqOOBruiovOaYjuabuOOBr+W/heOBmnVzLWVhc3QtMeODquODvOOCuOODp+ODs+OBp+OBguOCi+W/heimgeOBjOOBguOCi1xuICAgIGlmICh0aGlzLnJlZ2lvbiAhPT0gJ3VzLWVhc3QtMScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2xvdWRGcm9udCBjZXJ0aWZpY2F0ZXMgbXVzdCBiZSBjcmVhdGVkIGluIHVzLWVhc3QtMSByZWdpb24nKTtcbiAgICB9XG5cbiAgICAvLyDjg6/jgqTjg6vjg4njgqvjg7zjg4noqLzmmI7mm7jjgYvjganjgYbjgYvjgpLliKTlrppcbiAgICBjb25zdCBpc1dpbGRjYXJkID0gZG9tYWluTmFtZS5zdGFydHNXaXRoKCcqLicpO1xuICAgIFxuICAgIC8vIOiovOaYjuabuOOBruODl+ODqeOCpOODnuODquODieODoeOCpOODs1xuICAgIGNvbnN0IGNlcnRpZmljYXRlRG9tYWluID0gZG9tYWluTmFtZTtcbiAgICBjb25zdCBzdWJqZWN0QWx0ZXJuYXRpdmVOYW1lczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBpZiAoaXNXaWxkY2FyZCkge1xuICAgICAgLy8g44Ov44Kk44Or44OJ44Kr44O844OJ6Ki85piO5pu444Gu5aC05ZCI44CB44OZ44O844K544OJ44Oh44Kk44Oz44KC5ZCr44KB44KLXG4gICAgICBjb25zdCBiYXNlRG9tYWluID0gZG9tYWluTmFtZS5zdWJzdHJpbmcoMik7XG4gICAgICBzdWJqZWN0QWx0ZXJuYXRpdmVOYW1lcy5wdXNoKGJhc2VEb21haW4pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyDpgJrluLjjga7oqLzmmI7mm7jjga7loLTlkIhcbiAgICAgIGlmIChpbmNsdWRlV3d3KSB7XG4gICAgICAgIHN1YmplY3RBbHRlcm5hdGl2ZU5hbWVzLnB1c2goYHd3dy4ke2RvbWFpbk5hbWV9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmIChhZGRpdGlvbmFsRG9tYWlucy5sZW5ndGggPiAwKSB7XG4gICAgICBzdWJqZWN0QWx0ZXJuYXRpdmVOYW1lcy5wdXNoKC4uLmFkZGl0aW9uYWxEb21haW5zKTtcbiAgICB9XG5cbiAgICAvLyBETlPmpJzoqLzjga7oqK3lrppcbiAgICBsZXQgdmFsaWRhdGlvbjogYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbjtcbiAgICBcbiAgICBpZiAoaG9zdGVkWm9uZUlkICYmIGhvc3RlZFpvbmVOYW1lKSB7XG4gICAgICAvLyBSb3V0ZTUz44KS5L2/55So44GX44Gf6Ieq5YuVRE5T5qSc6Ki8XG4gICAgICBjb25zdCBob3N0ZWRab25lID0gcm91dGU1My5Ib3N0ZWRab25lLmZyb21Ib3N0ZWRab25lQXR0cmlidXRlcyh0aGlzLCAnSG9zdGVkWm9uZScsIHtcbiAgICAgICAgaG9zdGVkWm9uZUlkLFxuICAgICAgICB6b25lTmFtZTogaG9zdGVkWm9uZU5hbWUsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgdmFsaWRhdGlvbiA9IGFjbS5DZXJ0aWZpY2F0ZVZhbGlkYXRpb24uZnJvbURucyhob3N0ZWRab25lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8g5omL5YuVRE5T5qSc6Ki8XG4gICAgICB2YWxpZGF0aW9uID0gYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKCk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRGcm9udOeUqOiovOaYjuabuOOBruS9nOaIkO+8iOacgOaWsOOBruOCs+ODs+OCueODiOODqeOCr+ODiOOCkuS9v+eUqO+8iVxuICAgIHRoaXMuY2VydGlmaWNhdGUgPSBuZXcgYWNtLkNlcnRpZmljYXRlKHRoaXMsICdDbG91ZEZyb250Q2VydGlmaWNhdGUnLCB7XG4gICAgICBkb21haW5OYW1lOiBjZXJ0aWZpY2F0ZURvbWFpbixcbiAgICAgIHN1YmplY3RBbHRlcm5hdGl2ZU5hbWVzOiBzdWJqZWN0QWx0ZXJuYXRpdmVOYW1lcy5sZW5ndGggPiAwID8gc3ViamVjdEFsdGVybmF0aXZlTmFtZXMgOiB1bmRlZmluZWQsXG4gICAgICB2YWxpZGF0aW9uLFxuICAgICAgY2VydGlmaWNhdGVOYW1lOiBgJHtkb21haW5OYW1lLnJlcGxhY2UoL1sqLl0vZywgJy0nKX0tY2xvdWRmcm9udC1jZXJ0aWZpY2F0ZWAsXG4gICAgfSk7XG5cbiAgICAvLyDoqLzmmI7mm7jjga5BUk7jgpJTU00gUGFyYW1ldGVyIFN0b3Jl44Gr5L+d5a2Y77yI44Kv44Ot44K544Oq44O844K444On44Oz44Ki44Kv44K744K555So77yJXG4gICAgLy8g44Ov44Kk44Or44OJ44Kr44O844OJ6Ki85piO5pu444Gu5aC05ZCI44CB44OR44Op44Oh44O844K/5ZCN44GuKuOCki13aWxkY2FyZC3jgavnva7mj5tcbiAgICBjb25zdCBwYXJhbWV0ZXJTYWZlRG9tYWluID0gZG9tYWluTmFtZS5yZXBsYWNlKC9eXFwqXFwuLywgJ3dpbGRjYXJkLicpO1xuICAgIGNvbnN0IGNlcnRpZmljYXRlQXJuUGFyYW0gPSBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnQ2xvdWRGcm9udENlcnRpZmljYXRlQXJuUGFyYW1ldGVyJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC9hY20vJHtwYXJhbWV0ZXJTYWZlRG9tYWlufS9jbG91ZGZyb250LWNlcnRpZmljYXRlLWFybmAsXG4gICAgICBzdHJpbmdWYWx1ZTogdGhpcy5jZXJ0aWZpY2F0ZS5jZXJ0aWZpY2F0ZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiBgQ2xvdWRGcm9udCBDZXJ0aWZpY2F0ZSBBUk4gZm9yICR7Y2VydGlmaWNhdGVEb21haW59YCxcbiAgICAgIHRpZXI6IHNzbS5QYXJhbWV0ZXJUaWVyLlNUQU5EQVJELFxuICAgIH0pO1xuXG4gICAgdGhpcy5jZXJ0aWZpY2F0ZUFybiA9IHRoaXMuY2VydGlmaWNhdGUuY2VydGlmaWNhdGVBcm47XG5cbiAgICAvLyDlh7rliptcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udENlcnRpZmljYXRlQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuY2VydGlmaWNhdGUuY2VydGlmaWNhdGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBBUk4gb2YgdGhlIENsb3VkRnJvbnQgY2VydGlmaWNhdGUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnRDZXJ0aWZpY2F0ZURvbWFpbnMnLCB7XG4gICAgICB2YWx1ZTogSlNPTi5zdHJpbmdpZnkoW2NlcnRpZmljYXRlRG9tYWluLCAuLi5zdWJqZWN0QWx0ZXJuYXRpdmVOYW1lc10pLFxuICAgICAgZGVzY3JpcHRpb246ICdEb21haW5zIGNvdmVyZWQgYnkgdGhpcyBDbG91ZEZyb250IGNlcnRpZmljYXRlJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250U1NNUGFyYW1ldGVyTmFtZScsIHtcbiAgICAgIHZhbHVlOiBjZXJ0aWZpY2F0ZUFyblBhcmFtLnBhcmFtZXRlck5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NTTSBQYXJhbWV0ZXIgbmFtZSBmb3IgQ2xvdWRGcm9udCBjZXJ0aWZpY2F0ZSBBUk4nLFxuICAgIH0pO1xuXG4gICAgLy8g44K/44Kw5LuY44GRXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZXJ2aWNlJywgJ0FDTS1DbG91ZEZyb250Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdSZWdpb24nLCAndXMtZWFzdC0xJyk7XG4gIH1cbn0iXX0=
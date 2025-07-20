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
exports.CertificateStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const constructs_1 = require("constructs");
class CertificateStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const { domainName, includeWww = true, additionalDomains = [], hostedZoneId, hostedZoneName } = props;
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
exports.CertificateStack = CertificateStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VydGlmaWNhdGUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjZXJ0aWZpY2F0ZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsd0VBQTBEO0FBQzFELHlEQUEyQztBQUMzQyxpRUFBbUQ7QUFDbkQsMkNBQXVDO0FBVXZDLE1BQWEsZ0JBQWlCLFNBQVEsc0JBQVM7SUFJN0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE0QjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sRUFBRSxVQUFVLEVBQUUsVUFBVSxHQUFHLElBQUksRUFBRSxpQkFBaUIsR0FBRyxFQUFFLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV0RyxvQkFBb0I7UUFDcEIsTUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUvQyxnQkFBZ0I7UUFDaEIsTUFBTSxpQkFBaUIsR0FBRyxVQUFVLENBQUM7UUFDckMsTUFBTSx1QkFBdUIsR0FBYSxFQUFFLENBQUM7UUFFN0MsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNmLDRCQUE0QjtZQUM1QixNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMzQyxDQUFDO2FBQU0sQ0FBQztZQUNOLFlBQVk7WUFDWixJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUNmLHVCQUF1QixDQUFDLElBQUksQ0FBQyxPQUFPLFVBQVUsRUFBRSxDQUFDLENBQUM7WUFDcEQsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLGlCQUFpQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNqQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFFRCxXQUFXO1FBQ1gsSUFBSSxVQUFxQyxDQUFDO1FBRTFDLElBQUksWUFBWSxJQUFJLGNBQWMsRUFBRSxDQUFDO1lBQ25DLHNCQUFzQjtZQUN0QixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLHdCQUF3QixDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7Z0JBQ2pGLFlBQVk7Z0JBQ1osUUFBUSxFQUFFLGNBQWM7YUFDekIsQ0FBQyxDQUFDO1lBRUgsVUFBVSxHQUFHLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDN0QsQ0FBQzthQUFNLENBQUM7WUFDTixVQUFVO1lBQ1YsVUFBVSxHQUFHLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNuRCxDQUFDO1FBRUQsd0JBQXdCO1FBQ3hCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDMUQsVUFBVSxFQUFFLGlCQUFpQjtZQUM3Qix1QkFBdUIsRUFBRSx1QkFBdUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsU0FBUztZQUNqRyxVQUFVO1lBQ1YsZUFBZSxFQUFFLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLGNBQWM7U0FDbkUsQ0FBQyxDQUFDO1FBRUgsaUNBQWlDO1FBQ2pDLHVDQUF1QztRQUN2QyxNQUFNLG1CQUFtQixHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ3JFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNuRixhQUFhLEVBQUUsUUFBUSxtQkFBbUIsa0JBQWtCO1lBQzVELFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLGNBQWM7WUFDNUMsV0FBVyxFQUFFLHVCQUF1QixpQkFBaUIsRUFBRTtZQUN2RCxJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRO1NBQ2pDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUM7UUFFdEQscUJBQXFCO1FBQ3JCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3hELENBQUM7Q0FDRjtBQXZFRCw0Q0F1RUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgYWNtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXInO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0ICogYXMgcm91dGU1MyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1Myc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBDZXJ0aWZpY2F0ZVN0YWNrUHJvcHMge1xuICBkb21haW5OYW1lOiBzdHJpbmc7XG4gIGluY2x1ZGVXd3c/OiBib29sZWFuO1xuICBhZGRpdGlvbmFsRG9tYWlucz86IHN0cmluZ1tdO1xuICBob3N0ZWRab25lSWQ/OiBzdHJpbmc7XG4gIGhvc3RlZFpvbmVOYW1lPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgQ2VydGlmaWNhdGVTdGFjayBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBjZXJ0aWZpY2F0ZTogYWNtLkNlcnRpZmljYXRlO1xuICBwdWJsaWMgcmVhZG9ubHkgY2VydGlmaWNhdGVBcm46IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQ2VydGlmaWNhdGVTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IHsgZG9tYWluTmFtZSwgaW5jbHVkZVd3dyA9IHRydWUsIGFkZGl0aW9uYWxEb21haW5zID0gW10sIGhvc3RlZFpvbmVJZCwgaG9zdGVkWm9uZU5hbWUgfSA9IHByb3BzO1xuICAgIFxuICAgIC8vIOODr+OCpOODq+ODieOCq+ODvOODieiovOaYjuabuOOBi+OBqeOBhuOBi+OCkuWIpOWumlxuICAgIGNvbnN0IGlzV2lsZGNhcmQgPSBkb21haW5OYW1lLnN0YXJ0c1dpdGgoJyouJyk7XG4gICAgXG4gICAgLy8g6Ki85piO5pu444Gu44OX44Op44Kk44Oe44Oq44OJ44Oh44Kk44OzXG4gICAgY29uc3QgY2VydGlmaWNhdGVEb21haW4gPSBkb21haW5OYW1lO1xuICAgIGNvbnN0IHN1YmplY3RBbHRlcm5hdGl2ZU5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGlmIChpc1dpbGRjYXJkKSB7XG4gICAgICAvLyDjg6/jgqTjg6vjg4njgqvjg7zjg4noqLzmmI7mm7jjga7loLTlkIjjgIHjg5njg7zjgrnjg4njg6HjgqTjg7PjgoLlkKvjgoHjgotcbiAgICAgIGNvbnN0IGJhc2VEb21haW4gPSBkb21haW5OYW1lLnN1YnN0cmluZygyKTtcbiAgICAgIHN1YmplY3RBbHRlcm5hdGl2ZU5hbWVzLnB1c2goYmFzZURvbWFpbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIOmAmuW4uOOBruiovOaYjuabuOOBruWgtOWQiFxuICAgICAgaWYgKGluY2x1ZGVXd3cpIHtcbiAgICAgICAgc3ViamVjdEFsdGVybmF0aXZlTmFtZXMucHVzaChgd3d3LiR7ZG9tYWluTmFtZX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKGFkZGl0aW9uYWxEb21haW5zLmxlbmd0aCA+IDApIHtcbiAgICAgIHN1YmplY3RBbHRlcm5hdGl2ZU5hbWVzLnB1c2goLi4uYWRkaXRpb25hbERvbWFpbnMpO1xuICAgIH1cblxuICAgIC8vIEROU+aknOiovOOBruioreWumlxuICAgIGxldCB2YWxpZGF0aW9uOiBhY20uQ2VydGlmaWNhdGVWYWxpZGF0aW9uO1xuICAgIFxuICAgIGlmIChob3N0ZWRab25lSWQgJiYgaG9zdGVkWm9uZU5hbWUpIHtcbiAgICAgIC8vIFJvdXRlNTPjgpLkvb/nlKjjgZfjgZ/oh6rli5VETlPmpJzoqLxcbiAgICAgIGNvbnN0IGhvc3RlZFpvbmUgPSByb3V0ZTUzLkhvc3RlZFpvbmUuZnJvbUhvc3RlZFpvbmVBdHRyaWJ1dGVzKHRoaXMsICdIb3N0ZWRab25lJywge1xuICAgICAgICBob3N0ZWRab25lSWQsXG4gICAgICAgIHpvbmVOYW1lOiBob3N0ZWRab25lTmFtZSxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICB2YWxpZGF0aW9uID0gYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKGhvc3RlZFpvbmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyDmiYvli5VETlPmpJzoqLxcbiAgICAgIHZhbGlkYXRpb24gPSBhY20uQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnMoKTtcbiAgICB9XG5cbiAgICAvLyDoqLzmmI7mm7jjga7kvZzmiJDvvIjmnIDmlrDjga7jgrPjg7Pjgrnjg4jjg6njgq/jg4jjgpLkvb/nlKjvvIlcbiAgICB0aGlzLmNlcnRpZmljYXRlID0gbmV3IGFjbS5DZXJ0aWZpY2F0ZSh0aGlzLCAnQ2VydGlmaWNhdGUnLCB7XG4gICAgICBkb21haW5OYW1lOiBjZXJ0aWZpY2F0ZURvbWFpbixcbiAgICAgIHN1YmplY3RBbHRlcm5hdGl2ZU5hbWVzOiBzdWJqZWN0QWx0ZXJuYXRpdmVOYW1lcy5sZW5ndGggPiAwID8gc3ViamVjdEFsdGVybmF0aXZlTmFtZXMgOiB1bmRlZmluZWQsXG4gICAgICB2YWxpZGF0aW9uLFxuICAgICAgY2VydGlmaWNhdGVOYW1lOiBgJHtkb21haW5OYW1lLnJlcGxhY2UoL1sqLl0vZywgJy0nKX0tY2VydGlmaWNhdGVgLFxuICAgIH0pO1xuXG4gICAgLy8g6Ki85piO5pu444GuQVJO44KSU1NNIFBhcmFtZXRlciBTdG9yZeOBq+S/neWtmFxuICAgIC8vIOODr+OCpOODq+ODieOCq+ODvOODieiovOaYjuabuOOBruWgtOWQiOOAgeODkeODqeODoeODvOOCv+WQjeOBrirjgpItd2lsZGNhcmQt44Gr572u5o+bXG4gICAgY29uc3QgcGFyYW1ldGVyU2FmZURvbWFpbiA9IGRvbWFpbk5hbWUucmVwbGFjZSgvXlxcKlxcLi8sICd3aWxkY2FyZC4nKTtcbiAgICBjb25zdCBjZXJ0aWZpY2F0ZUFyblBhcmFtID0gbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0NlcnRpZmljYXRlQXJuUGFyYW1ldGVyJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC9hY20vJHtwYXJhbWV0ZXJTYWZlRG9tYWlufS9jZXJ0aWZpY2F0ZS1hcm5gLFxuICAgICAgc3RyaW5nVmFsdWU6IHRoaXMuY2VydGlmaWNhdGUuY2VydGlmaWNhdGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogYENlcnRpZmljYXRlIEFSTiBmb3IgJHtjZXJ0aWZpY2F0ZURvbWFpbn1gLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsXG4gICAgfSk7XG5cbiAgICB0aGlzLmNlcnRpZmljYXRlQXJuID0gdGhpcy5jZXJ0aWZpY2F0ZS5jZXJ0aWZpY2F0ZUFybjtcblxuICAgIC8vIOOCv+OCsOS7mOOBke+8iOiovOaYjuabuOODquOCveODvOOCueOBq+ebtOaOpemBqeeUqO+8iVxuICAgIGNkay5UYWdzLm9mKHRoaXMuY2VydGlmaWNhdGUpLmFkZCgnU2VydmljZScsICdBQ00nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzLmNlcnRpZmljYXRlKS5hZGQoJ01hbmFnZWRCeScsICdDREsnKTtcbiAgfVxufSJdfQ==
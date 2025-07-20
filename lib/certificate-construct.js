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
exports.CertificateConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const constructs_1 = require("constructs");
class CertificateConstruct extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const { domainName, hostedZoneId, hostedZoneName } = props;
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
exports.CertificateConstruct = CertificateConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VydGlmaWNhdGUtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2VydGlmaWNhdGUtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx3RUFBMEQ7QUFDMUQsaUVBQW1EO0FBQ25ELDJDQUF1QztBQVN2QyxNQUFhLG9CQUFxQixTQUFRLHNCQUFTO0lBSWpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFM0QsV0FBVztRQUNYLElBQUksVUFBcUMsQ0FBQztRQUUxQyxJQUFJLFlBQVksSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUNuQyxzQkFBc0I7WUFDdEIsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO2dCQUNqRixZQUFZO2dCQUNaLFFBQVEsRUFBRSxjQUFjO2FBQ3pCLENBQUMsQ0FBQztZQUVILFVBQVUsR0FBRyxHQUFHLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdELENBQUM7YUFBTSxDQUFDO1lBQ04sVUFBVTtZQUNWLFVBQVUsR0FBRyxHQUFHLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDbkQsQ0FBQztRQUVELFNBQVM7UUFDVCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQzFELFVBQVUsRUFBRSxVQUFVO1lBQ3RCLFVBQVU7U0FDWCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDO1FBRXRELGtCQUFrQjtRQUNsQixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxVQUFVO1lBQ2pCLFdBQVcsRUFBRSx3QkFBd0I7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsd0JBQXdCO1FBQ3hCLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUNsRixZQUFZLEVBQUUsR0FBRyxDQUFDLHNCQUFzQixDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7Z0JBQ3RGLGFBQWEsRUFBRSxHQUFHLFNBQVMsYUFBYTtnQkFDeEMsT0FBTyxFQUFFLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxXQUFXO2dCQUN0RCxnQkFBZ0IsRUFBRSxDQUFDO3dCQUNqQixNQUFNLEVBQUUsT0FBTzt3QkFDZixNQUFNLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQzt3QkFDbkMsUUFBUSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYztxQkFDMUMsQ0FBQzthQUNILENBQUM7WUFDRixVQUFVLEVBQUU7Z0JBQ1YsY0FBYyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYztnQkFDL0MsTUFBTSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU07YUFDbEM7U0FDRixDQUFDLENBQUM7UUFFSCxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM3RCxDQUFDO0NBQ0Y7QUExREQsb0RBMERDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFjbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIHJvdXRlNTMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjaGFsayBmcm9tICdjaGFsayc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2VydGlmaWNhdGVDb25zdHJ1Y3RQcm9wcyB7XG4gIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgaG9zdGVkWm9uZUlkPzogc3RyaW5nO1xuICBob3N0ZWRab25lTmFtZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIENlcnRpZmljYXRlQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGNlcnRpZmljYXRlOiBhY20uQ2VydGlmaWNhdGU7XG4gIHB1YmxpYyByZWFkb25seSBjZXJ0aWZpY2F0ZUFybjogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDZXJ0aWZpY2F0ZUNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IHsgZG9tYWluTmFtZSwgaG9zdGVkWm9uZUlkLCBob3N0ZWRab25lTmFtZSB9ID0gcHJvcHM7XG5cbiAgICAvLyBETlPmpJzoqLzjga7oqK3lrppcbiAgICBsZXQgdmFsaWRhdGlvbjogYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbjtcbiAgICBcbiAgICBpZiAoaG9zdGVkWm9uZUlkICYmIGhvc3RlZFpvbmVOYW1lKSB7XG4gICAgICAvLyBSb3V0ZTUz44KS5L2/55So44GX44Gf6Ieq5YuVRE5T5qSc6Ki8XG4gICAgICBjb25zdCBob3N0ZWRab25lID0gcm91dGU1My5Ib3N0ZWRab25lLmZyb21Ib3N0ZWRab25lQXR0cmlidXRlcyh0aGlzLCAnSG9zdGVkWm9uZScsIHtcbiAgICAgICAgaG9zdGVkWm9uZUlkLFxuICAgICAgICB6b25lTmFtZTogaG9zdGVkWm9uZU5hbWUsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgdmFsaWRhdGlvbiA9IGFjbS5DZXJ0aWZpY2F0ZVZhbGlkYXRpb24uZnJvbURucyhob3N0ZWRab25lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8g5omL5YuVRE5T5qSc6Ki8XG4gICAgICB2YWxpZGF0aW9uID0gYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKCk7XG4gICAgfVxuXG4gICAgLy8g6Ki85piO5pu444Gu5L2c5oiQXG4gICAgdGhpcy5jZXJ0aWZpY2F0ZSA9IG5ldyBhY20uQ2VydGlmaWNhdGUodGhpcywgJ0NlcnRpZmljYXRlJywge1xuICAgICAgZG9tYWluTmFtZTogZG9tYWluTmFtZSxcbiAgICAgIHZhbGlkYXRpb24sXG4gICAgfSk7XG5cbiAgICB0aGlzLmNlcnRpZmljYXRlQXJuID0gdGhpcy5jZXJ0aWZpY2F0ZS5jZXJ0aWZpY2F0ZUFybjtcblxuICAgIC8vIEROU+aknOiovOaDheWgseOCkuWHuuWKm+OBqOOBl+OBpui/veWKoFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWYWxpZGF0aW9uRG9tYWluJywge1xuICAgICAgdmFsdWU6IGRvbWFpbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RvbWFpbiBiZWluZyB2YWxpZGF0ZWQnLFxuICAgIH0pO1xuXG4gICAgLy8g44Kr44K544K/44Og44Oq44K944O844K544GnRE5T5qSc6Ki844Os44Kz44O844OJ44KS6KGo56S6XG4gICAgY29uc3Qgc2hvd1ZhbGlkYXRpb25SZWNvcmRzID0gbmV3IGNkay5DdXN0b21SZXNvdXJjZSh0aGlzLCAnU2hvd1ZhbGlkYXRpb25SZWNvcmRzJywge1xuICAgICAgc2VydmljZVRva2VuOiBjZGsuQ3VzdG9tUmVzb3VyY2VQcm92aWRlci5nZXRPckNyZWF0ZSh0aGlzLCAnQ3VzdG9tOjpTaG93RG5zVmFsaWRhdGlvbicsIHtcbiAgICAgICAgY29kZURpcmVjdG9yeTogYCR7X19kaXJuYW1lfS8uLi9zY3JpcHRzYCxcbiAgICAgICAgcnVudGltZTogY2RrLkN1c3RvbVJlc291cmNlUHJvdmlkZXJSdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgICBwb2xpY3lTdGF0ZW1lbnRzOiBbe1xuICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICBBY3Rpb246IFsnYWNtOkRlc2NyaWJlQ2VydGlmaWNhdGUnXSxcbiAgICAgICAgICBSZXNvdXJjZTogdGhpcy5jZXJ0aWZpY2F0ZS5jZXJ0aWZpY2F0ZUFybixcbiAgICAgICAgfV0sXG4gICAgICB9KSxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgQ2VydGlmaWNhdGVBcm46IHRoaXMuY2VydGlmaWNhdGUuY2VydGlmaWNhdGVBcm4sXG4gICAgICAgIFJlZ2lvbjogY2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBzaG93VmFsaWRhdGlvblJlY29yZHMubm9kZS5hZGREZXBlbmRlbmN5KHRoaXMuY2VydGlmaWNhdGUpO1xuICB9XG59Il19
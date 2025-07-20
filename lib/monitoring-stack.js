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
exports.MonitoringStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const snsSubscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const constructs_1 = require("constructs");
class MonitoringStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const { certificateArns, notificationEmail } = props;
        // SNSトピックの作成
        const alertTopic = new sns.Topic(this, 'CertificateAlertTopic', {
            topicName: 'acm-certificate-alerts',
            displayName: 'ACM Certificate Alerts',
        });
        // メール通知の追加
        alertTopic.addSubscription(new snsSubscriptions.EmailSubscription(notificationEmail));
        // 証明書チェック用Lambda関数
        const certificateChecker = new lambda.Function(this, 'CertificateChecker', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const acm = new AWS.ACM();
        const sns = new AWS.SNS();
        
        exports.handler = async (event) => {
          const certificateArns = ${JSON.stringify(certificateArns)};
          const snsTopicArn = '${alertTopic.topicArn}';
          
          for (const arn of certificateArns) {
            try {
              const response = await acm.describeCertificate({ CertificateArn: arn }).promise();
              const certificate = response.Certificate;
              
              if (!certificate) continue;
              
              // 証明書の有効期限をチェック
              const expiryDate = new Date(certificate.NotAfter);
              const now = new Date();
              const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
              
              // アラート条件
              const alertThresholds = [30, 14, 7, 3, 1];
              
              for (const threshold of alertThresholds) {
                if (daysUntilExpiry === threshold) {
                  const message = {
                    Subject: \`[警告] ACM証明書が\${threshold}日後に期限切れになります\`,
                    Message: \`
証明書の期限切れが近づいています。

証明書ARN: \${arn}
ドメイン: \${certificate.DomainName}
現在の状態: \${certificate.Status}
有効期限: \${expiryDate.toISOString()}
残り日数: \${daysUntilExpiry}日

証明書は自動的に更新されますが、DNS検証レコードが正しく設定されていることを確認してください。
                    \`,
                    TopicArn: snsTopicArn
                  };
                  
                  await sns.publish(message).promise();
                }
              }
              
              // 証明書の状態が異常な場合
              if (certificate.Status !== 'ISSUED' && certificate.Status !== 'PENDING_VALIDATION') {
                const message = {
                  Subject: '[エラー] ACM証明書の状態に問題があります',
                  Message: \`
証明書の状態に問題が検出されました。

証明書ARN: \${arn}
ドメイン: \${certificate.DomainName}
現在の状態: \${certificate.Status}
失敗理由: \${certificate.FailureReason || 'N/A'}

すぐに確認が必要です。
                  \`,
                  TopicArn: snsTopicArn
                };
                
                await sns.publish(message).promise();
              }
              
              // 検証の問題をチェック
              if (certificate.DomainValidationOptions) {
                for (const validation of certificate.DomainValidationOptions) {
                  if (validation.ValidationStatus === 'FAILED') {
                    const message = {
                      Subject: '[エラー] ACM証明書の検証に失敗しました',
                      Message: \`
証明書の検証に失敗しました。

証明書ARN: \${arn}
ドメイン: \${validation.DomainName}
検証状態: \${validation.ValidationStatus}

DNS検証レコードを確認してください。
                      \`,
                      TopicArn: snsTopicArn
                    };
                    
                    await sns.publish(message).promise();
                  }
                }
              }
            } catch (error) {
              console.error('Error checking certificate:', arn, error);
            }
          }
          
          return { statusCode: 200, body: 'Certificate check completed' };
        };
      `),
            timeout: cdk.Duration.minutes(5),
            memorySize: 256,
            environment: {
                NODE_OPTIONS: '--enable-source-maps',
            },
        });
        // Lambda関数にACMとSNSの権限を付与
        certificateChecker.addToRolePolicy(new iam.PolicyStatement({
            actions: ['acm:DescribeCertificate'],
            resources: certificateArns,
        }));
        certificateChecker.addToRolePolicy(new iam.PolicyStatement({
            actions: ['sns:Publish'],
            resources: [alertTopic.topicArn],
        }));
        // EventBridgeルール - 毎日チェック
        const dailyRule = new events.Rule(this, 'DailyCertificateCheck', {
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '9', // 日本時間 18:00
            }),
            description: 'Daily ACM certificate expiry check',
        });
        dailyRule.addTarget(new targets.LambdaFunction(certificateChecker));
        // CloudWatchダッシュボード
        const dashboard = new cloudwatch.Dashboard(this, 'CertificateDashboard', {
            dashboardName: 'acm-certificates',
        });
        // Lambda関数のメトリクスウィジェット
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Certificate Checker Executions',
            left: [certificateChecker.metricInvocations()],
            right: [certificateChecker.metricErrors()],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: 'Certificate Checker Duration',
            left: [certificateChecker.metricDuration()],
            width: 12,
        }));
        // タグ付け（リソースに直接適用）
        cdk.Tags.of(alertTopic).add('Service', 'ACM-Monitoring');
        cdk.Tags.of(alertTopic).add('ManagedBy', 'CDK');
    }
}
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCx5REFBMkM7QUFDM0Msb0ZBQXNFO0FBQ3RFLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MsK0RBQWlEO0FBQ2pELHdFQUEwRDtBQUMxRCwyQ0FBdUM7QUFPdkMsTUFBYSxlQUFnQixTQUFRLHNCQUFTO0lBQzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMkI7UUFDbkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXJELGFBQWE7UUFDYixNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQzlELFNBQVMsRUFBRSx3QkFBd0I7WUFDbkMsV0FBVyxFQUFFLHdCQUF3QjtTQUN0QyxDQUFDLENBQUM7UUFFSCxXQUFXO1FBQ1gsVUFBVSxDQUFDLGVBQWUsQ0FDeEIsSUFBSSxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUMxRCxDQUFDO1FBRUYsbUJBQW1CO1FBQ25CLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUN6RSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzs7Ozs7O29DQU1DLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDO2lDQUNsQyxVQUFVLENBQUMsUUFBUTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQXdGN0MsQ0FBQztZQUNGLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDaEMsVUFBVSxFQUFFLEdBQUc7WUFDZixXQUFXLEVBQUU7Z0JBQ1gsWUFBWSxFQUFFLHNCQUFzQjthQUNyQztTQUNGLENBQUMsQ0FBQztRQUVILHlCQUF5QjtRQUN6QixrQkFBa0IsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3pELE9BQU8sRUFBRSxDQUFDLHlCQUF5QixDQUFDO1lBQ3BDLFNBQVMsRUFBRSxlQUFlO1NBQzNCLENBQUMsQ0FBQyxDQUFDO1FBRUosa0JBQWtCLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN6RCxPQUFPLEVBQUUsQ0FBQyxhQUFhLENBQUM7WUFDeEIsU0FBUyxFQUFFLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQztTQUNqQyxDQUFDLENBQUMsQ0FBQztRQUVKLDBCQUEwQjtRQUMxQixNQUFNLFNBQVMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9ELFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztnQkFDN0IsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEdBQUcsRUFBRSxhQUFhO2FBQ3pCLENBQUM7WUFDRixXQUFXLEVBQUUsb0NBQW9DO1NBQ2xELENBQUMsQ0FBQztRQUVILFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztRQUVwRSxvQkFBb0I7UUFDcEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUN2RSxhQUFhLEVBQUUsa0JBQWtCO1NBQ2xDLENBQUMsQ0FBQztRQUVILHVCQUF1QjtRQUN2QixTQUFTLENBQUMsVUFBVSxDQUNsQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLGdDQUFnQztZQUN2QyxJQUFJLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzlDLEtBQUssRUFBRSxDQUFDLGtCQUFrQixDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzFDLEtBQUssRUFBRSxFQUFFO1NBQ1YsQ0FBQyxFQUNGLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUN6QixLQUFLLEVBQUUsOEJBQThCO1lBQ3JDLElBQUksRUFBRSxDQUFDLGtCQUFrQixDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQzNDLEtBQUssRUFBRSxFQUFFO1NBQ1YsQ0FBQyxDQUNILENBQUM7UUFFRixrQkFBa0I7UUFDbEIsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3pELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBMUtELDBDQTBLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHNuc1N1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1vbml0b3JpbmdTdGFja1Byb3BzIHtcbiAgY2VydGlmaWNhdGVBcm5zOiBzdHJpbmdbXTtcbiAgbm90aWZpY2F0aW9uRW1haWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1vbml0b3JpbmdTdGFjayBleHRlbmRzIENvbnN0cnVjdCB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBNb25pdG9yaW5nU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCB7IGNlcnRpZmljYXRlQXJucywgbm90aWZpY2F0aW9uRW1haWwgfSA9IHByb3BzO1xuXG4gICAgLy8gU05T44OI44OU44OD44Kv44Gu5L2c5oiQXG4gICAgY29uc3QgYWxlcnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0NlcnRpZmljYXRlQWxlcnRUb3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogJ2FjbS1jZXJ0aWZpY2F0ZS1hbGVydHMnLFxuICAgICAgZGlzcGxheU5hbWU6ICdBQ00gQ2VydGlmaWNhdGUgQWxlcnRzJyxcbiAgICB9KTtcblxuICAgIC8vIOODoeODvOODq+mAmuefpeOBrui/veWKoFxuICAgIGFsZXJ0VG9waWMuYWRkU3Vic2NyaXB0aW9uKFxuICAgICAgbmV3IHNuc1N1YnNjcmlwdGlvbnMuRW1haWxTdWJzY3JpcHRpb24obm90aWZpY2F0aW9uRW1haWwpXG4gICAgKTtcblxuICAgIC8vIOiovOaYjuabuOODgeOCp+ODg+OCr+eUqExhbWJkYemWouaVsFxuICAgIGNvbnN0IGNlcnRpZmljYXRlQ2hlY2tlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NlcnRpZmljYXRlQ2hlY2tlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IEFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbiAgICAgICAgY29uc3QgYWNtID0gbmV3IEFXUy5BQ00oKTtcbiAgICAgICAgY29uc3Qgc25zID0gbmV3IEFXUy5TTlMoKTtcbiAgICAgICAgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNlcnRpZmljYXRlQXJucyA9ICR7SlNPTi5zdHJpbmdpZnkoY2VydGlmaWNhdGVBcm5zKX07XG4gICAgICAgICAgY29uc3Qgc25zVG9waWNBcm4gPSAnJHthbGVydFRvcGljLnRvcGljQXJufSc7XG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChjb25zdCBhcm4gb2YgY2VydGlmaWNhdGVBcm5zKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGFjbS5kZXNjcmliZUNlcnRpZmljYXRlKHsgQ2VydGlmaWNhdGVBcm46IGFybiB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgIGNvbnN0IGNlcnRpZmljYXRlID0gcmVzcG9uc2UuQ2VydGlmaWNhdGU7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBpZiAoIWNlcnRpZmljYXRlKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIOiovOaYjuabuOOBruacieWKueacn+mZkOOCkuODgeOCp+ODg+OCr1xuICAgICAgICAgICAgICBjb25zdCBleHBpcnlEYXRlID0gbmV3IERhdGUoY2VydGlmaWNhdGUuTm90QWZ0ZXIpO1xuICAgICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICBjb25zdCBkYXlzVW50aWxFeHBpcnkgPSBNYXRoLmZsb29yKChleHBpcnlEYXRlIC0gbm93KSAvICgxMDAwICogNjAgKiA2MCAqIDI0KSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyDjgqLjg6njg7zjg4jmnaHku7ZcbiAgICAgICAgICAgICAgY29uc3QgYWxlcnRUaHJlc2hvbGRzID0gWzMwLCAxNCwgNywgMywgMV07XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHRocmVzaG9sZCBvZiBhbGVydFRocmVzaG9sZHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGF5c1VudGlsRXhwaXJ5ID09PSB0aHJlc2hvbGQpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICAgICAgICAgIFN1YmplY3Q6IFxcYFvorablkYpdIEFDTeiovOaYjuabuOOBjFxcJHt0aHJlc2hvbGR95pel5b6M44Gr5pyf6ZmQ5YiH44KM44Gr44Gq44KK44G+44GZXFxgLFxuICAgICAgICAgICAgICAgICAgICBNZXNzYWdlOiBcXGBcbuiovOaYjuabuOOBruacn+mZkOWIh+OCjOOBjOi/keOBpeOBhOOBpuOBhOOBvuOBmeOAglxuXG7oqLzmmI7mm7hBUk46IFxcJHthcm59XG7jg4njg6HjgqTjg7M6IFxcJHtjZXJ0aWZpY2F0ZS5Eb21haW5OYW1lfVxu54++5Zyo44Gu54q25oWLOiBcXCR7Y2VydGlmaWNhdGUuU3RhdHVzfVxu5pyJ5Yq55pyf6ZmQOiBcXCR7ZXhwaXJ5RGF0ZS50b0lTT1N0cmluZygpfVxu5q6L44KK5pel5pWwOiBcXCR7ZGF5c1VudGlsRXhwaXJ5feaXpVxuXG7oqLzmmI7mm7jjga/oh6rli5XnmoTjgavmm7TmlrDjgZXjgozjgb7jgZnjgYzjgIFETlPmpJzoqLzjg6zjgrPjg7zjg4njgYzmraPjgZfjgY/oqK3lrprjgZXjgozjgabjgYTjgovjgZPjgajjgpLnorroqo3jgZfjgabjgY/jgaDjgZXjgYTjgIJcbiAgICAgICAgICAgICAgICAgICAgXFxgLFxuICAgICAgICAgICAgICAgICAgICBUb3BpY0Fybjogc25zVG9waWNBcm5cbiAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgIGF3YWl0IHNucy5wdWJsaXNoKG1lc3NhZ2UpLnByb21pc2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIOiovOaYjuabuOOBrueKtuaFi+OBjOeVsOW4uOOBquWgtOWQiFxuICAgICAgICAgICAgICBpZiAoY2VydGlmaWNhdGUuU3RhdHVzICE9PSAnSVNTVUVEJyAmJiBjZXJ0aWZpY2F0ZS5TdGF0dXMgIT09ICdQRU5ESU5HX1ZBTElEQVRJT04nKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IHtcbiAgICAgICAgICAgICAgICAgIFN1YmplY3Q6ICdb44Ko44Op44O8XSBBQ03oqLzmmI7mm7jjga7nirbmhYvjgavllY/poYzjgYzjgYLjgorjgb7jgZknLFxuICAgICAgICAgICAgICAgICAgTWVzc2FnZTogXFxgXG7oqLzmmI7mm7jjga7nirbmhYvjgavllY/poYzjgYzmpJzlh7rjgZXjgozjgb7jgZfjgZ/jgIJcblxu6Ki85piO5pu4QVJOOiBcXCR7YXJufVxu44OJ44Oh44Kk44OzOiBcXCR7Y2VydGlmaWNhdGUuRG9tYWluTmFtZX1cbuePvuWcqOOBrueKtuaFizogXFwke2NlcnRpZmljYXRlLlN0YXR1c31cbuWkseaVl+eQhueUsTogXFwke2NlcnRpZmljYXRlLkZhaWx1cmVSZWFzb24gfHwgJ04vQSd9XG5cbuOBmeOBkOOBq+eiuuiqjeOBjOW/heimgeOBp+OBmeOAglxuICAgICAgICAgICAgICAgICAgXFxgLFxuICAgICAgICAgICAgICAgICAgVG9waWNBcm46IHNuc1RvcGljQXJuXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBhd2FpdCBzbnMucHVibGlzaChtZXNzYWdlKS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIOaknOiovOOBruWVj+mhjOOCkuODgeOCp+ODg+OCr1xuICAgICAgICAgICAgICBpZiAoY2VydGlmaWNhdGUuRG9tYWluVmFsaWRhdGlvbk9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHZhbGlkYXRpb24gb2YgY2VydGlmaWNhdGUuRG9tYWluVmFsaWRhdGlvbk9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgIGlmICh2YWxpZGF0aW9uLlZhbGlkYXRpb25TdGF0dXMgPT09ICdGQUlMRUQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgU3ViamVjdDogJ1vjgqjjg6njg7xdIEFDTeiovOaYjuabuOOBruaknOiovOOBq+WkseaVl+OBl+OBvuOBl+OBnycsXG4gICAgICAgICAgICAgICAgICAgICAgTWVzc2FnZTogXFxgXG7oqLzmmI7mm7jjga7mpJzoqLzjgavlpLHmlZfjgZfjgb7jgZfjgZ/jgIJcblxu6Ki85piO5pu4QVJOOiBcXCR7YXJufVxu44OJ44Oh44Kk44OzOiBcXCR7dmFsaWRhdGlvbi5Eb21haW5OYW1lfVxu5qSc6Ki854q25oWLOiBcXCR7dmFsaWRhdGlvbi5WYWxpZGF0aW9uU3RhdHVzfVxuXG5ETlPmpJzoqLzjg6zjgrPjg7zjg4njgpLnorroqo3jgZfjgabjgY/jgaDjgZXjgYTjgIJcbiAgICAgICAgICAgICAgICAgICAgICBcXGAsXG4gICAgICAgICAgICAgICAgICAgICAgVG9waWNBcm46IHNuc1RvcGljQXJuXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBzbnMucHVibGlzaChtZXNzYWdlKS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjaGVja2luZyBjZXJ0aWZpY2F0ZTonLCBhcm4sIGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHsgc3RhdHVzQ29kZTogMjAwLCBib2R5OiAnQ2VydGlmaWNhdGUgY2hlY2sgY29tcGxldGVkJyB9O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE5PREVfT1BUSU9OUzogJy0tZW5hYmxlLXNvdXJjZS1tYXBzJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGHplqLmlbDjgatBQ03jgahTTlPjga7mqKnpmZDjgpLku5jkuI5cbiAgICBjZXJ0aWZpY2F0ZUNoZWNrZXIuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnYWNtOkRlc2NyaWJlQ2VydGlmaWNhdGUnXSxcbiAgICAgIHJlc291cmNlczogY2VydGlmaWNhdGVBcm5zLFxuICAgIH0pKTtcblxuICAgIGNlcnRpZmljYXRlQ2hlY2tlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydzbnM6UHVibGlzaCddLFxuICAgICAgcmVzb3VyY2VzOiBbYWxlcnRUb3BpYy50b3BpY0Fybl0sXG4gICAgfSkpO1xuXG4gICAgLy8gRXZlbnRCcmlkZ2Xjg6vjg7zjg6sgLSDmr47ml6Xjg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBkYWlseVJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0RhaWx5Q2VydGlmaWNhdGVDaGVjaycsIHtcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnOScsIC8vIOaXpeacrOaZgumWkyAxODowMFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogJ0RhaWx5IEFDTSBjZXJ0aWZpY2F0ZSBleHBpcnkgY2hlY2snLFxuICAgIH0pO1xuXG4gICAgZGFpbHlSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihjZXJ0aWZpY2F0ZUNoZWNrZXIpKTtcblxuICAgIC8vIENsb3VkV2F0Y2jjg4Djg4Pjgrfjg6Xjg5zjg7zjg4lcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0NlcnRpZmljYXRlRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ2FjbS1jZXJ0aWZpY2F0ZXMnLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRh6Zai5pWw44Gu44Oh44OI44Oq44Kv44K544Km44Kj44K444Kn44OD44OIXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQ2VydGlmaWNhdGUgQ2hlY2tlciBFeGVjdXRpb25zJyxcbiAgICAgICAgbGVmdDogW2NlcnRpZmljYXRlQ2hlY2tlci5tZXRyaWNJbnZvY2F0aW9ucygpXSxcbiAgICAgICAgcmlnaHQ6IFtjZXJ0aWZpY2F0ZUNoZWNrZXIubWV0cmljRXJyb3JzKCldLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdDZXJ0aWZpY2F0ZSBDaGVja2VyIER1cmF0aW9uJyxcbiAgICAgICAgbGVmdDogW2NlcnRpZmljYXRlQ2hlY2tlci5tZXRyaWNEdXJhdGlvbigpXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8g44K/44Kw5LuY44GR77yI44Oq44K944O844K544Gr55u05o6l6YGp55So77yJXG4gICAgY2RrLlRhZ3Mub2YoYWxlcnRUb3BpYykuYWRkKCdTZXJ2aWNlJywgJ0FDTS1Nb25pdG9yaW5nJyk7XG4gICAgY2RrLlRhZ3Mub2YoYWxlcnRUb3BpYykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gIH1cbn0iXX0=
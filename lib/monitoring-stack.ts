import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  certificateArns: string[];
  notificationEmail: string;
  environment: 'dev' | 'stg' | 'prd';
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { certificateArns, notificationEmail, environment } = props;

    // SNSトピックの作成
    const alertTopic = new sns.Topic(this, 'CertificateAlertTopic', {
      topicName: `acm-certificate-alerts-${environment}`,
      displayName: 'ACM Certificate Alerts',
    });

    // メール通知の追加
    alertTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(notificationEmail)
    );

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
      dashboardName: `acm-certificates-${environment}`,
    });

    // Lambda関数のメトリクスウィジェット
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Certificate Checker Executions',
        left: [certificateChecker.metricInvocations()],
        right: [certificateChecker.metricErrors()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Certificate Checker Duration',
        left: [certificateChecker.metricDuration()],
        width: 12,
      })
    );

    // 出力
    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'SNS Topic ARN for certificate alerts',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    // タグ付け
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Service', 'ACM-Monitoring');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
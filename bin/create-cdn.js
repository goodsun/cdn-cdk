#!/usr/bin/env node

const fs = require("fs-extra");
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");
const inquirer = require("inquirer");
const packageJson = require("../package.json");

// Handle --version and --help flags
if (process.argv[2] === "--version" || process.argv[2] === "-v") {
  console.log(packageJson.version);
  process.exit(0);
}

if (process.argv[2] === "--help" || process.argv[2] === "-h") {
  console.log(`
${chalk.blue.bold("create-cdn")} - AWS CDKでCDNを簡単に構築

${chalk.yellow("使用方法:")}
  create-cdn <プロジェクト名>
  create-cdn --list
  create-cdn --version
  create-cdn --help

${chalk.yellow("オプション:")}
  -l, --list     デプロイ済みCDNスタックの一覧と削除コマンドを表示
  -v, --version  バージョンを表示
  -h, --help     ヘルプを表示

${chalk.yellow("クイックスタート:")}
  ${chalk.gray("# 1. プロジェクトを作成")}
  ${chalk.cyan("npx @goodsun/create-cdn my-website")}
  ${chalk.gray("# または")}
  ${chalk.cyan("npm install -g @goodsun/create-cdn")}
  ${chalk.cyan("create-cdn my-website")}

  ${chalk.gray("# 2. プロジェクトディレクトリに移動")}
  ${chalk.cyan("cd my-website")}

  ${chalk.gray("# 3. 環境変数を設定")}
  ${chalk.cyan("vi .env")}

  ${chalk.gray("# 4. 依存関係をインストール")}
  ${chalk.cyan("npm install")}

  ${chalk.gray("# 5. AWSにデプロイ")}
  ${chalk.cyan("npm run deploy")}

  ${chalk.gray("# 6. リソースを削除する場合")}
  ${chalk.cyan("npm run destroy")}

${chalk.yellow("前提条件:")}
  • Node.js 18以上
  • AWS CLI設定済み（aws configure）
  • 有効なドメイン名

${chalk.yellow("詳細情報:")}
  https://github.com/goodsun/create-cdn
  https://www.npmjs.com/package/@goodsun/create-cdn
`);
  process.exit(0);
}

// Handle --list flag
if (process.argv[2] === "--list" || process.argv[2] === "-l") {
  listCdnStacks();
  process.exit(0);
}

async function listCdnStacks() {
  console.log(chalk.blue.bold("\n🌐 create-cdn で作成されたCDNスタック一覧\n"));

  const regions = [
    "us-east-1",
    "ap-northeast-1",
    "ap-northeast-2",
    "ap-southeast-1",
    "ap-southeast-2",
    "eu-west-1",
    "eu-central-1",
    "us-west-1",
    "us-west-2",
  ];

  let totalStacks = 0;
  const allStacks = [];

  // 各リージョンでCdnStackを検索
  for (const region of regions) {
    try {
      const cmd = `aws cloudformation list-stacks --region ${region} --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE --query "StackSummaries[?contains(StackName, 'CdnStack')].{StackName:StackName,Status:StackStatus,CreationTime:CreationTime,LastUpdatedTime:LastUpdatedTime}" --output json 2>/dev/null`;
      const result = execSync(cmd, { encoding: "utf8" });
      const stacks = JSON.parse(result) || [];

      if (stacks.length > 0) {
        for (const stack of stacks) {
          // スタックの詳細情報を取得
          try {
            const detailCmd = `aws cloudformation describe-stacks --stack-name ${stack.StackName} --region ${region} --query "Stacks[0].{Outputs:Outputs,Parameters:Parameters,Tags:Tags,Description:Description}" --output json 2>/dev/null`;
            const detailResult = execSync(detailCmd, { encoding: "utf8" });
            const details = JSON.parse(detailResult);

            // ドメイン名を抽出
            let domainName = "Unknown";
            let hasCloudFront = false;
            let distributionDomain = null;
            let certificateArn = null;

            // Outputsから情報取得
            if (details.Outputs) {
              const domainOutput = details.Outputs.find(
                (o) => o.OutputKey === "DomainName"
              );
              const distOutput = details.Outputs.find(
                (o) => o.OutputKey === "DistributionDomain"
              );
              const certOutput = details.Outputs.find(
                (o) => o.OutputKey === "CertificateArn"
              );

              if (domainOutput) domainName = domainOutput.OutputValue;
              if (distOutput) {
                hasCloudFront = true;
                distributionDomain = distOutput.OutputValue;
              }
              if (certOutput) certificateArn = certOutput.OutputValue;
            }

            // スタックの説明文から抽出（例: "CDN stack for example.com"）
            if (domainName === "Unknown" && details.Description) {
              const match = details.Description.match(/CDN stack for (.+)$/);
              if (match) domainName = match[1];
            }

            // Tagsから情報取得
            if (domainName === "Unknown" && details.Tags) {
              const domainTag = details.Tags.find(
                (t) => t.Key === "Domain" || t.Key === "DomainName"
              );
              if (domainTag) domainName = domainTag.Value;
            }

            // Parametersから情報取得（最後の手段）
            if (domainName === "Unknown" && details.Parameters) {
              const domainParam = details.Parameters.find(
                (p) =>
                  p.ParameterKey === "domain" || p.ParameterKey === "DomainName"
              );
              if (domainParam) domainName = domainParam.ParameterValue;
            }

            // 証明書のドメインから推測
            if (domainName === "Unknown" && certificateArn) {
              try {
                // 証明書のリージョンをARNから抽出
                const arnParts = certificateArn.split(":");
                const certRegion = arnParts[3] || region;

                const certCmd = `aws acm describe-certificate --certificate-arn ${certificateArn} --region ${certRegion} --query "Certificate.DomainName" --output text 2>/dev/null`;
                const certDomain = execSync(certCmd, {
                  encoding: "utf8",
                }).trim();
                if (certDomain && certDomain !== "None") {
                  domainName = certDomain;
                }
              } catch (e) {
                // 証明書情報取得エラーは無視
              }
            }

            // Route 53のホストゾーンIDを取得
            let hostedZoneId = null;
            if (domainName && domainName !== "Unknown" && !domainName.startsWith("*.")) {
              try {
                // ドメインから親ドメインを抽出（例: test.example.com -> example.com）
                const domainParts = domainName.split(".");
                let searchDomain = domainName;
                
                // 複数のレベルで検索（test.sub.example.com -> sub.example.com -> example.com）
                for (let i = 0; i < domainParts.length - 1; i++) {
                  searchDomain = domainParts.slice(i).join(".");
                  
                  const zoneCmd = `aws route53 list-hosted-zones-by-name --query "HostedZones[?Name==\\\`${searchDomain}.\\\`].Id" --output json 2>/dev/null`;
                  const zoneResult = execSync(zoneCmd, { encoding: "utf8" });
                  const zones = JSON.parse(zoneResult);
                  
                  if (zones && zones.length > 0) {
                    hostedZoneId = zones[0].split("/").pop();
                    break;
                  }
                }
              } catch (e) {
                // Zone ID取得エラーは無視
              }
            }

            allStacks.push({
              stackName: stack.StackName,
              region: region,
              status: stack.Status,
              creationTime: new Date(stack.CreationTime),
              lastUpdatedTime: stack.LastUpdatedTime
                ? new Date(stack.LastUpdatedTime)
                : null,
              domainName: domainName,
              hasCloudFront: hasCloudFront,
              distributionDomain: distributionDomain,
              certificateArn: certificateArn,
              hostedZoneId: hostedZoneId,
            });
          } catch (e) {
            // 詳細取得エラーは無視
            allStacks.push({
              stackName: stack.StackName,
              region: region,
              status: stack.Status,
              creationTime: new Date(stack.CreationTime),
              lastUpdatedTime: stack.LastUpdatedTime
                ? new Date(stack.LastUpdatedTime)
                : null,
              domainName: "Unknown",
              hasCloudFront: false,
            });
          }
        }
      }
    } catch (error) {
      // リージョンエラーは無視
      continue;
    }
  }

  if (allStacks.length === 0) {
    console.log(chalk.yellow("CDNスタックが見つかりませんでした。"));
    console.log(
      chalk.gray(
        "\nヒント: create-cdn コマンドで新しいCDNプロジェクトを作成できます。"
      )
    );
    return;
  }

  // リージョンでグループ化して表示
  const stacksByRegion = {};
  allStacks.forEach((stack) => {
    if (!stacksByRegion[stack.region]) {
      stacksByRegion[stack.region] = [];
    }
    stacksByRegion[stack.region].push(stack);
  });

  Object.keys(stacksByRegion)
    .sort()
    .forEach((region) => {
      console.log(chalk.yellow(`\n📍 リージョン: ${region}`));
      console.log(chalk.gray("─".repeat(80)));

      stacksByRegion[region].forEach((stack) => {
        const statusColor =
          stack.status === "CREATE_COMPLETE" ||
          stack.status === "UPDATE_COMPLETE"
            ? chalk.green(stack.status)
            : chalk.yellow(stack.status);

        console.log(
          chalk.white(`\n  スタック名: ${chalk.bold(stack.stackName)}`)
        );
        console.log(chalk.gray(`  ├─ ドメイン: ${stack.domainName}`));
        console.log(chalk.gray(`  ├─ ステータス: ${statusColor}`));
        console.log(
          chalk.gray(
            `  ├─ 作成日時: ${stack.creationTime.toLocaleString("ja-JP")}`
          )
        );

        if (stack.lastUpdatedTime) {
          console.log(
            chalk.gray(
              `  ├─ 最終更新: ${stack.lastUpdatedTime.toLocaleString("ja-JP")}`
            )
          );
        }

        if (stack.hasCloudFront) {
          console.log(chalk.gray(`  ├─ CloudFront: ✅ 有効`));
          if (stack.distributionDomain) {
            console.log(chalk.gray(`  │  └─ ${stack.distributionDomain}`));
            // CNAME情報を表示
            if (stack.domainName && !stack.domainName.startsWith("*.")) {
              const subdomain = stack.domainName.split(".")[0];
              console.log(
                chalk.cyan(
                  `  │  └─ DNS設定: cname ${subdomain} ${stack.distributionDomain}.`
                )
              );
            }
          }
        } else {
          console.log(chalk.gray(`  ├─ CloudFront: ❌ 無効（証明書のみ）`));
        }

        if (stack.certificateArn) {
          const certId = stack.certificateArn.split("/").pop();
          console.log(chalk.gray(`  ├─ 証明書: .../${certId}`));
        }

        // Route 53ホストゾーンIDを表示
        if (stack.hostedZoneId) {
          console.log(chalk.gray(`  ├─ 🌐 Route 53 ホストゾーン: ${stack.hostedZoneId}`));
        }

        // 削除コマンドを表示
        console.log(chalk.gray(`  ├─ 📋 削除コマンド:`));
        console.log(chalk.gray(`  │  └─ ${chalk.cyan(`aws cloudformation delete-stack --stack-name ${stack.stackName} --region ${region}`)}`));
        
        // Route 53レコード削除コマンド
        if (stack.hostedZoneId && stack.domainName && stack.hasCloudFront) {
          const recordName = stack.domainName.split('.')[0];
          console.log(chalk.gray(`  ├─ 🌐 Route 53レコード削除:`));
          console.log(chalk.gray(`  │  └─ ${chalk.cyan(`aws route53 list-resource-record-sets --hosted-zone-id ${stack.hostedZoneId} --query "ResourceRecordSets[?Name=='${stack.domainName}.']"`)}`));
        }
        
        // 証明書削除コマンドも表示
        if (stack.certificateArn) {
          console.log(chalk.gray(`  └─ 🔐 証明書削除コマンド:`));
          console.log(chalk.gray(`     └─ ${chalk.cyan(`aws acm delete-certificate --certificate-arn ${stack.certificateArn} --region ${region}`)}`));
        } else {
          console.log(chalk.gray(`  └─ `));
        }

        totalStacks++;
      });
    });

  console.log(chalk.gray("\n" + "─".repeat(80)));
  console.log(chalk.green(`\n合計: ${totalStacks} 個のCDNスタック\n`));

  console.log(chalk.cyan("💡 ヒント:"));
  console.log(
    chalk.gray(
      "  • スタックの詳細を確認: aws cloudformation describe-stacks --stack-name <スタック名> --region <リージョン>"
    )
  );
  console.log(
    chalk.gray(
      "  • スタックを削除: cd <プロジェクトディレクトリ> && npm run destroy"
    )
  );
  console.log(chalk.gray("  • 新しいCDNを作成: create-cdn <プロジェクト名>\n"));
}

async function main() {
  console.log(chalk.blue.bold("\n🚀 CDN CDKプロジェクトを作成\n"));

  // Get project name from command line
  const projectName = process.argv[2];

  if (!projectName) {
    console.log(chalk.red("使用方法: create-cdn <プロジェクト名>"));
    console.log(chalk.gray("例: create-cdn my-website"));
    process.exit(1);
  }

  // Validate project name
  if (!/^[a-z0-9-]+$/.test(projectName)) {
    console.log(
      chalk.red("プロジェクト名は小文字、数字、ハイフンのみ使用できます")
    );
    process.exit(1);
  }

  // Collect CDN configuration
  const config = await inquirer.prompt([
    {
      type: "input",
      name: "domain",
      message: "ドメイン名を入力してください:",
      default: "example.com",
      validate: (input) => {
        if (/^(\*\.)?[a-z0-9.-]+\.[a-z]{2,}$/.test(input)) return true;
        return "有効なドメイン名を入力してください（例: example.com, *.example.com）";
      },
    },
    {
      type: "confirm",
      name: "useCloudFront",
      message: "CloudFrontを使用しますか？",
      default: true,
      when: (answers) => !answers.domain.startsWith("*."),
    },
    {
      type: "list",
      name: "originType",
      message: "オリジン（配信元）を選択してください:",
      when: (answers) => answers.useCloudFront,
      choices: [
        { name: "新規S3バケット（OAC経由・推奨）", value: "s3-new" },
        {
          name: "新規S3バケット（静的ウェブサイトホスティング）",
          value: "s3-website-new",
        },
        { name: "既存のS3静的ウェブサイト", value: "s3-website-existing" },
        { name: "既存のS3バケット（OAC経由）", value: "s3-existing" },
        { name: "既存のWebサイト（HTTP/HTTPS）", value: "http" },
        { name: "Application Load Balancer (ALB)", value: "alb" },
        { name: "API Gateway", value: "apigateway" },
      ],
      default: "s3-new",
    },
    {
      type: "input",
      name: "originDomain",
      message: "オリジンのドメイン名を入力してください:",
      when: (answers) =>
        ["http", "alb", "apigateway", "s3-website-existing"].includes(
          answers.originType
        ),
      validate: (input) => {
        if (input && input.length > 0) return true;
        return "オリジンドメインは必須です";
      },
    },
    {
      type: "input",
      name: "originPath",
      message: "オリジンパスを入力してください（オプション）:",
      when: (answers) => ["http", "apigateway"].includes(answers.originType),
      default: "",
    },
    {
      type: "input",
      name: "bucketName",
      message: "S3バケット名を入力してください:",
      when: (answers) => answers.originType === "s3-existing",
      validate: (input) => {
        if (input && input.length > 0) return true;
        return "バケット名は必須です";
      },
    },
    {
      type: "confirm",
      name: "useMonitoring",
      message: "証明書の有効期限監視を設定しますか？",
      default: true,
    },
    {
      type: "input",
      name: "notificationEmail",
      message: "通知先メールアドレスを入力してください:",
      when: (answers) => answers.useMonitoring,
      validate: (input) => {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return true;
        return "有効なメールアドレスを入力してください";
      },
    },
  ]);

  // Check if wildcard certificate is selected
  const isWildcard = config.domain.startsWith("*.");
  if (isWildcard) {
    config.useCloudFront = false;
    console.log(chalk.yellow("\n⚠️  ワイルドカード証明書が選択されました"));
    console.log(
      chalk.gray("   証明書のみ作成されます。CloudFrontは作成されません。")
    );
    console.log(
      chalk.gray(
        "   CloudFrontを使用する場合は、具体的なドメイン名で再度実行してください。\n"
      )
    );
  }

  const templateDir = path.join(__dirname, "..", "template");
  const targetDir = path.join(process.cwd(), projectName);

  // Check if target directory already exists
  if (fs.existsSync(targetDir)) {
    console.log(chalk.red(`❌ ディレクトリ ${projectName} は既に存在します！`));
    process.exit(1);
  }

  console.log(chalk.yellow(`📁 プロジェクトを作成中: ${targetDir}...`));

  try {
    // Copy template files
    fs.copySync(templateDir, targetDir);

    // Update package.json with project name
    const packageJsonPath = path.join(targetDir, "package.json");
    const packageData = fs.readJsonSync(packageJsonPath);
    packageData.name = projectName;
    fs.writeJsonSync(packageJsonPath, packageData, { spaces: 2 });

    // Get current AWS account ID if available
    let awsAccountId = "123456789012"; // Default placeholder
    try {
      const accountId = execSync(
        "aws sts get-caller-identity --query Account --output text",
        {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"], // Suppress stderr
        }
      ).trim();
      if (accountId && /^\d{12}$/.test(accountId)) {
        awsAccountId = accountId;
      }
    } catch (e) {
      // AWS CLI not configured, use placeholder
    }

    // Create .env from .env.example
    const envExamplePath = path.join(targetDir, ".env.example");
    const envPath = path.join(targetDir, ".env");

    if (fs.existsSync(envExamplePath)) {
      let envContent = fs.readFileSync(envExamplePath, "utf8");

      // Update AWS Account IDs
      if (awsAccountId !== "123456789012") {
        envContent = envContent.replace(
          /CDK_DEFAULT_ACCOUNT=\d+/,
          `CDK_DEFAULT_ACCOUNT=${awsAccountId}`
        );
      }

      // Update domain
      envContent = envContent.replace(
        /DOMAIN_NAME=.*/,
        `DOMAIN_NAME=${config.domain}`
      );

      // Update CloudFront setting
      envContent = envContent.replace(
        /USE_CLOUDFRONT=.*/,
        `USE_CLOUDFRONT=${config.useCloudFront}`
      );

      // CloudFrontを使用する場合は自動的にus-east-1を設定
      if (config.useCloudFront) {
        envContent = envContent.replace(
          /CDK_DEFAULT_REGION=.*/,
          "CDK_DEFAULT_REGION=us-east-1"
        );
      }

      // Update origin settings
      if (config.originType && !isWildcard) {
        envContent = envContent.replace(
          /ORIGIN_TYPE=.*/,
          `ORIGIN_TYPE=${config.originType}`
        );
      } else if (isWildcard) {
        // For wildcard certificates, comment out ORIGIN_TYPE
        envContent = envContent.replace(
          /ORIGIN_TYPE=.*/,
          `# ORIGIN_TYPE=s3-new`
        );
      }

      if (config.originDomain) {
        envContent = envContent.replace(
          /# ORIGIN_DOMAIN=.*/,
          `ORIGIN_DOMAIN=${config.originDomain}`
        );
      } else if (config.bucketName) {
        envContent = envContent.replace(
          /# ORIGIN_DOMAIN=.*/,
          `ORIGIN_DOMAIN=${config.bucketName}`
        );
      }

      if (config.originPath) {
        envContent = envContent.replace(
          /# ORIGIN_PATH=.*/,
          `ORIGIN_PATH=${config.originPath}`
        );
      }

      // Update monitoring settings
      envContent = envContent.replace(
        /USE_MONITORING=.*/,
        `USE_MONITORING=${config.useMonitoring}`
      );

      if (config.notificationEmail) {
        envContent = envContent.replace(
          /NOTIFICATION_EMAIL=.*/,
          `NOTIFICATION_EMAIL=${config.notificationEmail}`
        );
      }

      fs.writeFileSync(envPath, envContent);
    }

    console.log(chalk.green("\n✅ プロジェクトの作成が完了しました！\n"));

    // Check if AWS account was detected
    if (awsAccountId !== "123456789012") {
      console.log(
        chalk.yellow(`📝 AWS アカウントIDを検出しました: ${awsAccountId}`)
      );
      console.log(chalk.gray("   .env ファイルに設定済みです\n"));
    } else {
      console.log(chalk.yellow("⚠️  AWS CLIが設定されていません"));
      console.log(
        chalk.gray(
          "   .env ファイルの CDK_DEFAULT_ACCOUNT をあなたのAWSアカウントIDに更新してください\n"
        )
      );
    }

    // Check for existing certificates
    if (config.useCloudFront || isWildcard) {
      const region = config.useCloudFront ? "us-east-1" : "ap-northeast-1";
      console.log(chalk.yellow(`🔍 既存の証明書を検索中...`));

      try {
        const {
          findAndRegisterCertificate,
        } = require("../scripts/find-and-register-cert.js");
        const foundCert = await findAndRegisterCertificate(
          config.domain,
          region
        );

        if (foundCert) {
          console.log(chalk.green(`\n✨ 既存の証明書が自動的に使用されます！`));
          console.log(chalk.gray(`   DNS検証の待ち時間をスキップできます。\n`));
        } else {
          console.log(chalk.yellow(`\n📋 新しい証明書が作成されます。`));
          console.log(chalk.gray(`   DNS検証に10-30分かかります。\n`));
        }
      } catch (e) {
        // エラーは無視（証明書検索は必須ではない）
      }
    }

    console.log(chalk.white("次のステップ:"));
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(
      chalk.cyan("  vi .env") + chalk.gray("  # 環境変数を確認・編集")
    );
    console.log(chalk.cyan("  npm install"));
    console.log(chalk.cyan("  npm run deploy"));

    console.log(chalk.white("\n📚 詳細なドキュメント:"));
    console.log(chalk.gray("  - README.md - プロジェクト概要"));
    console.log(chalk.gray("  - .env.example - 環境変数の説明\n"));

    console.log(chalk.yellow("⚠️  重要: DNS検証について"));
    console.log(chalk.gray("  証明書の作成にはDNS検証が必要です。"));
    console.log(
      chalk.gray(
        "  デプロイ時に表示されるCNAMEレコードをDNSに設定してください。"
      )
    );
    console.log(chalk.gray("  検証には5-30分程度かかります。\n"));
  } catch (error) {
    console.error(
      chalk.red("❌ プロジェクトの作成中にエラーが発生しました:"),
      error
    );
    process.exit(1);
  }
}

main().catch(console.error);

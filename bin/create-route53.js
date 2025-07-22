#!/usr/bin/env node

const AWS = require("aws-sdk");
const chalk = require("chalk");
const inquirer = require("inquirer");
const { Command } = require("commander");
const fs = require("fs-extra");
const path = require("path");

const route53 = new AWS.Route53();
const acm = new AWS.ACM({ region: "us-east-1" });

const program = new Command();

program
  .name("create-route53")
  .description("Route53 DNS設定ヘルパーツール - AWS Route53のDNS設定を自動化します")
  .version(require("../package.json").version)
  .option("-d, --domain <domain>", "ドメイン名（例: example.com）")
  .option("-c, --cert-arn <arn>", "ACM証明書のARNを指定してDNS検証レコードを自動設定")
  .option("--cloudfront <domain>", "CloudFrontディストリビューションドメイン（例: d1234567890.cloudfront.net）")
  .option("--subdomain <subdomain>", "サブドメイン（CloudFront設定時、例: www）")
  .option("-l, --list", "アカウント内のすべてのRoute53ホストゾーン一覧を表示")
  .option("--check <domain>", "指定ドメインの現在のDNSレコード設定状態を確認")
  .option("-y, --yes", "すべての確認プロンプトを自動的に承認（自動化用）")
  .addHelpText('after', `
使用例:
  $ create-route53 --list
    Route53に登録されているすべてのホストゾーンを一覧表示します

  $ create-route53 --check example.com
    example.comの現在のDNSレコード設定を確認します

  $ create-route53 --cert-arn arn:aws:acm:us-east-1:123456789012:certificate/xxx-xxx-xxx
    ACM証明書のDNS検証に必要なCNAMEレコードを自動的に設定します

  $ create-route53 --cloudfront d1234567890.cloudfront.net --domain www.example.com
    www.example.comをCloudFrontディストリビューションにエイリアスとして設定します

  $ create-route53
    対話形式のメニューを起動します

詳細なドキュメント:
  https://github.com/goodsun/create-cdn/blob/main/docs/route53-setup.md`)
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    console.log(chalk.blue("\n🌐 Route53 DNS設定ヘルパー\n"));

    if (options.list) {
      await listHostedZones();
      return;
    }

    if (options.check) {
      await checkDnsRecords(options.check);
      return;
    }

    if (options.certArn) {
      await setupCertificateDnsValidation(options.certArn);
      return;
    }

    if (options.cloudfront) {
      await setupCloudFrontAlias();
      return;
    }

    // 対話形式のメニュー
    await interactiveMenu();
  } catch (error) {
    console.error(chalk.red("\n❌ エラーが発生しました:"), error.message);
    process.exit(1);
  }
}

async function listHostedZones() {
  console.log(chalk.yellow("📋 Route53ホストゾーン一覧を取得中...\n"));

  try {
    const result = await route53.listHostedZones().promise();
    
    if (result.HostedZones.length === 0) {
      console.log(chalk.gray("ホストゾーンが見つかりませんでした。"));
      return;
    }

    console.log(chalk.white("ホストゾーン一覧:"));
    console.log(chalk.gray("─".repeat(80)));

    result.HostedZones.forEach((zone) => {
      console.log(chalk.white(`\nゾーン名: ${chalk.bold(zone.Name)}`));
      console.log(chalk.gray(`├─ ID: ${zone.Id.replace("/hostedzone/", "")}`));
      console.log(chalk.gray(`├─ レコード数: ${zone.ResourceRecordSetCount}`));
      console.log(chalk.gray(`├─ プライベート: ${zone.Config?.PrivateZone ? "はい" : "いいえ"}`));
      
      if (zone.Config?.Comment) {
        console.log(chalk.gray(`└─ コメント: ${zone.Config.Comment}`));
      }
    });
  } catch (error) {
    if (error.code === "AccessDenied") {
      console.error(chalk.red("❌ Route53へのアクセス権限がありません。"));
      console.log(chalk.gray("\nヒント: IAMポリシーでRoute53へのアクセスを許可してください。"));
    } else {
      throw error;
    }
  }
}

async function findHostedZone(domain) {
  console.log(chalk.yellow(`🔍 ${domain} のホストゾーンを検索中...`));

  const result = await route53.listHostedZones().promise();
  
  // 完全一致を優先、次に親ドメインを検索
  const candidates = [];
  
  for (const zone of result.HostedZones) {
    const zoneName = zone.Name.replace(/\.$/, "");
    
    if (domain === zoneName) {
      return zone; // 完全一致
    }
    
    if (domain.endsWith("." + zoneName)) {
      candidates.push(zone);
    }
  }

  if (candidates.length === 0) {
    throw new Error(`${domain} に対応するホストゾーンが見つかりませんでした。`);
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  // 複数の候補がある場合は選択
  const { selectedZone } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedZone",
      message: "複数のホストゾーンが見つかりました。使用するゾーンを選択してください:",
      choices: candidates.map((zone) => ({
        name: `${zone.Name} (${zone.Id.replace("/hostedzone/", "")})`,
        value: zone,
      })),
    },
  ]);

  return selectedZone;
}

async function setupCertificateDnsValidation(certArn) {
  console.log(chalk.yellow("\n🔐 証明書のDNS検証レコードを設定します...\n"));

  // リージョンを抽出
  const region = certArn.split(":")[3];
  const regionalAcm = new AWS.ACM({ region });

  // 証明書情報を取得
  const { Certificate } = await regionalAcm.describeCertificate({ CertificateArn: certArn }).promise();

  if (Certificate.Type !== "AMAZON_ISSUED") {
    throw new Error("AWS発行の証明書のみサポートされています。");
  }

  if (Certificate.Status === "ISSUED") {
    console.log(chalk.green("✅ この証明書は既に発行済みです。"));
    return;
  }

  // DNS検証レコードを取得
  const validationOptions = Certificate.DomainValidationOptions.filter(
    (opt) => opt.ValidationMethod === "DNS" && opt.ResourceRecord
  );

  if (validationOptions.length === 0) {
    throw new Error("DNS検証レコードが見つかりません。");
  }

  console.log(chalk.white("設定が必要なDNSレコード:"));
  console.log(chalk.gray("─".repeat(80)));

  for (const validation of validationOptions) {
    const domain = validation.DomainName;
    const record = validation.ResourceRecord;

    console.log(chalk.white(`\nドメイン: ${chalk.bold(domain)}`));
    console.log(chalk.gray(`├─ レコード名: ${record.Name}`));
    console.log(chalk.gray(`├─ レコードタイプ: ${record.Type}`));
    console.log(chalk.gray(`└─ レコード値: ${record.Value}`));

    try {
      const hostedZone = await findHostedZone(domain);
      const zoneId = hostedZone.Id.replace("/hostedzone/", "");

      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: `${hostedZone.Name} にDNS検証レコードを追加しますか？`,
            default: true,
          },
        ]);

        if (!confirm) {
          console.log(chalk.gray("スキップしました。"));
          continue;
        }
      }

      // DNSレコードを追加
      await route53
        .changeResourceRecordSets({
          HostedZoneId: zoneId,
          ChangeBatch: {
            Changes: [
              {
                Action: "UPSERT",
                ResourceRecordSet: {
                  Name: record.Name,
                  Type: record.Type,
                  TTL: 300,
                  ResourceRecords: [{ Value: record.Value }],
                },
              },
            ],
          },
        })
        .promise();

      console.log(chalk.green(`✅ DNS検証レコードを追加しました。`));
    } catch (error) {
      console.error(chalk.red(`❌ ${domain} の設定に失敗しました: ${error.message}`));
    }
  }

  console.log(chalk.yellow("\n⏳ DNS検証の完了を待機中..."));
  console.log(chalk.gray("通常5〜30分かかります。"));

  // 検証状態を監視
  await monitorCertificateValidation(regionalAcm, certArn);
}

async function monitorCertificateValidation(acmClient, certArn) {
  const maxWaitTime = 30 * 60 * 1000; // 30分
  const checkInterval = 30 * 1000; // 30秒
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const { Certificate } = await acmClient.describeCertificate({ CertificateArn: certArn }).promise();

    if (Certificate.Status === "ISSUED") {
      console.log(chalk.green("\n✅ 証明書が正常に発行されました！"));
      return;
    }

    if (Certificate.Status === "FAILED") {
      throw new Error("証明書の発行に失敗しました。");
    }

    // 各ドメインの検証状態を表示
    const pendingDomains = Certificate.DomainValidationOptions.filter(
      (opt) => opt.ValidationStatus !== "SUCCESS"
    );

    if (pendingDomains.length > 0) {
      console.log(chalk.gray(`\n検証待ち: ${pendingDomains.map((d) => d.DomainName).join(", ")}`));
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  console.log(chalk.yellow("\n⚠️  タイムアウト: 30分以内に検証が完了しませんでした。"));
  console.log(chalk.gray("DNS設定を確認してください。"));
}

async function setupCloudFrontAlias() {
  const domain = options.subdomain || options.domain;
  
  if (!domain) {
    throw new Error("--domain または --subdomain オプションが必要です。");
  }

  console.log(chalk.yellow(`\n☁️  CloudFrontエイリアスレコードを設定します...\n`));

  const hostedZone = await findHostedZone(domain);
  const zoneId = hostedZone.Id.replace("/hostedzone/", "");

  console.log(chalk.white("設定内容:"));
  console.log(chalk.gray(`├─ ドメイン: ${domain}`));
  console.log(chalk.gray(`├─ CloudFront: ${options.cloudfront}`));
  console.log(chalk.gray(`└─ ホストゾーン: ${hostedZone.Name}`));

  if (!options.yes) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "この設定でエイリアスレコードを作成しますか？",
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(chalk.gray("キャンセルしました。"));
      return;
    }
  }

  // エイリアスレコードを作成
  await route53
    .changeResourceRecordSets({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: domain,
              Type: "A",
              AliasTarget: {
                HostedZoneId: "Z2FDTNDATAQYW2", // CloudFront固定値
                DNSName: options.cloudfront,
                EvaluateTargetHealth: false,
              },
            },
          },
        ],
      },
    })
    .promise();

  console.log(chalk.green("\n✅ CloudFrontエイリアスレコードを作成しました！"));
  console.log(chalk.gray(`\nDNSの伝播には最大48時間かかる場合があります。`));
}

async function checkDnsRecords(domain) {
  console.log(chalk.yellow(`\n🔍 ${domain} のDNSレコードを確認中...\n`));

  try {
    const hostedZone = await findHostedZone(domain);
    const zoneId = hostedZone.Id.replace("/hostedzone/", "");

    const result = await route53
      .listResourceRecordSets({
        HostedZoneId: zoneId,
        StartRecordName: domain,
        MaxItems: "50",
      })
      .promise();

    const records = result.ResourceRecordSets.filter((r) => 
      r.Name === domain || r.Name === `${domain}.`
    );

    if (records.length === 0) {
      console.log(chalk.gray(`${domain} のレコードは設定されていません。`));
      return;
    }

    console.log(chalk.white(`${domain} のDNSレコード:`));
    console.log(chalk.gray("─".repeat(80)));

    records.forEach((record) => {
      console.log(chalk.white(`\nタイプ: ${chalk.bold(record.Type)}`));
      
      if (record.AliasTarget) {
        console.log(chalk.gray(`└─ エイリアス: ${record.AliasTarget.DNSName}`));
      } else if (record.ResourceRecords) {
        record.ResourceRecords.forEach((rr) => {
          console.log(chalk.gray(`└─ 値: ${rr.Value}`));
        });
      }
      
      if (record.TTL) {
        console.log(chalk.gray(`   TTL: ${record.TTL}秒`));
      }
    });
  } catch (error) {
    console.error(chalk.red(`❌ エラー: ${error.message}`));
  }
}

async function interactiveMenu() {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "実行する操作を選択してください:",
      choices: [
        { name: "📋 Route53ホストゾーン一覧を表示", value: "list" },
        { name: "🔐 証明書のDNS検証レコードを設定", value: "cert" },
        { name: "☁️  CloudFrontエイリアスレコードを設定", value: "cloudfront" },
        { name: "🔍 DNSレコードの設定状態を確認", value: "check" },
        { name: "❌ 終了", value: "exit" },
      ],
    },
  ]);

  switch (action) {
    case "list":
      await listHostedZones();
      break;
    
    case "cert":
      const { certArn } = await inquirer.prompt([
        {
          type: "input",
          name: "certArn",
          message: "証明書のARNを入力してください:",
          validate: (input) => {
            if (!input.startsWith("arn:aws:acm:")) {
              return "有効な証明書ARNを入力してください。";
            }
            return true;
          },
        },
      ]);
      await setupCertificateDnsValidation(certArn);
      break;
    
    case "cloudfront":
      const cfAnswers = await inquirer.prompt([
        {
          type: "input",
          name: "domain",
          message: "ドメイン名を入力してください:",
          validate: (input) => input.length > 0 || "ドメイン名は必須です。",
        },
        {
          type: "input",
          name: "cloudfront",
          message: "CloudFrontディストリビューションドメインを入力してください:",
          validate: (input) => {
            if (!input.endsWith(".cloudfront.net")) {
              return "有効なCloudFrontドメインを入力してください（例: d1234567890.cloudfront.net）";
            }
            return true;
          },
        },
      ]);
      options.domain = cfAnswers.domain;
      options.cloudfront = cfAnswers.cloudfront;
      await setupCloudFrontAlias();
      break;
    
    case "check":
      const { checkDomain } = await inquirer.prompt([
        {
          type: "input",
          name: "checkDomain",
          message: "確認するドメイン名を入力してください:",
          validate: (input) => input.length > 0 || "ドメイン名は必須です。",
        },
      ]);
      await checkDnsRecords(checkDomain);
      break;
    
    case "exit":
      console.log(chalk.gray("\n終了します。"));
      return;
  }
}

// エラーハンドリング
process.on("unhandledRejection", (error) => {
  console.error(chalk.red("\n❌ 予期しないエラーが発生しました:"), error);
  process.exit(1);
});

// メイン処理を実行
main();
#!/usr/bin/env node

const { execSync } = require("child_process");
const readline = require("readline");
const chalk = require("chalk");

// コマンドライン引数の解析
const args = process.argv.slice(2);
const showHelp = args.includes("-h") || args.includes("--help");
const listCerts = args.includes("-l") || args.includes("--list");
const deleteCert = args.includes("-d") || args.includes("--delete");

function displayHelp() {
  console.log(
    chalk.blue.bold(
      "\n🔐 create-cert - AWS Certificate Manager (ACM) 証明書管理ツール\n"
    )
  );
  console.log(chalk.yellow("使用方法:"));
  console.log("  create-cert              対話形式で新しい証明書を作成");
  console.log(
    "  create-cert -l, --list   発行済み証明書の一覧を表示（全リージョン）"
  );
  console.log("  create-cert -d, --delete 証明書を削除（対話形式で選択）");
  console.log("  create-cert -h, --help   このヘルプを表示");
  console.log();
  console.log(chalk.yellow("説明:"));
  console.log(
    "  AWS Certificate Manager (ACM) で SSL/TLS 証明書を簡単に作成・管理するツールです。"
  );
  console.log(
    "  CDKスタックとは独立して証明書を管理できるため、複数のプロジェクトで再利用可能です。"
  );
  console.log();
  console.log(chalk.yellow("主な機能:"));
  console.log("  • ワイルドカード証明書の作成（*.example.com）");
  console.log("  • 複数ドメインの証明書（SANs）対応");
  console.log("  • CloudFront用のus-east-1リージョン自動選択");
  console.log("  • DNS検証レコードの即時表示");
  console.log("  • SSMパラメータストアへの保存コマンド生成");
  console.log("  • 全リージョンの証明書を一括管理");
  console.log("  • 有効期限の確認とステータス表示");
  console.log();
  console.log(chalk.yellow("メリット:"));
  console.log(
    "  • " + chalk.green("永続性") + ": スタック削除時も証明書は残る"
  );
  console.log(
    "  • " +
      chalk.green("再利用性") +
      ": 複数プロジェクトで同じ証明書を使い回せる"
  );
  console.log("  • " + chalk.green("効率性") + ": DNS検証は最初の1回だけ");
  console.log(
    "  • " + chalk.green("独立性") + ": CDKスタックとは完全に独立して管理"
  );
  console.log();
  console.log(chalk.yellow("推奨される使用パターン:"));
  console.log();
  console.log("  1. " + chalk.cyan("ワイルドカード証明書の事前作成"));
  console.log(
    "     *.example.com を作成しておけば、dev.example.com, staging.example.com"
  );
  console.log("     などすべてのサブドメインで利用可能");
  console.log();
  console.log("  2. " + chalk.cyan("CloudFront用証明書"));
  console.log("     CloudFrontで使用する場合は必ずus-east-1リージョンを選択");
  console.log();
  console.log("  3. " + chalk.cyan("マルチドメイン証明書"));
  console.log("     example.comとwww.example.comを1つの証明書でカバー");
  console.log();
  console.log(chalk.yellow("例:"));
  console.log("  # 新しい証明書を作成（対話形式）");
  console.log("  $ create-cert");
  console.log("  → ドメイン名、リージョン、追加ドメインを順番に入力");
  console.log();
  console.log("  # 全リージョンの証明書を一覧表示");
  console.log("  $ create-cert --list");
  console.log("  → ドメイン名、ステータス、有効期限、ARN、削除コマンドを表示");
  console.log("  → 関連するCloudFormationスタックの削除コマンドも推定表示");
  console.log("  → Route 53レコードの確認コマンドも表示");
  console.log();
  console.log("  # 証明書を削除（対話形式）");
  console.log("  $ create-cert --delete");
  console.log("  → リージョンと証明書を選択して削除");
  console.log();
  console.log(chalk.yellow("DNS検証について:"));
  console.log("  証明書作成後、DNSにCNAMEレコードを追加する必要があります。");
  console.log(
    "  表示される検証用レコードをDNSプロバイダーで設定してください。"
  );
  console.log("  検証が完了すると証明書のステータスが「ISSUED」になります。");
  console.log();
  console.log(chalk.yellow("詳細情報:"));
  console.log("  https://github.com/goodsun/create-cdn");
  console.log("  https://www.npmjs.com/package/@goodsun/create-cdn");
  console.log();
}

async function listCertificates() {
  console.log(chalk.blue.bold("\n🔐 AWS Certificate Manager - 証明書一覧\n"));

  // 主要なリージョンのリスト
  const regions = [
    "us-east-1", // バージニア北部（CloudFront必須）
    "ap-northeast-1", // 東京
    "ap-northeast-2", // ソウル
    "ap-southeast-1", // シンガポール
    "ap-southeast-2", // シドニー
    "eu-west-1", // アイルランド
    "eu-central-1", // フランクフルト
    "us-west-1", // 北カリフォルニア
    "us-west-2", // オレゴン
  ];

  let totalCerts = 0;

  for (const region of regions) {
    try {
      const cmd = `aws acm list-certificates --region ${region} --includes keyTypes=RSA_2048,EC_prime256v1 --output json 2>/dev/null`;
      const result = execSync(cmd, { encoding: "utf8" });
      const certificateList = JSON.parse(result).CertificateSummaryList || [];

      if (certificateList && certificateList.length > 0) {
        console.log(chalk.yellow(`\n📍 リージョン: ${region}`));
        console.log(chalk.gray("─".repeat(80)));

        for (const cert of certificateList) {
          const arnId = cert.CertificateArn.split("/").pop();

          // ステータスに応じた色分け
          let statusColor;
          switch (cert.Status) {
            case "ISSUED":
              statusColor = chalk.green(cert.Status);
              break;
            case "PENDING_VALIDATION":
              statusColor = chalk.yellow(cert.Status);
              break;
            case "EXPIRED":
              statusColor = chalk.red(cert.Status);
              break;
            default:
              statusColor = chalk.gray(cert.Status);
          }

          console.log(
            chalk.white(`  ドメイン: ${chalk.bold(cert.DomainName)}`)
          );
          console.log(chalk.gray(`  ├─ ステータス: ${statusColor}`));
          console.log(chalk.gray(`  ├─ ARN: .../${arnId}`));

          // 詳細情報を取得（作成日、有効期限、使用状況）
          try {
            const detailCmd = `aws acm describe-certificate --certificate-arn "${cert.CertificateArn}" --region ${region} --query "Certificate.[CreatedAt,NotAfter,InUseBy]" --output json 2>/dev/null`;
            const detailResult = execSync(detailCmd, { encoding: "utf8" });
            const [createdAt, notAfter, inUseBy] = JSON.parse(detailResult);

            if (createdAt) {
              const created = new Date(createdAt).toLocaleDateString("ja-JP");
              console.log(chalk.gray(`  ├─ 作成日: ${created}`));
            }

            if (notAfter) {
              const expires = new Date(notAfter);
              const daysUntilExpiry = Math.floor(
                (expires - new Date()) / (1000 * 60 * 60 * 24)
              );
              const expiryDate = expires.toLocaleDateString("ja-JP");

              if (daysUntilExpiry < 30) {
                console.log(
                  chalk.gray(
                    `  ├─ 有効期限: ${chalk.red(
                      expiryDate
                    )} (${daysUntilExpiry}日後)`
                  )
                );
              } else {
                console.log(
                  chalk.gray(
                    `  ├─ 有効期限: ${expiryDate} (${daysUntilExpiry}日後)`
                  )
                );
              }
            }

            // 使用中のリソースを表示
            if (inUseBy && inUseBy.length > 0) {
              console.log(chalk.gray(`  ├─ 使用中: ${chalk.yellow("Yes")}`));
              inUseBy.forEach((resource, idx) => {
                const isLast = idx === inUseBy.length - 1;
                const prefix = isLast ? "  │  └─" : "  │  ├─";
                console.log(chalk.gray(`${prefix} ${resource.split('/').pop()}`));
              });
            }

            // 削除コマンドを表示
            console.log(chalk.gray(`  ├─ 📋 削除コマンド:`));
            console.log(chalk.gray(`  │  └─ ${chalk.cyan(`aws acm delete-certificate --certificate-arn ${cert.CertificateArn} --region ${region}`)}`));

            // CloudFormationスタックの検索と削除コマンド
            if (cert.DomainName.includes('.e2e.') || cert.DomainName.includes('test-')) {
              const stackName = `CdnStack-${cert.DomainName.replace(/\./g, '-')}`;
              console.log(chalk.gray(`  ├─ 🗄️  関連スタック削除コマンド (推定):`));
              console.log(chalk.gray(`  │  └─ ${chalk.cyan(`aws cloudformation delete-stack --stack-name ${stackName} --region ${region}`)}`));
            }

            // Route 53レコードの確認コマンド
            // ドメインからホストゾーンIDを検索
            let hostedZoneId = null;
            try {
              const baseDomain = cert.DomainName.startsWith('*.') 
                ? cert.DomainName.substring(2) 
                : cert.DomainName;
              
              // ドメインの各レベルで検索
              const domainParts = baseDomain.split('.');
              for (let i = 0; i < domainParts.length - 1; i++) {
                const searchDomain = domainParts.slice(i).join('.');
                const zoneCmd = `aws route53 list-hosted-zones-by-name --query "HostedZones[?Name==\\\`${searchDomain}.\\\`].Id" --output json 2>/dev/null`;
                const zoneResult = execSync(zoneCmd, { encoding: "utf8" });
                const zones = JSON.parse(zoneResult);
                
                if (zones && zones.length > 0) {
                  hostedZoneId = zones[0].split('/').pop();
                  break;
                }
              }
            } catch (e) {
              // Zone ID取得エラーは無視
            }

            console.log(chalk.gray(`  └─ 🌐 Route 53レコード確認:`));
            if (hostedZoneId) {
              const namePattern = cert.DomainName.startsWith('*.') ? '*' : cert.DomainName.split('.')[0];
              console.log(chalk.gray(`     └─ ${chalk.cyan(`aws route53 list-resource-record-sets --hosted-zone-id ${hostedZoneId} --query "ResourceRecordSets[?contains(Name, '${namePattern}')]"`)}`));
            } else {
              console.log(chalk.gray(`     └─ ${chalk.cyan(`aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID> --query "ResourceRecordSets[?contains(Name, '${cert.DomainName.split('.')[0]}')]"`)}`));
            }
          } catch (e) {
            // 詳細情報が取得できない場合はスキップ
            console.log(chalk.gray(`  └─ 📋 削除コマンド:`));
            console.log(chalk.gray(`     └─ ${chalk.cyan(`aws acm delete-certificate --certificate-arn ${cert.CertificateArn} --region ${region}`)}`));
          }

          console.log();
          totalCerts++;
        }
      }
    } catch (error) {
      // リージョンにアクセスできない場合は静かにスキップ
      continue;
    }
  }

  if (totalCerts === 0) {
    console.log(chalk.yellow("証明書が見つかりませんでした。"));
    console.log(
      chalk.gray("\nヒント: create-cert コマンドで新しい証明書を作成できます。")
    );
  } else {
    console.log(chalk.gray("─".repeat(80)));
    console.log(chalk.green(`\n合計: ${totalCerts} 個の証明書\n`));
  }
}

async function deleteCertificate() {
  console.log(chalk.blue.bold("\n🗑️  AWS Certificate Manager - 証明書削除\n"));

  // まず証明書一覧を収集
  const allCertificates = [];
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

  console.log(chalk.yellow("証明書を検索中...\n"));

  for (const region of regions) {
    try {
      const cmd = `aws acm list-certificates --region ${region} --output json 2>/dev/null`;
      const result = execSync(cmd, { encoding: "utf8" });
      const certificateList = JSON.parse(result).CertificateSummaryList || [];

      certificateList.forEach((cert) => {
        if (cert.Status !== "EXPIRED") {
          // 期限切れ以外を対象
          allCertificates.push({
            ...cert,
            Region: region,
          });
        }
      });
    } catch (error) {
      continue;
    }
  }

  if (allCertificates.length === 0) {
    console.log(chalk.yellow("削除可能な証明書が見つかりませんでした。"));
    return;
  }

  // 証明書を番号付きで表示
  console.log(chalk.cyan("削除する証明書を選択してください:\n"));
  allCertificates.forEach((cert, index) => {
    const arnId = cert.CertificateArn.split("/").pop();
    const statusColor =
      cert.Status === "ISSUED"
        ? chalk.green(cert.Status)
        : chalk.yellow(cert.Status);

    console.log(chalk.white(`${index + 1}. ${chalk.bold(cert.DomainName)}`));
    console.log(chalk.gray(`   ├─ リージョン: ${cert.Region}`));
    console.log(chalk.gray(`   ├─ ステータス: ${statusColor}`));
    console.log(chalk.gray(`   └─ ARN: .../${arnId}`));
    console.log();
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  const selection = await question(
    chalk.yellow("番号を入力してください (キャンセルはEnter): ")
  );

  if (!selection.trim()) {
    console.log(chalk.yellow("\nキャンセルしました。"));
    rl.close();
    return;
  }

  const index = parseInt(selection) - 1;
  if (isNaN(index) || index < 0 || index >= allCertificates.length) {
    console.log(chalk.red("\n無効な番号です。"));
    rl.close();
    return;
  }

  const selectedCert = allCertificates[index];

  // 確認
  console.log(chalk.red("\n⚠️  警告: この操作は取り消せません！"));
  console.log(chalk.white(`\n削除する証明書:`));
  console.log(
    chalk.white(`  ドメイン: ${chalk.bold(selectedCert.DomainName)}`)
  );
  console.log(chalk.white(`  リージョン: ${selectedCert.Region}`));
  console.log(chalk.white(`  ARN: ${selectedCert.CertificateArn}`));

  const confirm = await question(chalk.red("\n本当に削除しますか？ (yes/N): "));

  if (confirm.toLowerCase() !== "yes") {
    console.log(chalk.yellow("\nキャンセルしました。"));
    rl.close();
    return;
  }

  rl.close();

  // 削除実行
  console.log(chalk.yellow("\n証明書を削除中..."));

  try {
    // 使用状況をチェック
    const describeCmd = `aws acm describe-certificate --certificate-arn "${selectedCert.CertificateArn}" --region ${selectedCert.Region} --query "Certificate.InUseBy" --output json`;
    const inUseResult = execSync(describeCmd, { encoding: "utf8" });
    const inUseBy = JSON.parse(inUseResult);

    if (inUseBy && inUseBy.length > 0) {
      console.log(
        chalk.red(
          "\n❌ エラー: この証明書は以下のリソースで使用中のため削除できません:"
        )
      );
      inUseBy.forEach((resource) => {
        console.log(chalk.white(`  - ${resource}`));
      });
      console.log(
        chalk.yellow(
          "\n先にこれらのリソースから証明書の関連付けを解除してください。"
        )
      );
      return;
    }

    // 削除実行
    const deleteCmd = `aws acm delete-certificate --certificate-arn "${selectedCert.CertificateArn}" --region ${selectedCert.Region}`;
    execSync(deleteCmd);

    console.log(chalk.green("\n✅ 証明書を削除しました！"));

    // SSMパラメータも削除を提案
    if (selectedCert.DomainName.startsWith("*.")) {
      const parameterName = `/acm/wildcard.${selectedCert.DomainName.substring(
        2
      )}/certificate-arn`;
      console.log(
        chalk.cyan(
          "\n💡 ヒント: SSMパラメータも削除する場合は以下のコマンドを実行:"
        )
      );
      console.log(
        chalk.white(
          `aws ssm delete-parameter --name "${parameterName}" --region ${selectedCert.Region}`
        )
      );
    }
  } catch (error) {
    console.error(chalk.red("\n❌ 削除エラー:"));
    console.error(error.message);
    if (error.message.includes("ResourceInUseException")) {
      console.log(
        chalk.yellow(
          "\nこの証明書は使用中です。関連するリソースを先に削除してください。"
        )
      );
    }
  }
}

// ヘルプ表示
if (showHelp) {
  displayHelp();
  process.exit(0);
}

// 証明書一覧表示
if (listCerts) {
  listCertificates().catch((error) => {
    console.error(chalk.red("エラー:"), error.message);
    process.exit(1);
  });
  return;
}

// 証明書削除
if (deleteCert) {
  deleteCertificate().catch((error) => {
    console.error(chalk.red("エラー:"), error.message);
    process.exit(1);
  });
  return;
}

// 通常の証明書作成処理
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function main() {
  console.log(
    chalk.blue.bold("\n🔐 AWS Certificate Manager (ACM) 証明書作成ツール\n")
  );

  // ドメイン名の入力
  let domain = await question(
    chalk.yellow(
      "証明書を作成するドメイン名を入力してください (例: example.com, *.example.com): "
    )
  );
  domain = domain.trim();

  if (!domain) {
    console.error(chalk.red("❌ ドメイン名が入力されていません"));
    process.exit(1);
  }

  // リージョンの選択
  console.log(chalk.yellow("\nリージョンを選択してください:"));
  console.log("1. us-east-1 (CloudFront用)");
  console.log("2. ap-northeast-1 (東京リージョン)");
  console.log("3. その他");

  const regionChoice = await question("選択 (1-3): ");
  let region;

  switch (regionChoice.trim()) {
    case "1":
      region = "us-east-1";
      break;
    case "2":
      region = "ap-northeast-1";
      break;
    case "3":
      region = await question("リージョンコードを入力してください: ");
      break;
    default:
      console.error(chalk.red("❌ 無効な選択です"));
      process.exit(1);
  }

  // SANs (Subject Alternative Names) の追加
  const addSans = await question(
    chalk.yellow("\n追加のドメイン名を含めますか？ (y/N): ")
  );
  let sanDomains = [];

  if (addSans.toLowerCase() === "y") {
    // ワイルドカード証明書の場合、ベースドメインを自動追加
    if (domain.startsWith("*.")) {
      const baseDomain = domain.substring(2);
      sanDomains.push(baseDomain);
      console.log(
        chalk.green(`✓ ベースドメイン ${baseDomain} を自動追加しました`)
      );
    }

    // www付きドメインの追加
    if (!domain.startsWith("*.") && !domain.startsWith("www.")) {
      const addWww = await question("www付きドメインも含めますか？ (Y/n): ");
      if (addWww.toLowerCase() !== "n") {
        sanDomains.push(`www.${domain}`);
      }
    }

    // カスタムドメインの追加
    const customDomains = await question(
      "その他のドメイン名 (カンマ区切り、なければEnter): "
    );
    if (customDomains.trim()) {
      sanDomains = sanDomains.concat(
        customDomains
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d)
      );
    }
  }

  // 確認
  console.log(chalk.cyan("\n📋 作成する証明書の情報:"));
  console.log(`  プライマリドメイン: ${domain}`);
  if (sanDomains.length > 0) {
    console.log(`  追加ドメイン: ${sanDomains.join(", ")}`);
  }
  console.log(`  リージョン: ${region}`);

  const confirm = await question(
    chalk.yellow("\nこの内容で証明書を作成しますか？ (y/N): ")
  );
  if (confirm.toLowerCase() !== "y") {
    console.log(chalk.yellow("キャンセルしました"));
    process.exit(0);
  }

  rl.close();

  // 証明書の作成
  console.log(chalk.blue("\n🔄 証明書を作成中..."));

  try {
    // AWS CLIコマンドの構築
    let cmd = `aws acm request-certificate --domain-name "${domain}" --validation-method DNS --region ${region}`;

    if (sanDomains.length > 0) {
      cmd += ` --subject-alternative-names ${sanDomains
        .map((d) => `"${d}"`)
        .join(" ")}`;
    }

    // タグの追加
    cmd += ` --tags Key=Name,Value="${domain.replace(
      /[*.]/g,
      "-"
    )}-certificate" Key=ManagedBy,Value=create-cert`;

    const result = execSync(cmd, { encoding: "utf8" });
    const certificateArn = JSON.parse(result).CertificateArn;

    console.log(chalk.green("\n✅ 証明書の作成リクエストが完了しました！"));
    console.log(chalk.white(`証明書ARN: ${certificateArn}`));

    // DNS検証情報の表示
    console.log(chalk.yellow("\n⏳ DNS検証レコードを取得中..."));

    // 少し待機（証明書情報が利用可能になるまで）
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const validationCmd = `aws acm describe-certificate --certificate-arn "${certificateArn}" --region ${region}`;
      const certDetails = JSON.parse(
        execSync(validationCmd, { encoding: "utf8" })
      );

      if (certDetails.Certificate.DomainValidationOptions) {
        console.log(chalk.cyan("\n📝 DNS検証に必要なCNAMEレコード:"));
        console.log("以下のレコードをDNSに追加してください:\n");

        const validationRecords = new Map();
        certDetails.Certificate.DomainValidationOptions.forEach((option) => {
          if (option.ResourceRecord) {
            const key = option.ResourceRecord.Name;
            if (!validationRecords.has(key)) {
              validationRecords.set(key, option.ResourceRecord);
            }
          }
        });

        validationRecords.forEach((record) => {
          console.log(chalk.white(`  レコードタイプ: CNAME`));
          console.log(chalk.white(`  名前: ${record.Name}`));
          console.log(chalk.white(`  値: ${record.Value}`));
          console.log();

          // コピペ用の形式も表示
          const recordNameWithDot = record.Name;
          const recordValueWithDot = record.Value;
          const recordName = record.Name.replace(/\.$/, ""); // 末尾のドットを削除
          const recordValue = record.Value.replace(/\.$/, ""); // 末尾のドットを削除

          // ドメイン名から現在のゾーンを推測して削除
          const domainParts = domain.split(".");
          const zoneName = domainParts.slice(-2).join(".");
          const shortRecordName = recordName.endsWith(`.${zoneName}`)
            ? recordName.slice(0, -(zoneName.length + 1))
            : recordName;

          console.log(chalk.cyan("💡 DNSレコードに追加する場合（コピペ用）:"));
          console.log(
            chalk.white(`cname ${shortRecordName} ${recordValueWithDot}`)
          );
          console.log(chalk.gray(`  または（フルネーム）:`));
          console.log(
            chalk.gray(`  cname ${recordName} ${recordValueWithDot}`)
          );
          console.log();
        });
      }
    } catch (error) {
      console.log(
        chalk.yellow(
          "DNS検証レコードはAWS Management Consoleで確認してください"
        )
      );
    }

    // SSMパラメータへの保存を提案
    if (domain.startsWith("*.")) {
      const parameterName = `/acm/wildcard.${domain.substring(
        2
      )}/certificate-arn`;
      console.log(
        chalk.cyan(
          "💡 ヒント: CDKで使用するために、以下のコマンドでSSMに保存できます:"
        )
      );
      console.log(
        chalk.white(
          `aws ssm put-parameter --name "${parameterName}" --value "${certificateArn}" --type String --region ${region}`
        )
      );
    }

    console.log(
      chalk.green("\n✨ 完了！DNS検証が完了すると証明書が発行されます。")
    );
  } catch (error) {
    console.error(chalk.red("\n❌ エラーが発生しました:"));
    console.error(error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(chalk.red("予期しないエラー:"), error);
  process.exit(1);
});

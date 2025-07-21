#!/usr/bin/env node
const { execSync } = require("child_process");

const domain = "*.goodsun.tokyo";
const baseDomain = domain.startsWith('*.') ? domain.substring(2) : domain;

console.log("Testing zone lookup for:", baseDomain);

try {
  const domainParts = baseDomain.split('.');
  for (let i = 0; i < domainParts.length - 1; i++) {
    const searchDomain = domainParts.slice(i).join('.');
    console.log("Searching for zone:", searchDomain);
    
    const zoneCmd = `aws route53 list-hosted-zones-by-name --query "HostedZones[?Name==\\\`${searchDomain}.\\\`].Id" --output json`;
    console.log("Command:", zoneCmd);
    
    try {
      const zoneResult = execSync(zoneCmd, { encoding: "utf8" });
      const zones = JSON.parse(zoneResult);
      console.log("Result:", zones);
      
      if (zones && zones.length > 0) {
        const hostedZoneId = zones[0].split('/').pop();
        console.log("Found Zone ID:", hostedZoneId);
        break;
      }
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
} catch (e) {
  console.log("Outer error:", e.message);
}
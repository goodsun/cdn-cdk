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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const dotenv = __importStar(require("dotenv"));
const cdn_stack_1 = require("../lib/cdn-stack");
// Load environment variables with override option to prioritize .env file
dotenv.config({ override: true });
const app = new cdk.App();
// Get configuration from environment variables or CDK context
const config = {
    account: process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account'),
    region: process.env.CDK_DEFAULT_REGION || app.node.tryGetContext('region') || 'ap-northeast-1',
    domain: process.env.DOMAIN_NAME || app.node.tryGetContext('domain'),
    useCloudFront: process.env.USE_CLOUDFRONT === 'true' || app.node.tryGetContext('useCloudFront'),
    originType: process.env.ORIGIN_TYPE || app.node.tryGetContext('originType') || 's3-new',
    originDomain: process.env.ORIGIN_DOMAIN || app.node.tryGetContext('originDomain'),
    originPath: process.env.ORIGIN_PATH || app.node.tryGetContext('originPath'),
    useMonitoring: process.env.USE_MONITORING === 'true' || app.node.tryGetContext('useMonitoring'),
    notificationEmail: process.env.NOTIFICATION_EMAIL || app.node.tryGetContext('notificationEmail')
};
// Validate required configuration
if (!config.domain) {
    throw new Error('Domain name is required. Set DOMAIN_NAME in .env file');
}
if (config.useMonitoring && !config.notificationEmail) {
    throw new Error('Notification email is required when monitoring is enabled. Set NOTIFICATION_EMAIL in .env file');
}
// ワイルドカード証明書の処理
if (config.domain.startsWith('*.')) {
    // ワイルドカード証明書はus-east-1に作成（将来のCloudFront利用のため）
    if (config.region !== 'us-east-1') {
        console.log('\n📍 ワイルドカード証明書をus-east-1に作成します（CloudFront対応のため）。');
        config.region = 'us-east-1';
    }
    // ワイルドカード証明書ではCloudFrontディストリビューションは作成しない
    if (config.useCloudFront) {
        console.log('⚠️  ワイルドカード証明書では証明書のみ作成します。');
        console.log('   CloudFrontディストリビューションは作成されません。');
        config.useCloudFront = false;
    }
}
else {
    // 通常のドメインでCloudFrontを使用する場合は自動的にus-east-1を使用
    if (config.useCloudFront && config.region !== 'us-east-1') {
        console.log('\n📍 CloudFront用にリージョンをus-east-1に自動設定しました。');
        config.region = 'us-east-1';
    }
}
// Generate unique stack name based on domain
const stackName = `CdnStack-${config.domain.replace(/\./g, '-').replace(/\*/g, 'wildcard')}`;

// Create the CDN stack
new cdn_stack_1.CdnStack(app, stackName, {
    env: {
        account: config.account,
        region: config.region
    },
    ...config
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsK0NBQWlDO0FBQ2pDLGdEQUE0QztBQUU1QywwRUFBMEU7QUFDMUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBRWxDLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLDhEQUE4RDtBQUM5RCxNQUFNLE1BQU0sR0FBRztJQUNiLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQztJQUM3RSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsSUFBSSxnQkFBZ0I7SUFDOUYsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQztJQUNuRSxhQUFhLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEtBQUssTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQztJQUMvRixVQUFVLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLElBQUksUUFBUTtJQUN2RixZQUFZLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDO0lBQ2pGLFVBQVUsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUM7SUFDM0UsYUFBYSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUM7SUFDL0YsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQztDQUNqRyxDQUFDO0FBRUYsa0NBQWtDO0FBQ2xDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDbkIsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO0FBQzNFLENBQUM7QUFFRCxJQUFJLE1BQU0sQ0FBQyxhQUFhLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUN0RCxNQUFNLElBQUksS0FBSyxDQUFDLGdHQUFnRyxDQUFDLENBQUM7QUFDcEgsQ0FBQztBQUVELGdCQUFnQjtBQUNoQixJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7SUFDbkMsOENBQThDO0lBQzlDLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUUsQ0FBQztRQUNsQyxPQUFPLENBQUMsR0FBRyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7UUFDakUsTUFBTSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7SUFDOUIsQ0FBQztJQUVELDBDQUEwQztJQUMxQyxJQUFJLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFDM0MsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDO0lBQy9CLENBQUM7QUFDSCxDQUFDO0tBQU0sQ0FBQztJQUNOLDZDQUE2QztJQUM3QyxJQUFJLE1BQU0sQ0FBQyxhQUFhLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUUsQ0FBQztRQUMxRCxPQUFPLENBQUMsR0FBRyxDQUFDLDRDQUE0QyxDQUFDLENBQUM7UUFDMUQsTUFBTSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7SUFDOUIsQ0FBQztBQUNILENBQUM7QUFFRCx1QkFBdUI7QUFDdkIsSUFBSSxvQkFBUSxDQUFDLEdBQUcsRUFBRSxVQUFVLEVBQUU7SUFDNUIsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPO1FBQ3ZCLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtLQUN0QjtJQUNELEdBQUcsTUFBTTtDQUNWLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkb3RlbnYgZnJvbSAnZG90ZW52JztcbmltcG9ydCB7IENkblN0YWNrIH0gZnJvbSAnLi4vbGliL2Nkbi1zdGFjayc7XG5cbi8vIExvYWQgZW52aXJvbm1lbnQgdmFyaWFibGVzIHdpdGggb3ZlcnJpZGUgb3B0aW9uIHRvIHByaW9yaXRpemUgLmVudiBmaWxlXG5kb3RlbnYuY29uZmlnKHsgb3ZlcnJpZGU6IHRydWUgfSk7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIEdldCBjb25maWd1cmF0aW9uIGZyb20gZW52aXJvbm1lbnQgdmFyaWFibGVzIG9yIENESyBjb250ZXh0XG5jb25zdCBjb25maWcgPSB7XG4gIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQgfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnYWNjb3VudCcpLFxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdyZWdpb24nKSB8fCAnYXAtbm9ydGhlYXN0LTEnLFxuICBkb21haW46IHByb2Nlc3MuZW52LkRPTUFJTl9OQU1FIHx8IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2RvbWFpbicpLFxuICB1c2VDbG91ZEZyb250OiBwcm9jZXNzLmVudi5VU0VfQ0xPVURGUk9OVCA9PT0gJ3RydWUnIHx8IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3VzZUNsb3VkRnJvbnQnKSxcbiAgb3JpZ2luVHlwZTogcHJvY2Vzcy5lbnYuT1JJR0lOX1RZUEUgfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnb3JpZ2luVHlwZScpIHx8ICdzMy1uZXcnLFxuICBvcmlnaW5Eb21haW46IHByb2Nlc3MuZW52Lk9SSUdJTl9ET01BSU4gfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnb3JpZ2luRG9tYWluJyksXG4gIG9yaWdpblBhdGg6IHByb2Nlc3MuZW52Lk9SSUdJTl9QQVRIIHx8IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ29yaWdpblBhdGgnKSxcbiAgdXNlTW9uaXRvcmluZzogcHJvY2Vzcy5lbnYuVVNFX01PTklUT1JJTkcgPT09ICd0cnVlJyB8fCBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd1c2VNb25pdG9yaW5nJyksXG4gIG5vdGlmaWNhdGlvbkVtYWlsOiBwcm9jZXNzLmVudi5OT1RJRklDQVRJT05fRU1BSUwgfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnbm90aWZpY2F0aW9uRW1haWwnKVxufTtcblxuLy8gVmFsaWRhdGUgcmVxdWlyZWQgY29uZmlndXJhdGlvblxuaWYgKCFjb25maWcuZG9tYWluKSB7XG4gIHRocm93IG5ldyBFcnJvcignRG9tYWluIG5hbWUgaXMgcmVxdWlyZWQuIFNldCBET01BSU5fTkFNRSBpbiAuZW52IGZpbGUnKTtcbn1cblxuaWYgKGNvbmZpZy51c2VNb25pdG9yaW5nICYmICFjb25maWcubm90aWZpY2F0aW9uRW1haWwpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdOb3RpZmljYXRpb24gZW1haWwgaXMgcmVxdWlyZWQgd2hlbiBtb25pdG9yaW5nIGlzIGVuYWJsZWQuIFNldCBOT1RJRklDQVRJT05fRU1BSUwgaW4gLmVudiBmaWxlJyk7XG59XG5cbi8vIOODr+OCpOODq+ODieOCq+ODvOODieiovOaYjuabuOOBruWHpueQhlxuaWYgKGNvbmZpZy5kb21haW4uc3RhcnRzV2l0aCgnKi4nKSkge1xuICAvLyDjg6/jgqTjg6vjg4njgqvjg7zjg4noqLzmmI7mm7jjga91cy1lYXN0LTHjgavkvZzmiJDvvIjlsIbmnaXjga5DbG91ZEZyb2505Yip55So44Gu44Gf44KB77yJXG4gIGlmIChjb25maWcucmVnaW9uICE9PSAndXMtZWFzdC0xJykge1xuICAgIGNvbnNvbGUubG9nKCdcXG7wn5ONIOODr+OCpOODq+ODieOCq+ODvOODieiovOaYjuabuOOCknVzLWVhc3QtMeOBq+S9nOaIkOOBl+OBvuOBme+8iENsb3VkRnJvbnTlr77lv5zjga7jgZ/jgoHvvInjgIInKTtcbiAgICBjb25maWcucmVnaW9uID0gJ3VzLWVhc3QtMSc7XG4gIH1cbiAgXG4gIC8vIOODr+OCpOODq+ODieOCq+ODvOODieiovOaYjuabuOOBp+OBr0Nsb3VkRnJvbnTjg4fjgqPjgrnjg4jjg6rjg5Pjg6Xjg7zjgrfjg6fjg7Pjga/kvZzmiJDjgZfjgarjgYRcbiAgaWYgKGNvbmZpZy51c2VDbG91ZEZyb250KSB7XG4gICAgY29uc29sZS5sb2coJ+KaoO+4jyAg44Ov44Kk44Or44OJ44Kr44O844OJ6Ki85piO5pu444Gn44Gv6Ki85piO5pu444Gu44G/5L2c5oiQ44GX44G+44GZ44CCJyk7XG4gICAgY29uc29sZS5sb2coJyAgIENsb3VkRnJvbnTjg4fjgqPjgrnjg4jjg6rjg5Pjg6Xjg7zjgrfjg6fjg7Pjga/kvZzmiJDjgZXjgozjgb7jgZvjgpPjgIInKTtcbiAgICBjb25maWcudXNlQ2xvdWRGcm9udCA9IGZhbHNlO1xuICB9XG59IGVsc2Uge1xuICAvLyDpgJrluLjjga7jg4njg6HjgqTjg7PjgadDbG91ZEZyb25044KS5L2/55So44GZ44KL5aC05ZCI44Gv6Ieq5YuV55qE44GrdXMtZWFzdC0x44KS5L2/55SoXG4gIGlmIChjb25maWcudXNlQ2xvdWRGcm9udCAmJiBjb25maWcucmVnaW9uICE9PSAndXMtZWFzdC0xJykge1xuICAgIGNvbnNvbGUubG9nKCdcXG7wn5ONIENsb3VkRnJvbnTnlKjjgavjg6rjg7zjgrjjg6fjg7PjgpJ1cy1lYXN0LTHjgavoh6rli5XoqK3lrprjgZfjgb7jgZfjgZ/jgIInKTtcbiAgICBjb25maWcucmVnaW9uID0gJ3VzLWVhc3QtMSc7XG4gIH1cbn1cblxuLy8gQ3JlYXRlIHRoZSBDRE4gc3RhY2tcbm5ldyBDZG5TdGFjayhhcHAsICdDZG5TdGFjaycsIHtcbiAgZW52OiB7XG4gICAgYWNjb3VudDogY29uZmlnLmFjY291bnQsXG4gICAgcmVnaW9uOiBjb25maWcucmVnaW9uXG4gIH0sXG4gIC4uLmNvbmZpZ1xufSk7XG5cbmFwcC5zeW50aCgpOyJdfQ==
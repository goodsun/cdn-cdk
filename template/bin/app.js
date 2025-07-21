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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsK0NBQWlDO0FBQ2pDLGdEQUE0QztBQUU1QywwRUFBMEU7QUFDMUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBRWxDLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLDhEQUE4RDtBQUM5RCxNQUFNLE1BQU0sR0FBRztJQUNiLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQztJQUM3RSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsSUFBSSxnQkFBZ0I7SUFDOUYsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQztJQUNuRSxhQUFhLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEtBQUssTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQztJQUMvRixVQUFVLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLElBQUksUUFBUTtJQUN2RixZQUFZLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDO0lBQ2pGLFVBQVUsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUM7SUFDM0UsYUFBYSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUM7SUFDL0YsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQztDQUNqRyxDQUFDO0FBRUYsa0NBQWtDO0FBQ2xDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDbkIsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO0FBQzNFLENBQUM7QUFFRCxJQUFJLE1BQU0sQ0FBQyxhQUFhLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUN0RCxNQUFNLElBQUksS0FBSyxDQUFDLGdHQUFnRyxDQUFDLENBQUM7QUFDcEgsQ0FBQztBQUVELGdCQUFnQjtBQUNoQixJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7SUFDbkMsOENBQThDO0lBQzlDLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUUsQ0FBQztRQUNsQyxPQUFPLENBQUMsR0FBRyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7UUFDakUsTUFBTSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7SUFDOUIsQ0FBQztJQUVELDBDQUEwQztJQUMxQyxJQUFJLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFDM0MsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDO0lBQy9CLENBQUM7QUFDSCxDQUFDO0tBQU0sQ0FBQztJQUNOLDZDQUE2QztJQUM3QyxJQUFJLE1BQU0sQ0FBQyxhQUFhLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUUsQ0FBQztRQUMxRCxPQUFPLENBQUMsR0FBRyxDQUFDLDRDQUE0QyxDQUFDLENBQUM7UUFDMUQsTUFBTSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7SUFDOUIsQ0FBQztBQUNILENBQUM7QUFFRCw2Q0FBNkM7QUFDN0MsTUFBTSxTQUFTLEdBQUcsWUFBWSxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDO0FBRTdGLHVCQUF1QjtBQUN2QixJQUFJLG9CQUFRLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRTtJQUMzQixHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU87UUFDdkIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO0tBQ3RCO0lBQ0QsR0FBRyxNQUFNO0NBQ1YsQ0FBQyxDQUFDO0FBRUgsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGRvdGVudiBmcm9tICdkb3RlbnYnO1xuaW1wb3J0IHsgQ2RuU3RhY2sgfSBmcm9tICcuLi9saWIvY2RuLXN0YWNrJztcblxuLy8gTG9hZCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgd2l0aCBvdmVycmlkZSBvcHRpb24gdG8gcHJpb3JpdGl6ZSAuZW52IGZpbGVcbmRvdGVudi5jb25maWcoeyBvdmVycmlkZTogdHJ1ZSB9KTtcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IGNvbmZpZ3VyYXRpb24gZnJvbSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgb3IgQ0RLIGNvbnRleHRcbmNvbnN0IGNvbmZpZyA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCB8fCBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdhY2NvdW50JyksXG4gIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3JlZ2lvbicpIHx8ICdhcC1ub3J0aGVhc3QtMScsXG4gIGRvbWFpbjogcHJvY2Vzcy5lbnYuRE9NQUlOX05BTUUgfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZG9tYWluJyksXG4gIHVzZUNsb3VkRnJvbnQ6IHByb2Nlc3MuZW52LlVTRV9DTE9VREZST05UID09PSAndHJ1ZScgfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgndXNlQ2xvdWRGcm9udCcpLFxuICBvcmlnaW5UeXBlOiBwcm9jZXNzLmVudi5PUklHSU5fVFlQRSB8fCBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdvcmlnaW5UeXBlJykgfHwgJ3MzLW5ldycsXG4gIG9yaWdpbkRvbWFpbjogcHJvY2Vzcy5lbnYuT1JJR0lOX0RPTUFJTiB8fCBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdvcmlnaW5Eb21haW4nKSxcbiAgb3JpZ2luUGF0aDogcHJvY2Vzcy5lbnYuT1JJR0lOX1BBVEggfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnb3JpZ2luUGF0aCcpLFxuICB1c2VNb25pdG9yaW5nOiBwcm9jZXNzLmVudi5VU0VfTU9OSVRPUklORyA9PT0gJ3RydWUnIHx8IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3VzZU1vbml0b3JpbmcnKSxcbiAgbm90aWZpY2F0aW9uRW1haWw6IHByb2Nlc3MuZW52Lk5PVElGSUNBVElPTl9FTUFJTCB8fCBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdub3RpZmljYXRpb25FbWFpbCcpXG59O1xuXG4vLyBWYWxpZGF0ZSByZXF1aXJlZCBjb25maWd1cmF0aW9uXG5pZiAoIWNvbmZpZy5kb21haW4pIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdEb21haW4gbmFtZSBpcyByZXF1aXJlZC4gU2V0IERPTUFJTl9OQU1FIGluIC5lbnYgZmlsZScpO1xufVxuXG5pZiAoY29uZmlnLnVzZU1vbml0b3JpbmcgJiYgIWNvbmZpZy5ub3RpZmljYXRpb25FbWFpbCkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ05vdGlmaWNhdGlvbiBlbWFpbCBpcyByZXF1aXJlZCB3aGVuIG1vbml0b3JpbmcgaXMgZW5hYmxlZC4gU2V0IE5PVElGSUNBVElPTl9FTUFJTCBpbiAuZW52IGZpbGUnKTtcbn1cblxuLy8g44Ov44Kk44Or44OJ44Kr44O844OJ6Ki85piO5pu444Gu5Yem55CGXG5pZiAoY29uZmlnLmRvbWFpbi5zdGFydHNXaXRoKCcqLicpKSB7XG4gIC8vIOODr+OCpOODq+ODieOCq+ODvOODieiovOaYjuabuOOBr3VzLWVhc3QtMeOBq+S9nOaIkO+8iOWwhuadpeOBrkNsb3VkRnJvbnTliKnnlKjjga7jgZ/jgoHvvIlcbiAgaWYgKGNvbmZpZy5yZWdpb24gIT09ICd1cy1lYXN0LTEnKSB7XG4gICAgY29uc29sZS5sb2coJ1xcbvCfk40g44Ov44Kk44Or44OJ44Kr44O844OJ6Ki85piO5pu444KSdXMtZWFzdC0x44Gr5L2c5oiQ44GX44G+44GZ77yIQ2xvdWRGcm9udOWvvuW/nOOBruOBn+OCge+8ieOAgicpO1xuICAgIGNvbmZpZy5yZWdpb24gPSAndXMtZWFzdC0xJztcbiAgfVxuICBcbiAgLy8g44Ov44Kk44Or44OJ44Kr44O844OJ6Ki85piO5pu444Gn44GvQ2xvdWRGcm9udOODh+OCo+OCueODiOODquODk+ODpeODvOOCt+ODp+ODs+OBr+S9nOaIkOOBl+OBquOBhFxuICBpZiAoY29uZmlnLnVzZUNsb3VkRnJvbnQpIHtcbiAgICBjb25zb2xlLmxvZygn4pqg77iPICDjg6/jgqTjg6vjg4njgqvjg7zjg4noqLzmmI7mm7jjgafjga/oqLzmmI7mm7jjga7jgb/kvZzmiJDjgZfjgb7jgZnjgIInKTtcbiAgICBjb25zb2xlLmxvZygnICAgQ2xvdWRGcm9udOODh+OCo+OCueODiOODquODk+ODpeODvOOCt+ODp+ODs+OBr+S9nOaIkOOBleOCjOOBvuOBm+OCk+OAgicpO1xuICAgIGNvbmZpZy51c2VDbG91ZEZyb250ID0gZmFsc2U7XG4gIH1cbn0gZWxzZSB7XG4gIC8vIOmAmuW4uOOBruODieODoeOCpOODs+OBp0Nsb3VkRnJvbnTjgpLkvb/nlKjjgZnjgovloLTlkIjjga/oh6rli5XnmoTjgat1cy1lYXN0LTHjgpLkvb/nlKhcbiAgaWYgKGNvbmZpZy51c2VDbG91ZEZyb250ICYmIGNvbmZpZy5yZWdpb24gIT09ICd1cy1lYXN0LTEnKSB7XG4gICAgY29uc29sZS5sb2coJ1xcbvCfk40gQ2xvdWRGcm9udOeUqOOBq+ODquODvOOCuOODp+ODs+OCknVzLWVhc3QtMeOBq+iHquWLleioreWumuOBl+OBvuOBl+OBn+OAgicpO1xuICAgIGNvbmZpZy5yZWdpb24gPSAndXMtZWFzdC0xJztcbiAgfVxufVxuXG4vLyBHZW5lcmF0ZSB1bmlxdWUgc3RhY2sgbmFtZSBiYXNlZCBvbiBkb21haW5cbmNvbnN0IHN0YWNrTmFtZSA9IGBDZG5TdGFjay0ke2NvbmZpZy5kb21haW4ucmVwbGFjZSgvXFwuL2csICctJykucmVwbGFjZSgvXFwqL2csICd3aWxkY2FyZCcpfWA7XG5cbi8vIENyZWF0ZSB0aGUgQ0ROIHN0YWNrXG5uZXcgQ2RuU3RhY2soYXBwLCBzdGFja05hbWUsIHtcbiAgZW52OiB7XG4gICAgYWNjb3VudDogY29uZmlnLmFjY291bnQsXG4gICAgcmVnaW9uOiBjb25maWcucmVnaW9uXG4gIH0sXG4gIC4uLmNvbmZpZ1xufSk7XG5cbmFwcC5zeW50aCgpOyJdfQ==
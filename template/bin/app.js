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
    certificateArn: process.env.CERTIFICATE_ARN || app.node.tryGetContext('certificateArn'),
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
// Set certificate ARN in context if available
if (config.certificateArn) {
    app.node.setContext('certificateArn', config.certificateArn);
}
// Create the CDN stack
new cdn_stack_1.CdnStack(app, stackName, {
    env: {
        account: config.account,
        region: config.region
    },
    ...config
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLGlEQUFtQztBQUNuQywrQ0FBaUM7QUFDakMsZ0RBQTRDO0FBRTVDLDBFQUEwRTtBQUMxRSxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFFbEMsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsOERBQThEO0FBQzlELE1BQU0sTUFBTSxHQUFHO0lBQ2IsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDO0lBQzdFLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxJQUFJLGdCQUFnQjtJQUM5RixNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDO0lBQ25FLGNBQWMsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQztJQUN2RixhQUFhLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEtBQUssTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQztJQUMvRixVQUFVLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLElBQUksUUFBUTtJQUN2RixZQUFZLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDO0lBQ2pGLFVBQVUsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUM7SUFDM0UsYUFBYSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUM7SUFDL0YsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQztDQUNqRyxDQUFDO0FBRUYsa0NBQWtDO0FBQ2xDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDbkIsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO0FBQzNFLENBQUM7QUFFRCxJQUFJLE1BQU0sQ0FBQyxhQUFhLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUN0RCxNQUFNLElBQUksS0FBSyxDQUFDLGdHQUFnRyxDQUFDLENBQUM7QUFDcEgsQ0FBQztBQUVELGdCQUFnQjtBQUNoQixJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7SUFDbkMsOENBQThDO0lBQzlDLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUUsQ0FBQztRQUNsQyxPQUFPLENBQUMsR0FBRyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7UUFDakUsTUFBTSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7SUFDOUIsQ0FBQztJQUVELDBDQUEwQztJQUMxQyxJQUFJLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFDM0MsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDO0lBQy9CLENBQUM7QUFDSCxDQUFDO0tBQU0sQ0FBQztJQUNOLDZDQUE2QztJQUM3QyxJQUFJLE1BQU0sQ0FBQyxhQUFhLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxXQUFXLEVBQUUsQ0FBQztRQUMxRCxPQUFPLENBQUMsR0FBRyxDQUFDLDRDQUE0QyxDQUFDLENBQUM7UUFDMUQsTUFBTSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7SUFDOUIsQ0FBQztBQUNILENBQUM7QUFFRCw2Q0FBNkM7QUFDN0MsTUFBTSxTQUFTLEdBQUcsWUFBWSxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDO0FBRTdGLDhDQUE4QztBQUM5QyxJQUFJLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUMxQixHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDL0QsQ0FBQztBQUVELHVCQUF1QjtBQUN2QixJQUFJLG9CQUFRLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRTtJQUMzQixHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU87UUFDdkIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO0tBQ3RCO0lBQ0QsR0FBRyxNQUFNO0NBQ1YsQ0FBQyxDQUFDO0FBRUgsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGRvdGVudiBmcm9tICdkb3RlbnYnO1xuaW1wb3J0IHsgQ2RuU3RhY2sgfSBmcm9tICcuLi9saWIvY2RuLXN0YWNrJztcblxuLy8gTG9hZCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgd2l0aCBvdmVycmlkZSBvcHRpb24gdG8gcHJpb3JpdGl6ZSAuZW52IGZpbGVcbmRvdGVudi5jb25maWcoeyBvdmVycmlkZTogdHJ1ZSB9KTtcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IGNvbmZpZ3VyYXRpb24gZnJvbSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgb3IgQ0RLIGNvbnRleHRcbmNvbnN0IGNvbmZpZyA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCB8fCBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdhY2NvdW50JyksXG4gIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3JlZ2lvbicpIHx8ICdhcC1ub3J0aGVhc3QtMScsXG4gIGRvbWFpbjogcHJvY2Vzcy5lbnYuRE9NQUlOX05BTUUgfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZG9tYWluJyksXG4gIGNlcnRpZmljYXRlQXJuOiBwcm9jZXNzLmVudi5DRVJUSUZJQ0FURV9BUk4gfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnY2VydGlmaWNhdGVBcm4nKSxcbiAgdXNlQ2xvdWRGcm9udDogcHJvY2Vzcy5lbnYuVVNFX0NMT1VERlJPTlQgPT09ICd0cnVlJyB8fCBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd1c2VDbG91ZEZyb250JyksXG4gIG9yaWdpblR5cGU6IHByb2Nlc3MuZW52Lk9SSUdJTl9UWVBFIHx8IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ29yaWdpblR5cGUnKSB8fCAnczMtbmV3JyxcbiAgb3JpZ2luRG9tYWluOiBwcm9jZXNzLmVudi5PUklHSU5fRE9NQUlOIHx8IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ29yaWdpbkRvbWFpbicpLFxuICBvcmlnaW5QYXRoOiBwcm9jZXNzLmVudi5PUklHSU5fUEFUSCB8fCBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdvcmlnaW5QYXRoJyksXG4gIHVzZU1vbml0b3Jpbmc6IHByb2Nlc3MuZW52LlVTRV9NT05JVE9SSU5HID09PSAndHJ1ZScgfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgndXNlTW9uaXRvcmluZycpLFxuICBub3RpZmljYXRpb25FbWFpbDogcHJvY2Vzcy5lbnYuTk9USUZJQ0FUSU9OX0VNQUlMIHx8IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ25vdGlmaWNhdGlvbkVtYWlsJylcbn07XG5cbi8vIFZhbGlkYXRlIHJlcXVpcmVkIGNvbmZpZ3VyYXRpb25cbmlmICghY29uZmlnLmRvbWFpbikge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0RvbWFpbiBuYW1lIGlzIHJlcXVpcmVkLiBTZXQgRE9NQUlOX05BTUUgaW4gLmVudiBmaWxlJyk7XG59XG5cbmlmIChjb25maWcudXNlTW9uaXRvcmluZyAmJiAhY29uZmlnLm5vdGlmaWNhdGlvbkVtYWlsKSB7XG4gIHRocm93IG5ldyBFcnJvcignTm90aWZpY2F0aW9uIGVtYWlsIGlzIHJlcXVpcmVkIHdoZW4gbW9uaXRvcmluZyBpcyBlbmFibGVkLiBTZXQgTk9USUZJQ0FUSU9OX0VNQUlMIGluIC5lbnYgZmlsZScpO1xufVxuXG4vLyDjg6/jgqTjg6vjg4njgqvjg7zjg4noqLzmmI7mm7jjga7lh6bnkIZcbmlmIChjb25maWcuZG9tYWluLnN0YXJ0c1dpdGgoJyouJykpIHtcbiAgLy8g44Ov44Kk44Or44OJ44Kr44O844OJ6Ki85piO5pu444GvdXMtZWFzdC0x44Gr5L2c5oiQ77yI5bCG5p2l44GuQ2xvdWRGcm9udOWIqeeUqOOBruOBn+OCge+8iVxuICBpZiAoY29uZmlnLnJlZ2lvbiAhPT0gJ3VzLWVhc3QtMScpIHtcbiAgICBjb25zb2xlLmxvZygnXFxu8J+TjSDjg6/jgqTjg6vjg4njgqvjg7zjg4noqLzmmI7mm7jjgpJ1cy1lYXN0LTHjgavkvZzmiJDjgZfjgb7jgZnvvIhDbG91ZEZyb2505a++5b+c44Gu44Gf44KB77yJ44CCJyk7XG4gICAgY29uZmlnLnJlZ2lvbiA9ICd1cy1lYXN0LTEnO1xuICB9XG4gIFxuICAvLyDjg6/jgqTjg6vjg4njgqvjg7zjg4noqLzmmI7mm7jjgafjga9DbG91ZEZyb25044OH44Kj44K544OI44Oq44OT44Ol44O844K344On44Oz44Gv5L2c5oiQ44GX44Gq44GEXG4gIGlmIChjb25maWcudXNlQ2xvdWRGcm9udCkge1xuICAgIGNvbnNvbGUubG9nKCfimqDvuI8gIOODr+OCpOODq+ODieOCq+ODvOODieiovOaYjuabuOOBp+OBr+iovOaYjuabuOOBruOBv+S9nOaIkOOBl+OBvuOBmeOAgicpO1xuICAgIGNvbnNvbGUubG9nKCcgICBDbG91ZEZyb25044OH44Kj44K544OI44Oq44OT44Ol44O844K344On44Oz44Gv5L2c5oiQ44GV44KM44G+44Gb44KT44CCJyk7XG4gICAgY29uZmlnLnVzZUNsb3VkRnJvbnQgPSBmYWxzZTtcbiAgfVxufSBlbHNlIHtcbiAgLy8g6YCa5bi444Gu44OJ44Oh44Kk44Oz44GnQ2xvdWRGcm9udOOCkuS9v+eUqOOBmeOCi+WgtOWQiOOBr+iHquWLleeahOOBq3VzLWVhc3QtMeOCkuS9v+eUqFxuICBpZiAoY29uZmlnLnVzZUNsb3VkRnJvbnQgJiYgY29uZmlnLnJlZ2lvbiAhPT0gJ3VzLWVhc3QtMScpIHtcbiAgICBjb25zb2xlLmxvZygnXFxu8J+TjSBDbG91ZEZyb25055So44Gr44Oq44O844K444On44Oz44KSdXMtZWFzdC0x44Gr6Ieq5YuV6Kit5a6a44GX44G+44GX44Gf44CCJyk7XG4gICAgY29uZmlnLnJlZ2lvbiA9ICd1cy1lYXN0LTEnO1xuICB9XG59XG5cbi8vIEdlbmVyYXRlIHVuaXF1ZSBzdGFjayBuYW1lIGJhc2VkIG9uIGRvbWFpblxuY29uc3Qgc3RhY2tOYW1lID0gYENkblN0YWNrLSR7Y29uZmlnLmRvbWFpbi5yZXBsYWNlKC9cXC4vZywgJy0nKS5yZXBsYWNlKC9cXCovZywgJ3dpbGRjYXJkJyl9YDtcblxuLy8gU2V0IGNlcnRpZmljYXRlIEFSTiBpbiBjb250ZXh0IGlmIGF2YWlsYWJsZVxuaWYgKGNvbmZpZy5jZXJ0aWZpY2F0ZUFybikge1xuICBhcHAubm9kZS5zZXRDb250ZXh0KCdjZXJ0aWZpY2F0ZUFybicsIGNvbmZpZy5jZXJ0aWZpY2F0ZUFybik7XG59XG5cbi8vIENyZWF0ZSB0aGUgQ0ROIHN0YWNrXG5uZXcgQ2RuU3RhY2soYXBwLCBzdGFja05hbWUsIHtcbiAgZW52OiB7XG4gICAgYWNjb3VudDogY29uZmlnLmFjY291bnQsXG4gICAgcmVnaW9uOiBjb25maWcucmVnaW9uXG4gIH0sXG4gIC4uLmNvbmZpZ1xufSk7XG5cbmFwcC5zeW50aCgpOyJdfQ==
# CloudFront Integration Example

This example demonstrates how to create a complete CDN setup with CloudFront and ACM certificates.

## Features

- ACM certificate in us-east-1 for CloudFront
- CloudFront distribution with custom domain
- S3 bucket as origin
- HTTPS enforcement

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your environment:
```bash
export CDN_DOMAIN_NAME=cdn.your-domain.com
export S3_BUCKET_NAME=my-static-assets
```

3. Deploy the stacks:
```bash
npm run deploy
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│   ACM Cert      │────▶│  CloudFront  │────▶│  S3 Bucket   │
│  (us-east-1)    │     │ Distribution │     │   (Origin)   │
└─────────────────┘     └──────────────┘     └──────────────┘
```

## DNS Configuration

After deployment, you'll need to:
1. Create a CNAME record pointing your domain to the CloudFront distribution
2. Complete ACM certificate validation
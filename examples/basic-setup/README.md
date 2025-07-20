# Basic Setup Example

This example shows the minimal configuration needed to create an ACM certificate using create-cdn.

## Prerequisites

- AWS account with appropriate permissions
- Domain name you control
- AWS CLI configured with credentials

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure your domain:

```bash
export DOMAIN_NAME=your-domain.com
```

3. Deploy:

```bash
npm run deploy
```

4. Complete DNS validation by adding the CNAME records shown in the AWS Console.

## Files

- `app.ts` - Main CDK application
- `package.json` - Dependencies and scripts
- `cdk.json` - CDK configuration
- `tsconfig.json` - TypeScript configuration

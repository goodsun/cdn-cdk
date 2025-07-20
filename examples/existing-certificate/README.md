# Using Existing Certificates Example

This example demonstrates how to reference and use existing ACM certificates with create-cdn.

## Use Cases

- Migrating existing infrastructure to CDK
- Using certificates managed outside of CDK
- Sharing certificates across multiple stacks

## Prerequisites

- Existing ACM certificate ARN
- Certificate must be in the correct region:
  - us-east-1 for CloudFront
  - Same region as your stack for ALB/API Gateway

## Configuration

Set the certificate ARN:

```bash
export EXISTING_CERT_ARN=arn:aws:acm:us-east-1:123456789012:certificate/abc-123-def
```

## Code Example

The example shows how to:

1. Reference an existing certificate by ARN
2. Create monitoring for the existing certificate
3. Use the certificate in other AWS resources

## Important Notes

- The certificate won't be managed by CDK (no updates or deletion)
- Ensure the certificate is valid and not expiring
- You're responsible for certificate renewal

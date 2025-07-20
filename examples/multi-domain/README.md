# Multi-Domain Certificate Example

This example shows how to create ACM certificates with multiple domain names (Subject Alternative Names).

## Use Cases

- Single certificate for multiple subdomains
- Wildcard certificates
- Multiple top-level domains

## Configuration

Create a `domains.json` file:

```json
{
  "primary": "example.com",
  "alternatives": [
    "*.example.com",
    "api.example.com",
    "www.example.com",
    "example.net",
    "www.example.net"
  ]
}
```

## Deployment

```bash
npm install
npm run deploy
```

## Notes

- All domain names must be validated
- Wildcard domains require DNS validation
- Maximum 10 SANs per certificate (AWS limit)
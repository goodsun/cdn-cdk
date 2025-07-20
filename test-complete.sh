#!/bin/bash
# Test script for create-cdn

# API Gateway scenario
(
  echo "test-complete"              # project name
  echo "api.example.com"            # domain
  echo "Y"                          # use CloudFront
  echo "5"                          # API Gateway
  echo "example-api.execute-api.ap-northeast-1.amazonaws.com"  # origin domain
  echo "/prod"                      # origin path
  echo "Y"                          # use monitoring
  echo "admin@example.com"          # email
) | node bin/create-cdn.js
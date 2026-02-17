---
name: Security Review
description: Focused security review for vulnerabilities and best practices
trigger:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.py"
  - "**/*.go"
  - "**/*.java"
  - "**/routes/**"
  - "**/api/**"
  - "**/auth/**"
priority: high
---

# Security Review Skill

Focus exclusively on security vulnerabilities and best practices.

## Authentication & Authorization

- [ ] Authentication checks on all protected routes
- [ ] Authorization checks before sensitive operations
- [ ] Session management secure
- [ ] Password/credential handling secure

## Input Validation

- [ ] All user input validated and sanitized
- [ ] No direct string interpolation in queries
- [ ] File uploads validated (type, size, content)
- [ ] URL parameters sanitized

## Common Vulnerabilities

- **SQL Injection**: Use parameterized queries
- **XSS**: Escape output, use CSP headers
- **CSRF**: Include CSRF tokens
- **SSRF**: Whitelist allowed URLs
- **Path Traversal**: Validate file paths
- **Command Injection**: Avoid shell commands with user input

## Data Protection

- [ ] Sensitive data encrypted at rest
- [ ] HTTPS for data in transit
- [ ] No secrets in code or logs
- [ ] PII handled per regulations

## Dependencies

- [ ] No known vulnerable dependencies
- [ ] Lock files present and valid

## Security Headers

For web applications:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

## Severity Guide

🚨 **Critical**: Active vulnerability, immediate fix required
⚠️ **Warning**: Security concern, should fix soon
💡 **Info**: Best practice recommendation
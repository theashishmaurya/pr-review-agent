---
name: Backend Review
description: Backend API, database, and server-side code review
trigger:
  - "**/api/**"
  - "**/server/**"
  - "**/routes/**"
  - "**/*.go"
  - "**/main.go"
  - "**/handler/**"
  - "**/service/**"
  - "**/repository/**"
priority: high
---

# Backend Review Skill

Review backend code for reliability, performance, and API design.

## API Design

### RESTful Principles
- [ ] Correct HTTP methods (GET, POST, PUT, DELETE)
- [ ] Proper status codes
- [ ] Consistent response format
- [ ] Pagination for list endpoints
- [ ] Filtering and sorting support

### Error Handling
- [ ] Meaningful error messages
- [ ] Proper HTTP status codes
- [ ] Error responses structured
- [ ] Stack traces hidden in production

## Database

### Queries
- [ ] N+1 queries identified and fixed
- [ ] Indexes used appropriately
- [ ] Transactions for related operations
- [ ] Pagination for large result sets
- [ ] Query timeouts configured

### Data Integrity
- [ ] Constraints at database level
- [ ] Foreign keys properly defined
- [ ] Cascade deletes/deletes considered
- [ ] Soft deletes vs hard deletes

## Performance

- [ ] Connection pooling configured
- [ ] Caching for frequently accessed data
- [ ] Background jobs for slow operations
- [ ] Request timeout configured
- [ ] Rate limiting implemented

## Reliability

- [ ] Graceful shutdown implemented
- [ ] Health check endpoints
- [ ] Logging structured (JSON)
- [ ] Metrics exposed
- [ ] Error tracking configured

## Security

- [ ] Input validation on all endpoints
- [ ] Authentication middleware
- [ ] Authorization checks
- [ ] Rate limiting
- [ ] CORS configured properly

## Code Structure

### Layered Architecture
```
handlers/  -> HTTP handling, validation
services/  -> Business logic
repositories/ -> Data access
```

- [ ] Handlers thin, services contain logic
- [ ] Dependency injection
- [ ] Interfaces for external dependencies
- [ ] Single responsibility

### Error Handling
```go
// ❌ Swallowing errors
if err != nil {
    log.Println(err)
    return nil
}

// ✅ Proper error handling
if err != nil {
    return fmt.Errorf("failed to create user: %w", err)
}
```

## Severity Guide

🚨 **Error**: Data loss, security vulnerability, crash
⚠️ **Warning**: Performance issue, anti-pattern
💡 **Info**: Code quality, maintainability
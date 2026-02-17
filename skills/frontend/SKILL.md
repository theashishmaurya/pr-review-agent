---
name: Frontend Review
description: React/TypeScript frontend code patterns and best practices
trigger:
  - "**/*.tsx"
  - "**/*.ts"
  - "**/*.jsx"
  - "**/*.js"
  - "**/*.css"
  - "**/*.scss"
priority: high
---

# Frontend Review Skill

Review React/TypeScript code for patterns, performance, and accessibility.

## React Patterns

### Hooks
- [ ] Correct dependency arrays in useEffect, useMemo, useCallback
- [ ] No stale closures in event handlers
- [ ] Custom hooks follow naming convention (use*)
- [ ] Rules of Hooks followed

### State Management
- [ ] State minimized (derived values computed)
- [ ] Lifting state up when needed
- [ ] Proper use of context vs prop drilling
- [ ] State updates immutable

### Performance
- [ ] React.memo when appropriate
- [ ] useMemo for expensive computations
- [ ] useCallback for event handlers passed to children
- [ ] List items have stable keys
- [ ] No inline object/array creation in render

### Component Structure
- [ ] Single responsibility per component
- [ ] Component composition over inheritance
- [ ] Props interface defined for TypeScript
- [ ] Default values for optional props

## TypeScript

- [ ] No `any` types without justification
- [ ] Proper null/undefined handling
- [ ] Generic constraints when needed
- [ ] Type guards for runtime checks
- [ ] Exported types for public APIs

## Accessibility (a11y)

- [ ] Images have alt text
- [ ] Form inputs have labels
- [ ] Focus management
- [ ] ARIA attributes when semantic HTML insufficient
- [ ] Color contrast sufficient
- [ ] Keyboard navigation works

## CSS/Styling

- [ ] No inline styles for dynamic values (use CSS variables)
- [ ] Responsive design for mobile
- [ ] No magic numbers (use design tokens)
- [ ] Proper z-index layering

## Common Issues

### Memory Leaks
```tsx
// ❌ Missing cleanup
useEffect(() => {
  subscribe(id, callback);
}, []);

// ✅ With cleanup
useEffect(() => {
  return subscribe(id, callback);
}, []);
```

### Stale State
```tsx
// ❌ Stale closure
const handleClick = () => console.log(count);

// ✅ Use ref or state updater
const countRef = useRef(count);
const handleClick = () => console.log(countRef.current);
```

## Severity Guide

🚨 **Error**: Runtime bugs, security issues, broken functionality
⚠️ **Warning**: Performance issues, anti-patterns
💡 **Info**: Style improvements, best practices
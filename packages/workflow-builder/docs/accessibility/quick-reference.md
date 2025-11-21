# Accessibility Quick Reference Guide

A quick reference for maintaining WCAG 2.1 AA compliance in the Workflow Builder.

## Daily Development Checklist

When creating or modifying components, verify:

- [ ] Component is keyboard accessible (Tab, Enter, Space, Arrow keys)
- [ ] Focus state is visible
- [ ] ARIA labels on interactive elements
- [ ] Color contrast meets 4.5:1 (normal text) or 3:1 (large text)
- [ ] Error messages are clear and actionable
- [ ] Loading states use proper ARIA attributes
- [ ] Forms have associated labels
- [ ] Images have alt text (or alt="" if decorative)

## Common Patterns

### Buttons

```tsx
// Good ✅
<Button aria-label="Close dialog">
  <X />
</Button>

// Also Good ✅
<Button>
  Close
</Button>

// Bad ❌
<div onClick={handleClick}>
  Close
</div>
```

### Form Inputs

```tsx
// Good ✅
<YStack>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" aria-required="true" />
</YStack>

// Also Good ✅
<Input aria-label="Email address" type="email" />

// Bad ❌
<Input placeholder="Email" />  // Placeholder alone is not enough
```

### Loading States

```tsx
// Good ✅
import { LoadingState } from '@/components/shared/LoadingState';

<LoadingState message="Loading workflows..." />

// Also Good ✅
<YStack role="status" aria-live="polite" aria-busy="true">
  <Spinner />
  <Text>Loading...</Text>
</YStack>

// Bad ❌
<Spinner />  // No context for screen readers
```

### Error Messages

```tsx
// Good ✅
import { ErrorState } from '@/components/shared/ErrorState';

<ErrorState
  message="Failed to save workflow"
  onRetry={handleRetry}
/>

// Also Good ✅
<YStack role="alert" aria-live="assertive">
  <Text>Error: Failed to save</Text>
  <Button onClick={retry}>Try Again</Button>
</YStack>

// Bad ❌
<Text color="red">Error!</Text>  // No ARIA role
```

### Success Messages

```tsx
// Good ✅
import { SuccessState } from '@/components/shared/SuccessState';

<SuccessState
  message="Workflow saved successfully"
  autoDismiss
/>

// Also Good ✅
<YStack role="status" aria-live="polite">
  <Text>Success!</Text>
</YStack>
```

### Modals/Dialogs

```tsx
// Good ✅
<Dialog
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <Text id="dialog-title">Confirm Delete</Text>
  <Text id="dialog-description">
    Are you sure you want to delete this workflow?
  </Text>
  <Button>Cancel</Button>
  <Button>Delete</Button>
</Dialog>

// Bad ❌
<div className="modal">  // No ARIA attributes
  <Text>Delete?</Text>
</div>
```

### Navigation

```tsx
// Good ✅
<nav aria-label="Main navigation">
  <a href="/workflows">Workflows</a>
  <a href="/projects">Projects</a>
</nav>

// Bad ❌
<div className="nav">  // Not semantic
  <div onClick={goTo}>Workflows</div>
</div>
```

### Lists

```tsx
// Good ✅
<ul role="list">
  <li>Workflow 1</li>
  <li>Workflow 2</li>
</ul>

// Also Good ✅
<YStack role="list">
  <YStack role="listitem">Item 1</YStack>
  <YStack role="listitem">Item 2</YStack>
</YStack>

// Bad ❌
<div>  // No semantic meaning
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

### Images and Icons

```tsx
// Good ✅
<img src="workflow.png" alt="Sample workflow diagram" />
<AlertCircle aria-hidden="true" />  // Decorative
<CheckCircle aria-label="Success" />  // Meaningful

// Bad ❌
<img src="workflow.png" />  // No alt text
<AlertCircle />  // Unclear if decorative
```

## Keyboard Navigation

### Standard Keys

| Key | Action |
|-----|--------|
| Tab | Move to next focusable element |
| Shift + Tab | Move to previous focusable element |
| Enter | Activate button/link |
| Space | Activate button |
| Escape | Close modal/cancel |
| Arrow Keys | Navigate lists/menus |

### Testing Keyboard Navigation

1. Press Tab - Does focus move logically?
2. Is focus visible?
3. Can you reach all interactive elements?
4. Can you activate with Enter/Space?
5. Can you close modals with Escape?

## Color Contrast

### Minimum Ratios (WCAG AA)
- **Normal text (< 18pt)**: 4.5:1
- **Large text (≥ 18pt or 14pt bold)**: 3:1
- **UI components**: 3:1

### Quick Check
```bash
# Use browser DevTools or online checkers:
# https://webaim.org/resources/contrastchecker/
```

### Pre-approved Colors

| Use Case | Color | Contrast Ratio |
|----------|-------|----------------|
| Body text | #1a1a1a on #ffffff | 16.7:1 ✅ |
| Primary button | #ffffff on #0066cc | 7.1:1 ✅ |
| Error text | #c70000 on #ffffff | 7.5:1 ✅ |
| Success text | #006400 on #ffffff | 6.8:1 ✅ |
| Link text | #0066cc on #ffffff | 7.1:1 ✅ |

## ARIA Attributes

### Common ARIA Attributes

| Attribute | Use Case | Example |
|-----------|----------|---------|
| `aria-label` | Label when no visible text | `<button aria-label="Close">×</button>` |
| `aria-labelledby` | Reference to label element | `<div aria-labelledby="title">` |
| `aria-describedby` | Reference to description | `<input aria-describedby="hint">` |
| `aria-hidden` | Hide from screen readers | `<icon aria-hidden="true" />` |
| `aria-live` | Announce changes | `<div aria-live="polite">` |
| `aria-busy` | Loading state | `<div aria-busy="true">` |
| `aria-invalid` | Error state | `<input aria-invalid="true">` |
| `aria-required` | Required field | `<input aria-required="true">` |
| `aria-expanded` | Expandable state | `<button aria-expanded="false">` |
| `aria-pressed` | Toggle state | `<button aria-pressed="true">` |

### ARIA Live Regions

```tsx
// Polite - doesn't interrupt
<div aria-live="polite">
  Workflow saved
</div>

// Assertive - interrupts
<div aria-live="assertive">
  Error: Connection lost
</div>

// Off - no announcement
<div aria-live="off">
  Background process running
</div>
```

## Focus Management

### Focus Styles (Already Implemented)

Focus states are automatically applied via `/src/styles/accessibility.css`:

```css
/* Keyboard-only focus */
*:focus-visible {
  outline: 2px solid hsl(210, 100%, 50%);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px hsla(210, 100%, 50%, 0.1);
}
```

### Custom Focus (If Needed)

```css
.custom-element:focus-visible {
  outline: 2px solid var(--blue-10);
  outline-offset: 2px;
}
```

### Focus Trap (Modals)

```tsx
// Let Tamagui Dialog handle focus trap automatically
<Dialog modal>
  {/* Focus is trapped inside */}
</Dialog>

// Or manually manage focus
useEffect(() => {
  const firstButton = dialogRef.current?.querySelector('button');
  firstButton?.focus();
}, [isOpen]);
```

## Testing

### Quick Manual Test

1. **Keyboard**: Tab through page, verify all elements are reachable
2. **Focus**: Verify focus is visible on all elements
3. **Screen Reader**: Enable VoiceOver (Cmd+F5) and navigate
4. **Contrast**: Use browser DevTools to check colors
5. **Mobile**: Test touch targets are ≥ 44x44px

### Automated Test

```bash
# Run accessibility tests
npm run test:e2e -- tests/e2e/accessibility/

# Run specific test
npm run test:e2e -- tests/e2e/accessibility/workflow-builder.spec.ts
```

### Browser Extensions

- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/extension/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

## Common Mistakes

### ❌ Don't Do This

```tsx
// Missing ARIA label
<button>×</button>

// Div as button
<div onClick={handler}>Click me</div>

// Placeholder as label
<input placeholder="Email" />

// No focus state
.button:focus { outline: none; }

// Hard-coded colors without contrast check
<Text color="#888">#888 on white</Text>

// Icon without context
<AlertCircle />

// Missing alt text
<img src="chart.png" />

// No keyboard support
<div onClick={handler}>Interactive element</div>
```

### ✅ Do This Instead

```tsx
// With ARIA label
<button aria-label="Close">×</button>

// Semantic button
<button onClick={handler}>Click me</button>

// Label + input
<Label htmlFor="email">Email</Label>
<input id="email" placeholder="you@example.com" />

// Focus state included
// (Already handled by accessibility.css)

// Pre-approved color
<Text color="$gray11">High contrast text</Text>

// Icon with context
<AlertCircle aria-label="Warning" />
// or
<AlertCircle aria-hidden="true" />
<Text>Warning</Text>

// With alt text
<img src="chart.png" alt="Monthly sales chart" />

// With keyboard support
<button onClick={handler}>Interactive element</button>
```

## Screen Reader Testing

### macOS VoiceOver

```bash
# Enable VoiceOver
Cmd + F5

# Navigate
VO + Arrow keys  # VO = Control + Option

# Rotor (landmarks, headings, links)
VO + U

# Disable
Cmd + F5
```

### Windows NVDA

```bash
# Start NVDA
Control + Alt + N

# Navigate
Arrow keys

# Elements list
NVDA + F7

# Stop
NVDA + Q
```

## Resources

### Quick Links
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Examples](https://www.w3.org/WAI/ARIA/apg/)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Internal Docs
- Full compliance report: `/docs/accessibility/wcag-compliance.md`
- Implementation summary: `/docs/accessibility/implementation-summary.md`
- Test suite: `/tests/e2e/accessibility/workflow-builder.spec.ts`

## Questions?

If you're unsure about accessibility:
1. Check this guide
2. Review the WCAG compliance doc
3. Look at existing components for patterns
4. Test with keyboard and screen reader
5. Ask the team!

---

**Remember**: Accessibility is not optional - it's a requirement for production deployment.

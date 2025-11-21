# Accessibility Documentation

This directory contains all accessibility-related documentation for the Workflow Builder application.

## Documents

### [wcag-compliance.md](./wcag-compliance.md)
**WCAG 2.1 Level AA Compliance Report**

Comprehensive documentation of WCAG 2.1 Level AA compliance including:
- Detailed breakdown of all 4 principles (Perceivable, Operable, Understandable, Robust)
- Color contrast ratios and verification
- Testing methodology and results
- ARIA implementation details
- Maintenance procedures
- Resources and guidelines

**Use this when**: You need to verify compliance, prepare for audits, or understand accessibility requirements.

### [implementation-summary.md](./implementation-summary.md)
**Implementation Summary and Technical Details**

Technical documentation of the accessibility implementation including:
- Complete list of deliverables
- Files created and modified
- Code examples and usage patterns
- Testing infrastructure details
- Performance considerations
- Browser and screen reader support
- Known limitations and next steps

**Use this when**: You need to understand what was implemented, how to use components, or continue development work.

### [quick-reference.md](./quick-reference.md)
**Developer Quick Reference Guide**

Practical guide for day-to-day development including:
- Daily development checklist
- Common patterns (buttons, forms, loading states, etc.)
- Keyboard navigation guide
- Color contrast quick reference
- ARIA attributes reference
- Common mistakes and solutions
- Screen reader testing instructions

**Use this when**: You're developing features and need quick guidance on accessibility best practices.

## Key Features Implemented

### ✅ Automated Testing
- axe-core integration for WCAG compliance scanning
- 33 comprehensive test cases
- Zero-violation target
- CI/CD integration ready

### ✅ Keyboard Navigation
- Full keyboard accessibility
- Visible focus indicators
- Skip to main content link
- Logical tab order

### ✅ Screen Reader Support
- Proper ARIA labels and roles
- Live regions for dynamic content
- Semantic HTML structure
- Descriptive page titles

### ✅ Visual Accessibility
- WCAG AA color contrast (4.5:1+)
- Focus states on all interactive elements
- High contrast mode support
- Reduced motion support

### ✅ UI Components
- LoadingState - Accessible loading indicators
- ErrorState - Clear error messages with recovery
- SuccessState - Visual success feedback
- Consistent state management

## Quick Start

### Running Tests

```bash
# Run all accessibility tests
npm run test:e2e -- tests/e2e/accessibility/

# Run with UI for debugging
npm run test:e2e:ui -- tests/e2e/accessibility/
```

### Using Shared Components

```tsx
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SuccessState } from '@/components/shared/SuccessState';

// Loading
<LoadingState message="Loading workflows..." />

// Error
<ErrorState
  message="Failed to load"
  onRetry={refetch}
/>

// Success
<SuccessState
  message="Saved successfully!"
  autoDismiss
/>
```

### Checking Compliance

```tsx
import { runAccessibilityScan } from '@/tests/e2e/helpers/accessibility';

// In your tests
const results = await runAccessibilityScan(page, {
  tags: ['wcag2a', 'wcag2aa'],
});

expect(results.violations).toEqual([]);
```

## File Structure

```
docs/accessibility/
├── README.md                    # This file
├── wcag-compliance.md           # Full WCAG 2.1 AA compliance report
├── implementation-summary.md    # Technical implementation details
└── quick-reference.md           # Developer quick reference

src/
├── styles/
│   └── accessibility.css        # Global accessibility styles
└── components/
    └── shared/
        ├── LoadingState.tsx     # Loading component
        ├── ErrorState.tsx       # Error component
        └── SuccessState.tsx     # Success component

tests/
└── e2e/
    ├── accessibility/
    │   └── workflow-builder.spec.ts  # A11y test suite
    └── helpers/
        └── accessibility.ts     # Testing helpers
```

## Common Tasks

### I want to...

**...ensure my new component is accessible**
→ See [quick-reference.md](./quick-reference.md) - Daily Development Checklist

**...understand color contrast requirements**
→ See [wcag-compliance.md](./wcag-compliance.md) - Section 1.4 Distinguishable

**...add ARIA labels properly**
→ See [quick-reference.md](./quick-reference.md) - ARIA Attributes section

**...test keyboard navigation**
→ See [quick-reference.md](./quick-reference.md) - Testing section

**...show loading/error states**
→ See [implementation-summary.md](./implementation-summary.md) - How to Use section

**...understand what was implemented**
→ See [implementation-summary.md](./implementation-summary.md) - Overview

**...verify WCAG compliance**
→ See [wcag-compliance.md](./wcag-compliance.md) - Full report

## Standards and Guidelines

### WCAG 2.1 Level AA
The application complies with WCAG 2.1 Level AA, which requires:

- **Perceivable**: Information presented in multiple ways
- **Operable**: Functionality available via keyboard
- **Understandable**: Clear, consistent interface
- **Robust**: Compatible with assistive technologies

### Minimum Requirements

| Requirement | Standard | Our Implementation |
|-------------|----------|-------------------|
| Color Contrast (normal) | 4.5:1 | 6.8:1+ (AAA) ✅ |
| Color Contrast (large) | 3:1 | 6.8:1+ (AAA) ✅ |
| Touch Target Size | 44x44px | 44x44px ✅ |
| Focus Indicator | Visible | 2px + shadow ✅ |
| Keyboard Access | 100% | 100% ✅ |
| Screen Reader | Compatible | Full support ✅ |

## Testing Tools

### Automated
- **axe-core**: Built into test suite
- **Lighthouse**: Browser DevTools
- **WAVE**: Browser extension

### Manual
- **Keyboard**: Tab through interface
- **VoiceOver**: macOS screen reader (Cmd+F5)
- **NVDA**: Windows screen reader (free)
- **Color Contrast Analyzer**: Verify colors

## Support and Questions

### Getting Help
1. Check [quick-reference.md](./quick-reference.md) for common patterns
2. Review [wcag-compliance.md](./wcag-compliance.md) for guidelines
3. Look at existing components for examples
4. Test with keyboard and screen reader
5. Ask the team in #accessibility channel

### Reporting Issues
When reporting accessibility issues, include:
- Specific page/component affected
- Browser and assistive technology used
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/recordings if helpful

Label issues with: `accessibility`

## Maintenance

### Regular Tasks
- ✅ Run automated tests before each deployment
- ✅ Manual keyboard test for new features
- ✅ Screen reader spot-check quarterly
- ✅ Color contrast review for new designs
- ✅ Update documentation as needed

### Continuous Improvement
- Monitor user feedback on accessibility
- Stay current with WCAG updates
- Add new test cases as features evolve
- Improve documentation based on team needs

## Resources

### Official Guidelines
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Checklist](https://webaim.org/standards/wcag/checklist)

### Tools and Testing
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Extension](https://wave.webaim.org/extension/)
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [NVDA Screen Reader](https://www.nvaccess.org/)

### Learning Resources
- [A11y Project](https://www.a11yproject.com/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Inclusive Components](https://inclusive-components.design/)

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-19 | 1.0.0 | Initial implementation - Full WCAG 2.1 AA compliance |

---

**Maintained by**: Frontend Engineering Team
**Last Updated**: 2025-11-19
**Next Review**: 2025-12-19

For questions or updates, contact the accessibility lead or create an issue.

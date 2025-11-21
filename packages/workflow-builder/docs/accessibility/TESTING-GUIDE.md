# Accessibility Testing Guide

Complete guide for testing accessibility compliance in the Workflow Builder application.

## Quick Start

### Prerequisites
1. Development server running on port 3010
2. Test authentication configured
3. Playwright installed

### Running Tests

```bash
# Start dev server (in one terminal)
npm run dev

# Run accessibility tests (in another terminal)
npm run test:a11y

# Run with UI for debugging
npm run test:a11y:ui

# Generate HTML report
npm run test:a11y:report
```

## Automated Testing

### Test Suite Overview

**Location**: `/tests/e2e/accessibility/workflow-builder.spec.ts`
**Test Count**: 33 tests across 11 test suites
**Coverage**: WCAG 2.1 Level AA compliance

### Test Suites

#### 1. Accessibility - Workflow List Page
- ✅ No accessibility violations
- ✅ Keyboard navigation support
- ✅ Proper heading hierarchy

#### 2. Accessibility - Workflow Builder Canvas
- ✅ No accessibility violations
- ✅ Accessible buttons with ARIA labels
- ✅ Keyboard navigation for primary actions
- ✅ Proper form labels

#### 3. Accessibility - Node Property Panel
- ✅ No accessibility violations
- ✅ Proper ARIA roles for dialogs
- ✅ Escape key to close modals

#### 4. Accessibility - Color Contrast
- ✅ WCAG AA color contrast requirements
- ✅ Sufficient contrast for text elements

#### 5. Accessibility - Keyboard Navigation
- ✅ Tab navigation through all elements
- ✅ Arrow key navigation in lists
- ✅ Focus trap in modal dialogs

#### 6. Accessibility - Screen Reader Support
- ✅ Proper landmark regions
- ✅ Descriptive page titles
- ✅ Loading state announcements
- ✅ Skip navigation links

#### 7. Accessibility - Focus Management
- ✅ Visible focus indicators
- ✅ Focus order matches visual order
- ✅ Focus restoration after modal closes

#### 8. Accessibility - Forms and Inputs
- ✅ Accessible error messages
- ✅ Labels associated with form controls
- ✅ Helpful placeholder text

#### 9. Accessibility - Images and Media
- ✅ Alt text for all images
- ✅ Accessible SVG icons

#### 10. Accessibility - Mobile and Responsive
- ✅ No accessibility issues on mobile viewport
- ✅ Touch-friendly tap targets (44x44px minimum)

#### 11. Accessibility - ARIA Best Practices
- ✅ Semantic HTML over ARIA
- ✅ No invalid ARIA attributes
- ✅ Valid ARIA roles

### Running Specific Tests

```bash
# Run single test suite
npm run test:a11y -- --grep "Workflow List Page"

# Run with specific browser
npm run test:a11y -- --project=chromium

# Run in headed mode (see browser)
npm run test:a11y -- --headed

# Debug mode
npm run test:a11y -- --debug

# Update snapshots
npm run test:a11y -- --update-snapshots
```

## Manual Testing

### Keyboard Navigation Test

**Goal**: Verify all functionality is accessible via keyboard only.

**Steps**:
1. Open application in browser
2. **DO NOT use mouse** - keyboard only
3. Start at top of page
4. Press **Tab** repeatedly
5. Verify:
   - Can reach all interactive elements
   - Focus is always visible
   - Tab order is logical (matches visual layout)
   - Can activate elements with Enter or Space
   - Can close modals with Escape

**Expected Results**:
- ✅ All buttons, links, inputs reachable via Tab
- ✅ Focus indicator is clearly visible (blue outline + shadow)
- ✅ Skip to main content link appears on first Tab
- ✅ Tab order matches left-to-right, top-to-bottom
- ✅ No keyboard traps (can always Tab away)

**Pass/Fail Checklist**:
- [ ] Skip link works (Tab, then Enter)
- [ ] All navigation items reachable
- [ ] All buttons in workflow list reachable
- [ ] Property panel controls reachable
- [ ] Can close property panel with button or Escape
- [ ] Form inputs all reachable and editable
- [ ] Modals can be closed with Escape

### Screen Reader Test

#### macOS - VoiceOver

**Setup**:
```bash
# Enable VoiceOver
Cmd + F5

# VoiceOver key = VO = Control + Option
```

**Navigation**:
- **VO + Arrow keys**: Navigate elements
- **VO + U**: Open rotor (landmarks, headings, links)
- **VO + A**: Read all
- **Control**: Stop reading

**What to Listen For**:
1. **Page title announced**: "Workflow Builder - ..."
2. **Landmarks announced**: "main content", "navigation", "complementary"
3. **Buttons announced**: "Close properties panel, button"
4. **Form labels announced**: "Email, edit text"
5. **Loading states**: "Loading..., status, busy"
6. **Error messages**: "Error: ..., alert"
7. **Success messages**: "Success! status"

**Test Checklist**:
- [ ] Page title makes sense
- [ ] Main content region identified
- [ ] Navigation clearly identified
- [ ] All buttons have clear labels
- [ ] All form inputs have labels
- [ ] Images have alt text or marked decorative
- [ ] Loading states announced
- [ ] Errors announced immediately
- [ ] Success messages announced

#### Windows - NVDA

**Setup**:
```bash
# Start NVDA
Control + Alt + N

# Stop NVDA
Insert + Q (then Enter to confirm)
```

**Navigation**:
- **Arrow keys**: Navigate elements
- **Insert + F7**: Elements list
- **H**: Next heading
- **B**: Next button
- **F**: Next form field
- **L**: Next link

**Same checklist as VoiceOver above**.

### Color Contrast Test

**Tools**:
- Chrome DevTools (built-in)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/) (desktop app)

**Using Chrome DevTools**:
1. Right-click element → Inspect
2. In Styles panel, find color property
3. Click color swatch
4. Look for "Contrast ratio" section
5. Verify:
   - **AA**: Ratio ≥ 4.5:1 (normal text) or 3:1 (large text)
   - **AAA**: Ratio ≥ 7:1 (normal text) or 4.5:1 (large text)

**Elements to Check**:
- [ ] Body text on background
- [ ] Link text on background
- [ ] Button text on button background
- [ ] Error messages
- [ ] Success messages
- [ ] Placeholder text
- [ ] Disabled text
- [ ] Icon colors

**Our Standards** (all AAA compliant):
| Element | Expected Ratio | Actual |
|---------|---------------|--------|
| Body text | ≥ 4.5:1 | 16.7:1 ✅ |
| Buttons | ≥ 4.5:1 | 7.1:1 ✅ |
| Links | ≥ 4.5:1 | 7.1:1 ✅ |
| Errors | ≥ 4.5:1 | 7.5:1 ✅ |
| Success | ≥ 4.5:1 | 6.8:1 ✅ |

### Mobile Testing

**Devices to Test**:
- iPhone (Safari)
- iPad (Safari)
- Android phone (Chrome)
- Android tablet (Chrome)

**Test Checklist**:
- [ ] All tap targets ≥ 44x44 pixels
- [ ] No horizontal scrolling
- [ ] Text readable without zoom
- [ ] Forms usable on mobile keyboard
- [ ] Modals work on touch
- [ ] Swipe gestures work (if applicable)
- [ ] Orientation changes work (portrait/landscape)

**Responsive Breakpoints**:
- Mobile: 320px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px+

### Browser Testing

**Browsers to Test**:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

**Test Checklist** (per browser):
- [ ] Focus indicators visible
- [ ] Keyboard navigation works
- [ ] ARIA labels read correctly
- [ ] Color contrast maintained
- [ ] Animations smooth
- [ ] No console errors
- [ ] Loading states work
- [ ] Error states work
- [ ] Success states work

## Testing Tools

### Browser Extensions

#### axe DevTools
**Best for**: Automated WCAG scanning
**Install**: [Chrome](https://chrome.google.com/webstore) / [Firefox](https://addons.mozilla.org/)

**Usage**:
1. Open DevTools (F12)
2. Go to "axe DevTools" tab
3. Click "Scan ALL of my page"
4. Review violations
5. Fix and re-scan

**What to Look For**:
- **Critical**: Fix immediately
- **Serious**: Fix before launch
- **Moderate**: Fix soon
- **Minor**: Nice to fix

#### WAVE
**Best for**: Visual feedback
**Install**: [WAVE Extension](https://wave.webaim.org/extension/)

**Usage**:
1. Click WAVE icon in toolbar
2. View errors, alerts, features
3. Click elements to see details
4. Use "Contrast" tab for color checking

### Lighthouse

**Built into Chrome DevTools**

**Usage**:
1. Open DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Accessibility" category
4. Click "Generate report"
5. Review score and issues

**Target Scores**:
- Accessibility: 100 / 100
- Best Practices: 100 / 100
- Performance: 90+ / 100
- SEO: 90+ / 100

## Test Results Documentation

### Recording Results

**After each test session, document**:
```markdown
## Test Session: [Date]

**Tester**: [Name]
**Environment**: [Browser/Device]
**Test Type**: [Automated/Manual/Screen Reader]

### Results
- ✅ Passed: [Count]
- ❌ Failed: [Count]
- ⚠️ Warnings: [Count]

### Issues Found
1. [Description]
   - **Severity**: Critical/Serious/Moderate/Minor
   - **Location**: [Page/Component]
   - **Steps to Reproduce**: [Steps]
   - **Expected**: [What should happen]
   - **Actual**: [What happened]

### Screenshots
[Attach screenshots if applicable]

### Next Steps
[Actions to take]
```

### Issue Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| **Critical** | Blocks all users from completing task | Fix immediately |
| **Serious** | Blocks some users from completing task | Fix before launch |
| **Moderate** | Makes task difficult for some users | Fix soon |
| **Minor** | Minor inconvenience | Nice to fix |

## Continuous Testing

### During Development

**Before committing code**:
```bash
# Run accessibility tests
npm run test:a11y

# Check for console errors
npm run dev
# Open browser console
# Verify no errors or warnings
```

**Before pull request**:
- [ ] All automated tests pass
- [ ] Keyboard navigation tested
- [ ] Focus states visible
- [ ] ARIA labels added
- [ ] Color contrast verified
- [ ] Documentation updated

### CI/CD Integration

**In GitHub Actions** (or similar):
```yaml
- name: Run accessibility tests
  run: npm run test:a11y

- name: Upload test results
  uses: actions/upload-artifact@v2
  with:
    name: accessibility-report
    path: playwright-report/
```

## Common Issues and Solutions

### Issue: Focus not visible
**Symptom**: Can't see where keyboard focus is
**Solution**: Check `/src/styles/accessibility.css` is imported
**Verify**: `:focus-visible` styles applied

### Issue: Screen reader not announcing
**Symptom**: VoiceOver/NVDA silent on element
**Solution**: Add `aria-label` or `aria-labelledby`
**Verify**: Element has accessible name

### Issue: Color contrast fails
**Symptom**: Text hard to read on background
**Solution**: Use pre-approved colors from docs
**Verify**: Ratio ≥ 4.5:1 with DevTools

### Issue: Keyboard trap
**Symptom**: Can't Tab away from element
**Solution**: Check modal focus management
**Verify**: Escape key works, focus returns

### Issue: Touch target too small
**Symptom**: Hard to tap on mobile
**Solution**: Ensure minimum 44x44px
**Verify**: Check with DevTools device mode

## Resources

### Internal
- [WCAG Compliance Report](./wcag-compliance.md)
- [Quick Reference Guide](./quick-reference.md)
- [Implementation Summary](./implementation-summary.md)

### External
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/extension/)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [NVDA Screen Reader](https://www.nvaccess.org/)

## Support

**Questions or issues?**
1. Check this guide first
2. Review [quick-reference.md](./quick-reference.md)
3. Look at existing components
4. Ask in #accessibility channel
5. Create issue with `accessibility` label

---

**Last Updated**: 2025-11-19
**Next Review**: 2025-12-19
**Maintained By**: Frontend Engineering Team

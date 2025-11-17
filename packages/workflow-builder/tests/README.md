# Workflow Builder - E2E Tests

Automated end-to-end tests using Playwright for the Workflow Builder application.

---

## 📦 Setup

### 1. Install Dependencies

```bash
cd packages/workflow-builder
yarn install
```

### 2. Install Playwright Browsers

```bash
npx playwright install
```

### 3. Set Up Environment

Create a `.env.test` file for test-specific configuration:

```bash
# Test Environment Variables
BASE_URL=http://localhost:3010
TEST_EMAIL=test@example.com
TEST_PASSWORD=TestPassword123!
```

---

## 🧪 Running Tests

### Run All Tests

```bash
yarn test:e2e
```

### Run Tests in UI Mode (Interactive)

```bash
yarn test:e2e:ui
```

### Run Tests in Debug Mode

```bash
yarn test:e2e:debug
```

### Run Specific Test File

```bash
npx playwright test tests/e2e/auth.spec.ts
```

### Run Tests in Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run Tests in Headed Mode (See Browser)

```bash
npx playwright test --headed
```

---

## 📊 Test Reports

### View Last Test Report

```bash
yarn test:e2e:report
```

### Generate HTML Report

HTML reports are automatically generated after test runs in `playwright-report/` directory.

---

## 🗂️ Test Structure

```
tests/
├── e2e/
│   ├── auth.spec.ts           # Authentication flow tests
│   ├── components.spec.ts     # Component management tests
│   ├── workflows.spec.ts      # Workflow management tests (TODO)
│   └── agents.spec.ts         # Agent prompt tests (TODO)
├── fixtures/
│   └── test-data.ts           # Shared test data
└── README.md                  # This file
```

---

## ✅ Test Coverage

### Authentication (`auth.spec.ts`)
- [x] Redirect unauthenticated users
- [x] Sign in with valid credentials
- [x] Show error for invalid credentials
- [x] Sign out successfully
- [x] Navigate to sign up page
- [x] Validate password length
- [x] Validate password confirmation
- [x] Protect dashboard route
- [x] Protect components route
- [x] Protect workflows route
- [x] Protect agents route

### Components (`components.spec.ts`)
- [x] Display components page
- [x] Show empty state
- [x] Navigate to component creation
- [x] Filter components by type
- [x] Search components
- [x] Display component creation form
- [x] Create new activity component
- [x] Validate required fields
- [x] Validate version format
- [ ] Display component details (TODO)
- [ ] Edit component (TODO)
- [ ] Delete component (TODO)

### Workflows (TODO: `workflows.spec.ts`)
- [ ] Display workflows page
- [ ] Create new workflow
- [ ] Open visual workflow editor
- [ ] Drag components onto canvas
- [ ] Connect workflow nodes
- [ ] Configure node properties
- [ ] Save workflow
- [ ] Deploy workflow

### Agents (TODO: `agents.spec.ts`)
- [ ] Display agents page
- [ ] Create new agent prompt
- [ ] Edit agent prompt with markdown
- [ ] Preview agent prompt
- [ ] Save agent prompt
- [ ] Delete agent prompt

---

## 🎯 Writing New Tests

### Test Structure

Follow this pattern for new tests:

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
  });

  test('should do something', async ({ page }) => {
    // Given: Setup
    
    // When: Action
    
    // Then: Assertion
  });
});
```

### Best Practices

1. **Use Descriptive Test Names**
   ```typescript
   // Good
   test('should create a new activity component with valid data')
   
   // Bad
   test('test component creation')
   ```

2. **Follow Given-When-Then Pattern**
   ```typescript
   // Given - Set up test state
   await page.goto('/components');
   
   // When - Perform action
   await page.getByRole('button', { name: 'Create' }).click();
   
   // Then - Assert result
   await expect(page).toHaveURL('/components/new');
   ```

3. **Use Role-Based Selectors**
   ```typescript
   // Good - Accessible and resilient
   await page.getByRole('button', { name: 'Sign In' }).click();
   await page.getByLabel('Email').fill('test@example.com');
   
   // Avoid - Fragile
   await page.locator('.submit-button').click();
   await page.locator('#email-input').fill('test@example.com');
   ```

4. **Handle Async Operations**
   ```typescript
   // Wait for navigation
   await Promise.all([
     page.waitForNavigation(),
     page.click('button')
   ]);
   
   // Wait for specific element
   await expect(page.getByText('Success')).toBeVisible();
   ```

5. **Clean Up After Tests**
   ```typescript
   test.afterEach(async ({ page }) => {
     // Clean up test data
     // Sign out if needed
   });
   ```

---

## 🐛 Debugging Tests

### 1. Run in Debug Mode

```bash
npx playwright test --debug
```

This opens Playwright Inspector where you can:
- Step through tests
- Inspect page state
- View console logs
- Take screenshots

### 2. Add Debug Statements

```typescript
test('debug example', async ({ page }) => {
  await page.pause(); // Pause execution
  
  console.log(await page.title()); // Log information
  
  await page.screenshot({ path: 'debug.png' }); // Take screenshot
});
```

### 3. View Trace Files

Traces are automatically recorded on first retry:

```bash
npx playwright show-trace trace.zip
```

### 4. Check Test Output

```bash
# Verbose output
npx playwright test --reporter=list

# With screenshot on failure
npx playwright test --screenshot=on
```

---

## 🔧 Configuration

Configuration is in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  retries: 2,
  workers: 1,
  
  use: {
    baseURL: 'http://localhost:3010',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  projects: [
    { name: 'chromium' },
    { name: 'firefox' },
    { name: 'webkit' },
  ],
});
```

---

## 📝 Common Playwright Commands

### Navigation
```typescript
await page.goto('/path');
await page.goBack();
await page.reload();
```

### Interaction
```typescript
await page.click('button');
await page.fill('input', 'text');
await page.selectOption('select', 'value');
await page.check('checkbox');
await page.press('input', 'Enter');
```

### Assertions
```typescript
await expect(page).toHaveURL('/expected');
await expect(page).toHaveTitle('Title');
await expect(element).toBeVisible();
await expect(element).toHaveText('text');
await expect(element).toBeEnabled();
```

### Waiting
```typescript
await page.waitForSelector('selector');
await page.waitForURL('/path');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
```

---

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: yarn install
      - run: npx playwright install --with-deps
      - run: yarn test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Playwright Test Assertions](https://playwright.dev/docs/test-assertions)

---

## 🤝 Contributing

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Add comments for complex logic
4. Update this README with new test coverage
5. Ensure tests pass locally before committing

---

## 📞 Support

For issues or questions:
- Check test output and traces
- Review Playwright documentation
- Check the main project README
- Contact the development team


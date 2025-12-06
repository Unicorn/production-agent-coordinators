# CLI Provider Fallback Testing

## Overview

The CLI agent system implements automatic failover between Gemini and Claude CLI providers when one hits quota limits, rate limits, or other recoverable errors.

## Fallback Triggers

The system automatically falls back to the alternative provider when encountering:

### Quota/Rate Limit Errors
- "rate limit" / "rate limited"
- "quota exceeded"
- "exhausted your capacity"
- "quota will reset"
- "credits"
- "capacity"

### Authentication Errors
- "authentication"
- "unauthorized"

## Non-Fallback Errors

The system does NOT fallback on:
- Interruption errors (exit code 143, 130)
- Incomplete JSON output
- Timeout errors
- Cancelled operations

These are considered non-recoverable and should fail immediately.

## Testing

### Unit Tests

Located in: `src/activities/__tests__/cli-agent.activities.test.ts`

Tests cover:
1. **Basic fallback on rate limit error** - Verifies fallback triggers on generic rate limit errors
2. **Gemini quota exhausted error (actual format)** - Tests with the real Gemini error message format: "You have exhausted your capacity on this model. Your quota will reset after..."
3. **Fallback when Gemini returns quota error in result** - Tests fallback when error is in result (not thrown)
4. **No fallback on interruption errors** - Verifies interruption errors don't trigger fallback

### Integration Tests

Located in: `src/__tests__/cli-integration.e2e.test.ts`

The integration test `should fallback to Claude when Gemini quota is exhausted` verifies:
- End-to-end fallback behavior in a real workflow
- Both CLI tools are available
- Workflow completes even if one provider fails (via fallback)

## Error Message Format

### Gemini Quota Error
```
Gemini CLI failed: You have exhausted your capacity on this model. Your quota will reset after 3h43m9s.
```

The fallback detection checks for:
- "exhausted your capacity" ✅
- "quota will reset" ✅

### Claude Rate Limit Error
```
CLI exited with code 429: Rate limit exceeded
```

The fallback detection checks for:
- "rate limit" ✅

## Implementation Details

### Error Propagation

1. **Gemini CLI throws error** → Caught in `GeminiCLIProvider.executeAgent`
2. **Error message extracted** → Includes full error from `executeGeminiAgent` activity
3. **Fallback check** → `shouldFallback()` checks error message for triggers
4. **Provider switch** → `getFallbackProvider()` returns alternative provider
5. **Retry** → `executeWithFallback()` retries with new provider

### Code Flow

```
executeWithFallback()
  → selectProvider() (initial provider)
  → currentProvider.executeAgent()
    → If success: return result
    → If failure: check shouldFallback()
      → If should fallback: getFallbackProvider() and retry
      → If not: throw error
```

## Verifying Fallback Works

### Manual Testing

1. **Simulate Gemini quota error**:
   ```bash
   # Set environment variable to force quota error (if CLI supports it)
   # Or wait for actual quota to be exhausted
   ```

2. **Run workflow**:
   ```bash
   npm run test:cli
   ```

3. **Check logs**:
   - Look for "Provider: gemini" error
   - Should see "Provider: claude" success
   - Workflow should complete successfully

### Automated Testing

Run the fallback tests:
```bash
yarn test cli-agent.activities.test.ts
```

All tests should pass, including:
- ✅ Fallback on rate limit error
- ✅ Fallback on Gemini quota exhausted (actual format)
- ✅ Fallback when Gemini returns quota error in result
- ✅ No fallback on interruption errors

## Troubleshooting

### Fallback Not Triggering

1. **Check error message format**: The error must contain one of the fallback trigger phrases
2. **Verify error propagation**: Check that errors from CLI activities are properly caught and passed through
3. **Check interruption detection**: Make sure interruption errors aren't being misclassified

### Both Providers Failing

If both providers hit limits:
- Error: "All providers exhausted"
- Workflow will fail
- This is expected behavior when both providers are rate-limited

## Future Improvements

- [ ] Add retry with exponential backoff before fallback
- [ ] Track fallback success rate in metrics
- [ ] Add circuit breaker pattern for repeatedly failing providers
- [ ] Implement provider health checks before selection


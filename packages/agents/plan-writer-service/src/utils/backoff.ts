/**
 * Fibonacci backoff generator for retry logic
 *
 * Generates wait times following Fibonacci sequence: 1m, 1m, 2m, 3m, 5m, 8m, ...
 * Caps at provided maximum value
 *
 * @param capMs Maximum wait time in milliseconds
 * @yields Wait time in milliseconds
 */
export function* fibonacciBackoff(capMs: number): Generator<number, never, unknown> {
  let prev = 0;      // Start with 0 so first iteration is 0 + 60000 = 60000
  let curr = 60000;  // 1 minute in ms

  while (true) {
    yield Math.min(curr, capMs);
    [prev, curr] = [curr, prev + curr];
  }
}

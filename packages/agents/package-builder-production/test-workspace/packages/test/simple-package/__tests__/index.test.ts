import { greet } from '../src/index';

describe('greet', () => {
  it('should return a greeting', () => {
    expect(greet('World')).toBe('Hello, World!');
  });
});
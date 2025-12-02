import { greet } from '../src/index';

describe('greet', () => {
  it('should return a greeting with the given name', () => {
    const name = 'World';
    const result = greet(name);
    expect(result).toBe('Hello, World!');
  });
});

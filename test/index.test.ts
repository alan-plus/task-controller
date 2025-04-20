import { greet } from '../src/index';

test('greet returns expected greeting', () => {
  expect(greet('World')).toBe('Hello, World!');
});
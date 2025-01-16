// split_message.test.ts
import {doesAnyPatternMatch, split_message} from '../src/utils';

describe('split_message', () => {
  it('include readme.md', () => {
    const testString = `^.+\\.md
test2\\.js
dist/.*

  `;
    expect(doesAnyPatternMatch(split_message(testString),"readme.md")).toBe(true);
    expect(doesAnyPatternMatch(split_message(testString),"dist/index.js")).toBe(true);
    expect(doesAnyPatternMatch(split_message(testString),"dist/prompt.js")).toBe(true);
    expect(doesAnyPatternMatch(split_message(testString),"src/index.js")).toBe(false);
  });
});

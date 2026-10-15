import { describe, expect, it } from 'vitest';
import { emailSegments, plainEmailText } from './emailText';

describe('plainEmailText', () => {
  it('turns Markdown links into "title (url)"', () => {
    const body = 'Your 2025 paper, [Rare HPV tumors](https://pmc.ncbi.nlm.nih.gov/articles/PMC1/), caught my attention.';
    expect(plainEmailText(body)).toBe('Your 2025 paper, Rare HPV tumors (https://pmc.ncbi.nlm.nih.gov/articles/PMC1/), caught my attention.');
  });

  it('handles several links and leaves other text alone', () => {
    const body = 'See [A](https://a.org) and [B](http://b.org/x).\n\nBest,\nSam [not a link]';
    expect(plainEmailText(body)).toBe('See A (https://a.org) and B (http://b.org/x).\n\nBest,\nSam [not a link]');
  });

  it('returns text without links unchanged', () => {
    expect(plainEmailText('Dear Dr. Doe,\n\nThank you.')).toBe('Dear Dr. Doe,\n\nThank you.');
  });
});

describe('emailSegments', () => {
  it('splits text into plain and link segments in order', () => {
    expect(emailSegments('Read [the paper](https://x.org/p) today.')).toEqual([
      { text: 'Read ' },
      { text: 'the paper', url: 'https://x.org/p' },
      { text: ' today.' },
    ]);
  });
});

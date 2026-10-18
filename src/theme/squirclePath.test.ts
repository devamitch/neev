import { squirclePath } from './squirclePath';

describe('squirclePath', () => {
  it('returns valid SVG path for valid dimensions', () => {
    const path = squirclePath({ width: 100, height: 100, radius: 20, smoothing: 0.6 });
    expect(path).toBeTruthy();
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
  });

  it('handles zero or negative dimensions safely', () => {
    expect(squirclePath({ width: 0, height: 100, radius: 20 })).toBe('');
    expect(squirclePath({ width: 100, height: 0, radius: 20 })).toBe('');
  });

  it('handles zero radius safely', () => {
    const path = squirclePath({ width: 100, height: 100, radius: 0 });
    expect(path).toBe('M 0 0 L 100 0 L 100 100 L 0 100 Z');
  });
});

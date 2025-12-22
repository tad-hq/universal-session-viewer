import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debounce } from '@/utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution by the specified time', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 300);

    debouncedFn('test');

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('test');
  });

  it('should use default 300ms delay when not specified', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn);

    debouncedFn('test');

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should consolidate rapid successive calls', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 300);

    debouncedFn('t');
    vi.advanceTimersByTime(50);
    debouncedFn('te');
    vi.advanceTimersByTime(50);
    debouncedFn('tes');
    vi.advanceTimersByTime(50);
    debouncedFn('test');

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('test');
  });

  it('should reset timer on each call', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 300);

    debouncedFn('first');
    vi.advanceTimersByTime(200);

    debouncedFn('second');
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('second');
  });

  it('should preserve function arguments', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('arg1', 'arg2', 123);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('should allow multiple executions after debounce period', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('first');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');

    debouncedFn('second');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('second');
  });

  describe('cancel functionality', () => {
    it('should have a cancel method', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      expect(typeof debouncedFn.cancel).toBe('function');
    });

    it('should prevent execution when cancel is called', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      debouncedFn('test');
      vi.advanceTimersByTime(100);

      debouncedFn.cancel();

      vi.advanceTimersByTime(300);

      expect(fn).not.toHaveBeenCalled();
    });

    it('should allow new calls after cancel', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      debouncedFn('first');
      debouncedFn.cancel();

      debouncedFn('second');
      vi.advanceTimersByTime(300);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('second');
    });

    it('should be safe to call cancel multiple times', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      debouncedFn('test');
      debouncedFn.cancel();
      debouncedFn.cancel();
      debouncedFn.cancel();

      vi.advanceTimersByTime(300);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should be safe to call cancel when no pending call', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      expect(() => debouncedFn.cancel()).not.toThrow();

      debouncedFn('test');
      vi.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalled();

      expect(() => debouncedFn.cancel()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle zero delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 0);

      debouncedFn('test');

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(0);
      expect(fn).toHaveBeenCalledWith('test');
    });

    it('should handle very long delays', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 10000);

      debouncedFn('test');

      vi.advanceTimersByTime(9999);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalled();
    });

    it('should handle functions with no arguments', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith();
    });

    it('should handle functions returning values (though async)', () => {
      const fn = vi.fn().mockReturnValue('result');
      const debouncedFn = debounce(fn, 100);

      const result = debouncedFn('test');

      expect(result).toBeUndefined();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalled();
      expect(fn).toHaveReturnedWith('result');
    });
  });

  describe('search-like usage pattern', () => {
    it('should handle realistic search typing pattern', () => {
      const searchFn = vi.fn();
      const debouncedSearch = debounce(searchFn, 300);

      debouncedSearch('r');
      vi.advanceTimersByTime(80);
      debouncedSearch('re');
      vi.advanceTimersByTime(100);
      debouncedSearch('rea');
      vi.advanceTimersByTime(90);
      debouncedSearch('reac');
      vi.advanceTimersByTime(120);
      debouncedSearch('react');

      expect(searchFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(searchFn).toHaveBeenCalledTimes(1);
      expect(searchFn).toHaveBeenCalledWith('react');
    });

    it('should handle user clearing search input', () => {
      const searchFn = vi.fn();
      const debouncedSearch = debounce(searchFn, 300);

      debouncedSearch('test');
      vi.advanceTimersByTime(100);

      debouncedSearch('');
      vi.advanceTimersByTime(300);

      expect(searchFn).toHaveBeenCalledWith('');
    });
  });
});

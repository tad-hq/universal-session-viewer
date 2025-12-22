import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatTimeAgo, formatTime, formatFileSize } from '@/utils/formatters';

describe('formatTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Just now" for times less than 1 minute ago', () => {
    const now = new Date();
    expect(formatTimeAgo(now)).toBe('Just now');

    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    expect(formatTimeAgo(thirtySecondsAgo)).toBe('Just now');
  });

  it('should return minutes ago for times less than 1 hour ago', () => {
    const now = new Date();

    const oneMinAgo = new Date(now.getTime() - 1 * 60 * 1000);
    expect(formatTimeAgo(oneMinAgo)).toBe('1m ago');

    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(formatTimeAgo(fiveMinAgo)).toBe('5m ago');

    const fiftyNineMinAgo = new Date(now.getTime() - 59 * 60 * 1000);
    expect(formatTimeAgo(fiftyNineMinAgo)).toBe('59m ago');
  });

  it('should return hours ago for times less than 24 hours ago', () => {
    const now = new Date();

    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    expect(formatTimeAgo(oneHourAgo)).toBe('1h ago');

    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    expect(formatTimeAgo(fiveHoursAgo)).toBe('5h ago');

    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    expect(formatTimeAgo(twentyThreeHoursAgo)).toBe('23h ago');
  });

  it('should return days ago for times less than 7 days ago', () => {
    const now = new Date();

    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(oneDayAgo)).toBe('1d ago');

    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(threeDaysAgo)).toBe('3d ago');

    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(sixDaysAgo)).toBe('6d ago');
  });

  it('should return locale date string for times 7 or more days ago', () => {
    const now = new Date();

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const result = formatTimeAgo(sevenDaysAgo);
    expect(result).not.toContain('d ago');
    expect(result).toBe(sevenDaysAgo.toLocaleDateString());

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(thirtyDaysAgo)).toBe(thirtyDaysAgo.toLocaleDateString());
  });

  it('should handle edge case at exactly 60 minutes', () => {
    const now = new Date();
    const sixtyMinAgo = new Date(now.getTime() - 60 * 60 * 1000);
    expect(formatTimeAgo(sixtyMinAgo)).toBe('1h ago');
  });

  it('should handle edge case at exactly 24 hours', () => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(twentyFourHoursAgo)).toBe('1d ago');
  });
});

describe('formatTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return time string for times less than 1 hour ago', () => {
    const now = new Date();

    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const result = formatTime(thirtyMinAgo.toISOString());
    expect(result).toMatch(/^\d{1,2}:\d{2}\s*(AM|PM)?$/i);
  });

  it('should return hours ago for times 1-23 hours ago', () => {
    const now = new Date();

    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    expect(formatTime(oneHourAgo.toISOString())).toBe('1 hour ago');

    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    expect(formatTime(fiveHoursAgo.toISOString())).toBe('5 hours ago');

    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    expect(formatTime(twentyThreeHoursAgo.toISOString())).toBe('23 hours ago');
  });

  it('should return days ago for times 24+ hours ago', () => {
    const now = new Date();

    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatTime(oneDayAgo.toISOString())).toBe('1 day ago');

    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    expect(formatTime(fiveDaysAgo.toISOString())).toBe('5 days ago');
  });

  it('should handle numeric timestamp input', () => {
    const now = new Date();
    const fiveHoursAgo = now.getTime() - 5 * 60 * 60 * 1000;
    expect(formatTime(fiveHoursAgo)).toBe('5 hours ago');
  });

  it('should use singular form for 1 hour/day', () => {
    const now = new Date();

    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    expect(formatTime(oneHourAgo.toISOString())).toBe('1 hour ago');

    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatTime(oneDayAgo.toISOString())).toBe('1 day ago');
  });

  it('should use plural form for multiple hours/days', () => {
    const now = new Date();

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatTime(twoHoursAgo.toISOString())).toBe('2 hours ago');

    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(formatTime(twoDaysAgo.toISOString())).toBe('2 days ago');
  });
});

describe('formatFileSize', () => {
  it('should format bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1)).toBe('1 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('should format kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10240)).toBe('10.0 KB');
    expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB');
  });

  it('should format megabytes correctly', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB');
    expect(formatFileSize(100 * 1024 * 1024)).toBe('100.0 MB');
  });

  it('should handle edge cases', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');

    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('should format decimal places consistently', () => {
    expect(formatFileSize(1024)).toMatch(/^\d+\.\d KB$/);
    expect(formatFileSize(1024 * 1024)).toMatch(/^\d+\.\d MB$/);
  });
});

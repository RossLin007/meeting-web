/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';

describe('Meeting filtering logic', () => {
  it('should filter out meetings older than 15 minutes', () => {
    const now = new Date();
    const GRACE_PERIOD_MS = 15 * 60 * 1000;

    const scheduledMeetings = [
      { startTime: new Date(now.getTime() - GRACE_PERIOD_MS - 1000) }, // 15m 1s ago - should be filtered
      { startTime: new Date(now.getTime() - GRACE_PERIOD_MS + 1000) }, // 14m 59s ago - should pass
      { startTime: undefined }, // No time - should pass
      { startTime: new Date(now.getTime() + 3600000) }, // 1 hour from now - should pass
    ];

    const filtered = scheduledMeetings.filter((meeting) => {
      if (!meeting.startTime) return true;
      return meeting.startTime.getTime() > now.getTime() - GRACE_PERIOD_MS;
    });

    expect(filtered).toHaveLength(3);
  });
});

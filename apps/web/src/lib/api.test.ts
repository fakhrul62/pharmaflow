import { describe, it, expect, afterEach, vi } from "vitest";
import { dayKey, setBusinessTimezone, today, daysUntil, money } from "./api";
afterEach(() => {
  setBusinessTimezone("Asia/Dhaka");
  vi.useRealTimers();
});
describe("business calendar", () => {
  it("groups late UTC transactions under the next Dhaka business day", () => {
    setBusinessTimezone("Asia/Dhaka");
    expect(dayKey("2026-11-08T18:30:00Z")).toBe("2026-11-09");
  });
  it("uses the configured timezone instead of the computer timezone", () => {
    setBusinessTimezone("America/New_York");
    expect(dayKey("2026-11-09T02:00:00Z")).toBe("2026-11-08");
  });
  it("treats expiry equal to the business date as zero remaining days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T18:30:00Z"));
    expect(today()).toBe("2026-11-09");
    expect(daysUntil("2026-11-09")).toBe(0);
    expect(daysUntil("2026-11-10")).toBe(1);
  });
  it("formats integer minor currency units without losing cents", () => {
    expect(money(12345, "USD")).toBe("$123.45");
    expect(money(0, "USD")).toBe("$0.00");
  });
});

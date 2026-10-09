import {
  addLocalDays,
  isLocalDate,
  localDayUtcRange,
  toLocalDate,
} from "./local-date";

describe("local date", () => {
  it("formats a date using local calendar fields", () => {
    expect(toLocalDate(new Date(2026, 7, 17, 23, 59))).toBe("2026-08-17");
  });

  it("moves across month boundaries without parsing as UTC", () => {
    expect(addLocalDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addLocalDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("rejects impossible calendar dates", () => {
    expect(isLocalDate("2026-02-29")).toBeFalse();
    expect(isLocalDate("2028-02-29")).toBeTrue();
    expect(isLocalDate("17-08-2026")).toBeFalse();
  });

  it("returns UTC instants that bound one local day", () => {
    const range = localDayUtcRange("2026-08-17");

    expect(new Date(range.endExclusive).getTime() - new Date(range.start).getTime()).toBeGreaterThanOrEqual(
      23 * 60 * 60 * 1000,
    );
    expect(new Date(range.endExclusive).getTime() - new Date(range.start).getTime()).toBeLessThanOrEqual(
      25 * 60 * 60 * 1000,
    );
  });
});

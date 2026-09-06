// Reconciliation periods are the backbone of this system: every transaction is
// filed into a two-week window, and managers reconcile one window at a time.
// If a purchase lands in the wrong window, the wrong money gets signed off.
//
// The rule (CLAUDE.md): periods run Friday -> Thursday, 14 days long, and the
// first one ends Thursday 6 August 2026.

const test = require("node:test");
const assert = require("node:assert/strict");

const { calculatePeriodDates } = require("../src/services/reconciliationPeriodService");

// Helper: what weekday is this date string, in UTC?
const weekdayOf = (isoDate) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });

// Helper: how many days does this period cover, counting both ends?
const lengthInDays = ({ startDate, endDate }) =>
  (new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) /
    86400000 + 1;

test("the first period is Friday 24 July to Thursday 6 August 2026", () => {
  assert.deepEqual(calculatePeriodDates("2026-07-24"), {
    startDate: "2026-07-24",
    endDate: "2026-08-06",
  });
});

test("a purchase on the last day still belongs to that period, not the next", () => {
  // The boundary is where off-by-one errors live. 6 Aug is the LAST day of
  // period one; 7 Aug is the FIRST day of period two.
  const lastDay = calculatePeriodDates("2026-08-06");
  const nextDay = calculatePeriodDates("2026-08-07");

  assert.equal(lastDay.endDate, "2026-08-06");
  assert.equal(nextDay.startDate, "2026-08-07");
  assert.notDeepEqual(lastDay, nextDay);
});

test("two purchases in the same fortnight get the same period", () => {
  // This is the whole point of the feature: Jose buys on Monday, Hawau buys on
  // the following Wednesday, and both appear on one reconciliation sheet.
  const jose = calculatePeriodDates("2026-08-10");
  const hawau = calculatePeriodDates("2026-08-19");

  assert.deepEqual(jose, hawau);
});

test("every period starts on a Friday and ends on a Thursday", () => {
  // Checked across a year of dates rather than a couple of hand-picked ones,
  // so a broken calculation cannot slip through on a lucky example.
  for (let dayOffset = -200; dayOffset <= 400; dayOffset += 1) {
    const date = new Date("2026-07-24T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + dayOffset);
    const isoDate = date.toISOString().slice(0, 10);

    const period = calculatePeriodDates(isoDate);

    assert.equal(weekdayOf(period.startDate), "Friday", `start for ${isoDate}`);
    assert.equal(weekdayOf(period.endDate), "Thursday", `end for ${isoDate}`);
  }
});

test("every period is exactly 14 days long", () => {
  for (let dayOffset = -200; dayOffset <= 400; dayOffset += 1) {
    const date = new Date("2026-07-24T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + dayOffset);
    const isoDate = date.toISOString().slice(0, 10);

    assert.equal(lengthInDays(calculatePeriodDates(isoDate)), 14, `for ${isoDate}`);
  }
});

test("the purchase date always falls inside the period it is assigned to", () => {
  // Sounds obvious, but this is the assertion that actually protects the money:
  // a transaction must never be filed into a window that does not contain it.
  for (let dayOffset = -200; dayOffset <= 400; dayOffset += 1) {
    const date = new Date("2026-07-24T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + dayOffset);
    const isoDate = date.toISOString().slice(0, 10);

    const { startDate, endDate } = calculatePeriodDates(isoDate);

    assert.ok(startDate <= isoDate, `${isoDate} starts before its period`);
    assert.ok(isoDate <= endDate, `${isoDate} ends after its period`);
  }
});

test("periods still work for dates before the system started", () => {
  // Receipts get submitted late, and the seeded test data predates July 2026.
  // The maths must run backwards without producing a broken window.
  const early = calculatePeriodDates("2026-06-15");

  assert.equal(weekdayOf(early.startDate), "Friday");
  assert.equal(lengthInDays(early), 14);
  assert.ok(early.startDate <= "2026-06-15" && "2026-06-15" <= early.endDate);
});

test("dates around a clock change are not shifted by a day", () => {
  // The service does all its maths in UTC on purpose. If someone swapped
  // getUTCDate for getDate, dates near a daylight-saving change would slide by
  // one day and silently move transactions between periods.
  const beforeClockChange = calculatePeriodDates("2026-03-28");
  const afterClockChange = calculatePeriodDates("2026-03-29");

  assert.equal(lengthInDays(beforeClockChange), 14);
  assert.equal(lengthInDays(afterClockChange), 14);
  assert.equal(weekdayOf(beforeClockChange.startDate), "Friday");
  assert.equal(weekdayOf(afterClockChange.startDate), "Friday");
});

test("a nonsense date is rejected loudly instead of guessing a period", () => {
  // Failing loudly matters more than it looks: a silently wrong period puts a
  // transaction on the wrong reconciliation sheet, and nobody notices until a
  // manager is reconciling against a total that does not add up.
  assert.throws(() => calculatePeriodDates("not-a-date"), /Invalid transaction date/);
  assert.throws(() => calculatePeriodDates("2026-13-45"), /Invalid transaction date/);
  assert.throws(() => calculatePeriodDates(""), /Invalid transaction date/);
});

const pool = require("../db/pool");

const FIRST_PERIOD_START = new Date("2024-07-24T00:00:00Z");
const PERIOD_LENGTH_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const formatDateOnly = (date) => {
  return date.toISOString().split("T")[0];
};

const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const calculatePeriodDates = (transactionDate) => {
  const date = new Date(`${transactionDate}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid transaction date");
  }
  if (date < FIRST_PERIOD_START) {
    throw new Error(
      "Transaction date is before the first reconciliation period"
    );
  }
  const daysSinceStart = Math.floor((date - FIRST_PERIOD_START) / MS_PER_DAY);
  const periodIndex = Math.floor(daysSinceStart / PERIOD_LENGTH_DAYS);
  const startDate = addDays(
    FIRST_PERIOD_START,
    periodIndex * PERIOD_LENGTH_DAYS
  );
  const endDate = addDays(startDate, PERIOD_LENGTH_DAYS - 1);

  return {
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(endDate),
  };
};

const getOrCreateReconciliationPeriod = async (transactionDate) => {
  const { startDate, endDate } = calculatePeriodDates(transactionDate);

  const existingPeriod = await pool.query(
    `SELECT reconciliation_period_id, start_date, end_date
        FROM reconciliation_periods
        WHERE start_date = $1 AND end_date = $2`,
    [startDate, endDate]
  );
  if (existingPeriod.rows.length > 0) {
    return existingPeriod.rows[0];
  }
  const newPeriod = await pool.query(
    `INSERT INTO reconciliation_periods (start_date, end_date)
        VALUES ($1, $2)
        RETURNING reconciliation_period_id, start_date, end_date`,
    [startDate, endDate]
  );
  return newPeriod.rows[0];
};

module.exports = {
  calculatePeriodDates,
  getOrCreateReconciliationPeriod,
};

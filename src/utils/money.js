export const toMinorUnits = (value, { allowNegative = false } = {}) => {
  const number = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number) || (!allowNegative && number < 0)) return null;
  return Math.round(number * 100);
};
export const fromMinorUnits = (minor) =>
  Number.isInteger(minor) ? minor / 100 : null;
export const formatCurrency = (minor, currency = "INR", locale = "en-IN") => {
  const amount = fromMinorUnits(minor);
  return amount === null
    ? "—"
    : new Intl.NumberFormat(locale, { style: "currency", currency }).format(
        amount,
      );
};
export const safeAddMinorUnits = (...values) =>
  values.reduce(
    (total, value) => total + (Number.isInteger(value) ? value : 0),
    0,
  );
export const safeSubtractMinorUnits = (left, right) =>
  Math.max(
    0,
    (Number.isInteger(left) ? left : 0) - (Number.isInteger(right) ? right : 0),
  );

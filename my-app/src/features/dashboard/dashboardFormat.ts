const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const counts = new Intl.NumberFormat('en-IN');

/** `12500` → `₹12,500`. */
export const formatRupees = (amount: number): string => rupees.format(amount);

export const formatCount = (value: number): string => counts.format(value);

/** `66.666` → `67%`. */
export const formatPercent = (value: number): string => `${Math.round(value)}%`;

export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${formatCount(count)} ${count === 1 ? singular : plural}`;

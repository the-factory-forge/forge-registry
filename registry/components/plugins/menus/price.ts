export function menuPriceFormatter(locale: string, currency: string) {
  const { minimumFractionDigits, maximumFractionDigits } = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).resolvedOptions();
  const divisor = 10 ** (maximumFractionDigits ?? 2);
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits, maximumFractionDigits });
  return (minor: number) => number.format(minor / divisor);
}

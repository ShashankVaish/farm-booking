/*
  Whole-number fields are text inputs with a numeric keyboard, not
  type="number". A number input that starts at 0 kept the zero when the host
  typed after it, showing "03000" (React does not rewrite a number input whose
  text already equals the value). Here the box is empty until a number is
  typed, and only digits are kept.
*/
export function wholeNumber(raw: string): number {
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  return digits ? Number(digits) : 0;
}

export function shownNumber(value: number | null | undefined): string {
  return value ? String(value) : '';
}

// Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits become ASCII
// digits. An Arabic keyboard can produce either, but phone numbers, codes and
// countdowns are Latin in both languages (docs/design/views/booking-form.md).

const NON_LATIN_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

export function latinDigits(value: string): string {
  return value.replace(NON_LATIN_DIGITS, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

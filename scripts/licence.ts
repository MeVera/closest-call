// Licence policy shared by the photo fetcher and the validator.
// Accept: CC0, public domain, CC BY, CC BY-SA. Reject NC, ND, and anything unclear.

export function classifyLicence(shortName: string | undefined, machine?: string | undefined): string | null {
  const s = `${machine ?? ''} ${shortName ?? ''}`.toLowerCase();
  if (!s.trim()) return null;
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv|fair use|non-?free|all rights reserved/.test(s)) return null;
  if (/\bcc0\b|cc-zero/.test(s)) return 'CC0';
  if (/\bpd\b|public domain|^pd-|\bpd-/.test(s)) return 'Public domain';
  const m = /cc[- ]by[- ]sa[- ]?(\d(?:\.\d)?)?/.exec(s);
  if (m) return `CC BY-SA${m[1] ? ' ' + m[1] : ''}`;
  const b = /cc[- ]by[- ]?(\d(?:\.\d)?)?(?![- ]?(sa|nc|nd))/.exec(s);
  if (b) return `CC BY${b[1] ? ' ' + b[1] : ''}`;
  return null;
}

export function isAcceptableLicence(name: string): boolean {
  return /^(CC0|Public domain|CC BY(-SA)?( \d(\.\d)?)?)$/.test(name);
}

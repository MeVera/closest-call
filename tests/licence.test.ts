import { describe, expect, it } from 'vitest';
import { classifyLicence, isAcceptableLicence } from '../scripts/licence';

describe('photo licence policy', () => {
  it.each([
    ['CC BY-SA 4.0', 'cc-by-sa-4.0', 'CC BY-SA 4.0'],
    ['CC BY 2.0', 'cc-by-2.0', 'CC BY 2.0'],
    ['CC0', 'cc0', 'CC0'],
    ['Public domain', 'pd', 'Public domain'],
    ['CC BY-SA 3.0', undefined, 'CC BY-SA 3.0'],
  ])('accepts %s', (short, machine, expected) => {
    expect(classifyLicence(short, machine)).toBe(expected);
    expect(isAcceptableLicence(expected)).toBe(true);
  });

  it.each([
    ['CC BY-NC 2.0', 'cc-by-nc-2.0'],
    ['CC BY-NC-SA 4.0', 'cc-by-nc-sa-4.0'],
    ['CC BY-ND 2.0', 'cc-by-nd-2.0'],
    ['Fair use', undefined],
    ['', undefined],
    ['GFDL', 'gfdl'],
    ['Copyrighted free use', undefined],
  ])('rejects %s', (short, machine) => {
    expect(classifyLicence(short, machine)).toBeNull();
  });

  it('isAcceptableLicence rejects anything not normalised', () => {
    expect(isAcceptableLicence('CC BY-NC 2.0')).toBe(false);
    expect(isAcceptableLicence('GFDL')).toBe(false);
  });
});

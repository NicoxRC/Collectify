import { normalizeIncomingPhoneNumber } from './normalizeIncomingPhoneNumber';

describe('normalizeIncomingPhoneNumber', () => {
  it('prepends a + when the number has none', () => {
    expect(normalizeIncomingPhoneNumber('573001234567')).toBe('+573001234567');
  });

  it('leaves a number that already has a + unchanged', () => {
    expect(normalizeIncomingPhoneNumber('+573001234567')).toBe('+573001234567');
  });

  it('trims surrounding whitespace before normalizing', () => {
    expect(normalizeIncomingPhoneNumber('  573001234567  ')).toBe(
      '+573001234567',
    );
  });
});

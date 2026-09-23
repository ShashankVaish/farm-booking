import { describe, expect, it } from 'vitest';
import { addressLine, addressLines, business } from '@/lib/config/business';

describe('business identity', () => {
  it('derives PAN from the GSTIN rather than repeating it', () => {
    /*
      GSTIN = 2-digit state code + 10-character PAN + entity number + 'Z' +
      a checksum that may be a letter or a digit. State code 09 is Uttar
      Pradesh.
    */
    expect(business.gstin).toMatch(/^\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z\d]$/);
    expect(business.pan).toBe('EANPG5213E');
    expect(business.gstin).toContain(business.pan);
    expect(business.gstin.startsWith('09')).toBe(true);
  });

  it('renders the registered address in one line and in postal lines', () => {
    expect(addressLine()).toBe(
      'Gate No. 2, Balaji Mandir Road, Near Balaji Mandir, Hallu Sarai, Sambhal, Uttar Pradesh 244302, India',
    );
    expect(addressLines()).toHaveLength(5);
    expect(addressLines().at(-1)).toBe('India');
  });

  it('names the legal person, not only the trade name', () => {
    // A gateway checks the entity that holds the bank account and the GSTIN.
    expect(business.entity).toContain(business.legalName);
    expect(business.entity).toContain(business.tradeName);
  });
});

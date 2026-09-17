import { normalizePhoneForWhatsApp, getWhatsAppUrl, getCallUrl } from './phone.utils';

describe('PhoneUtils', () => {
  describe('normalizePhoneForWhatsApp', () => {
    it('should normalize standard 10-digit Indian numbers by adding 91 prefix', () => {
      expect(normalizePhoneForWhatsApp('9876543210')).toBe('919876543210');
      expect(normalizePhoneForWhatsApp(' 98765 43210 ')).toBe('919876543210');
      expect(normalizePhoneForWhatsApp('+91 98765-43210')).toBe('919876543210');
    });

    it('should handle 11-digit numbers starting with 0 by replacing 0 with 91', () => {
      expect(normalizePhoneForWhatsApp('09876543210')).toBe('919876543210');
    });

    it('should preserve 12-digit Indian numbers already starting with 91', () => {
      expect(normalizePhoneForWhatsApp('919876543210')).toBe('919876543210');
      expect(normalizePhoneForWhatsApp('+919876543210')).toBe('919876543210');
    });

    it('should accept valid international numbers between 10 and 15 digits', () => {
      expect(normalizePhoneForWhatsApp('+14155552671')).toBe('14155552671');
      expect(normalizePhoneForWhatsApp('+447911123456')).toBe('447911123456');
    });

    it('should return null for null, undefined, empty, or non-string inputs', () => {
      expect(normalizePhoneForWhatsApp(null)).toBeNull();
      expect(normalizePhoneForWhatsApp(undefined)).toBeNull();
      expect(normalizePhoneForWhatsApp('')).toBeNull();
      expect(normalizePhoneForWhatsApp('   ')).toBeNull();
    });

    it('should return null for invalid short or excessively long numbers', () => {
      expect(normalizePhoneForWhatsApp('12345')).toBeNull();
      expect(normalizePhoneForWhatsApp('1234567890123456789')).toBeNull();
      expect(normalizePhoneForWhatsApp('abcdefghij')).toBeNull();
    });
  });

  describe('getWhatsAppUrl', () => {
    it('should generate valid wa.me link with pre-filled message for origin and destination', () => {
      const url = getWhatsAppUrl('9876543210', 'Mumbai', 'Pune');
      expect(url).toBe(
        'https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20HighwayPool%20booking%20with%20you%20for%20Mumbai%20to%20Pune.'
      );
    });

    it('should generate valid wa.me link when route string is passed as single parameter', () => {
      const url = getWhatsAppUrl('9876543210', 'Mumbai to Pune');
      expect(url).toBe(
        'https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20HighwayPool%20booking%20with%20you%20for%20Mumbai%20to%20Pune.'
      );
    });

    it('should fallback gracefully when no route is provided', () => {
      const url = getWhatsAppUrl('9876543210');
      expect(url).toBe(
        'https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20HighwayPool%20booking%20with%20you%20for%20our%20scheduled%20ride.'
      );
    });

    it('should return null if phone is missing or invalid', () => {
      expect(getWhatsAppUrl(null, 'Mumbai', 'Pune')).toBeNull();
      expect(getWhatsAppUrl('', 'Mumbai', 'Pune')).toBeNull();
      expect(getWhatsAppUrl('invalid', 'Mumbai', 'Pune')).toBeNull();
    });
  });

  describe('getCallUrl', () => {
    it('should generate tel: link for valid phone', () => {
      expect(getCallUrl('+91 98765 43210')).toBe('tel:+919876543210');
      expect(getCallUrl('9876543210')).toBe('tel:9876543210');
    });

    it('should return null for empty or invalid phone', () => {
      expect(getCallUrl(null)).toBeNull();
      expect(getCallUrl('')).toBeNull();
      expect(getCallUrl('123')).toBeNull();
      expect(getCallUrl('abc')).toBeNull();
    });
  });
});

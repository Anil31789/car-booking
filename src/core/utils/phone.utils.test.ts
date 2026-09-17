import { test, describe } from 'node:test';
import assert from 'node:assert';
import { normalizePhoneForWhatsApp, getWhatsAppUrl, getCallUrl } from './phone.utils.js';

describe('Phone Utils Test Suite', () => {
  test('normalizePhoneForWhatsApp - Indian 10 digits', () => {
    assert.strictEqual(normalizePhoneForWhatsApp('9876543210'), '919876543210');
    assert.strictEqual(normalizePhoneForWhatsApp(' 98765 43210 '), '919876543210');
    assert.strictEqual(normalizePhoneForWhatsApp('+91 98765-43210'), '919876543210');
  });

  test('normalizePhoneForWhatsApp - 11 digits starting with 0', () => {
    assert.strictEqual(normalizePhoneForWhatsApp('09876543210'), '919876543210');
  });

  test('normalizePhoneForWhatsApp - 12 digits starting with 91', () => {
    assert.strictEqual(normalizePhoneForWhatsApp('919876543210'), '919876543210');
    assert.strictEqual(normalizePhoneForWhatsApp('+919876543210'), '919876543210');
  });

  test('normalizePhoneForWhatsApp - International 10-15 digits', () => {
    assert.strictEqual(normalizePhoneForWhatsApp('+14155552671'), '14155552671');
    assert.strictEqual(normalizePhoneForWhatsApp('+447911123456'), '447911123456');
  });

  test('normalizePhoneForWhatsApp - null/empty/invalid inputs', () => {
    assert.strictEqual(normalizePhoneForWhatsApp(null), null);
    assert.strictEqual(normalizePhoneForWhatsApp(undefined), null);
    assert.strictEqual(normalizePhoneForWhatsApp(''), null);
    assert.strictEqual(normalizePhoneForWhatsApp('   '), null);
    assert.strictEqual(normalizePhoneForWhatsApp('12345'), null);
    assert.strictEqual(normalizePhoneForWhatsApp('abcdefghij'), null);
  });

  test('getWhatsAppUrl - Origin and Destination', () => {
    const url = getWhatsAppUrl('9876543210', 'Mumbai', 'Pune');
    assert.strictEqual(
      url,
      'https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20HighwayPool%20booking%20with%20you%20for%20Mumbai%20to%20Pune.'
    );
  });

  test('getWhatsAppUrl - Route string', () => {
    const url = getWhatsAppUrl('9876543210', 'Mumbai to Pune');
    assert.strictEqual(
      url,
      'https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20HighwayPool%20booking%20with%20you%20for%20Mumbai%20to%20Pune.'
    );
  });

  test('getWhatsAppUrl - Fallback route description', () => {
    const url = getWhatsAppUrl('9876543210');
    assert.strictEqual(
      url,
      'https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20HighwayPool%20booking%20with%20you%20for%20our%20scheduled%20ride.'
    );
  });

  test('getWhatsAppUrl - Missing or invalid phone returns null', () => {
    assert.strictEqual(getWhatsAppUrl(null, 'Mumbai', 'Pune'), null);
    assert.strictEqual(getWhatsAppUrl('', 'Mumbai', 'Pune'), null);
    assert.strictEqual(getWhatsAppUrl('invalid', 'Mumbai', 'Pune'), null);
  });

  test('getCallUrl - valid phone', () => {
    assert.strictEqual(getCallUrl('+91 98765 43210'), 'tel:+919876543210');
    assert.strictEqual(getCallUrl('9876543210'), 'tel:9876543210');
  });

  test('getCallUrl - null or invalid phone', () => {
    assert.strictEqual(getCallUrl(null), null);
    assert.strictEqual(getCallUrl(''), null);
    assert.strictEqual(getCallUrl('123'), null);
  });
});

/**
 * Phone number normalization and messaging link utilities for HighwayPool.
 */

/**
 * Safely normalizes phone numbers for WhatsApp wa.me links.
 * Strips non-digits, handles India (+91) defaults for 10-digit and 0-prefixed numbers,
 * and validates international length (10-15 digits).
 * Returns null if the number is missing or invalid.
 */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // 10 digits (Standard Indian Mobile) -> prepend 91
  if (digits.length === 10) {
    return '91' + digits;
  }
  // 11 digits starting with 0 (e.g. 09876543210) -> replace 0 with 91
  if (digits.length === 11 && digits.startsWith('0')) {
    return '91' + digits.substring(1);
  }
  // 12 digits starting with 91 (e.g. 919876543210)
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  // Standard E.164 international numbers between 10 and 15 digits
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  return null;
}

/**
 * Builds a wa.me deep link with a pre-filled booking message.
 * Example message: "Hi, I have a HighwayPool booking with you for Mumbai to Pune."
 */
export function getWhatsAppUrl(
  phone: string | null | undefined,
  originOrRoute?: string,
  destination?: string
): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;

  let routeDesc = '';
  if (originOrRoute && destination) {
    routeDesc = `${originOrRoute.trim()} to ${destination.trim()}`;
  } else if (originOrRoute) {
    routeDesc = originOrRoute.trim();
  } else {
    routeDesc = 'our scheduled ride';
  }

  const message = `Hi, I have a HighwayPool booking with you for ${routeDesc}.`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * Builds a tel: URI for direct phone calling.
 * Handles missing or invalid numbers gracefully.
 */
export function getCallUrl(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (!cleaned || cleaned.replace(/\D/g, '').length < 5) return null;
  return `tel:${cleaned}`;
}

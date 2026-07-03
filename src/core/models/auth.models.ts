export interface UserSession {
  token: string;
  userId: string;
  role: 'passenger' | 'driver';
  expiresAt: string;
}

export interface LoginCredentials {
  phone: string;
  otp: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  phone: string;
  licenseNumber?: string;
}

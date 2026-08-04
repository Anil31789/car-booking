import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  getCurrentUser(): Observable<User | null> {
    return this.http.get<User | null>('/api/auth/me');
  }

  login(email: string, password: string): Observable<{ user: User, token: string, refreshToken: string }> {
    return this.http.post<{ user: User, token: string, refreshToken: string }>('/api/auth/login', { email, password });
  }

  verifyOtp(phone: string, otp: string): Observable<{ user: User, token: string, refreshToken: string }> {
    return this.http.post<{ user: User, token: string, refreshToken: string }>('/api/auth/verify-otp', { phone, otp });
  }

  register(name: string, email: string, password: string, phone?: string): Observable<{ success: boolean, message: string }> {
    return this.http.post<{ success: boolean, message: string }>('/api/auth/register', { name, email, password, phone });
  }

  verifyEmail(token: string, email?: string): Observable<{ success: boolean, message: string }> {
    const url = email 
      ? `/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`
      : `/api/auth/verify-email?token=${token}`;
    return this.http.get<{ success: boolean, message: string }>(url);
  }

  googleLogin(idToken: string): Observable<{ user: User, token: string, refreshToken: string }> {
    return this.http.post<{ user: User, token: string, refreshToken: string }>('/api/auth/google', { idToken });
  }

  setPassword(password: string): Observable<{ success: boolean, message: string }> {
    return this.http.post<{ success: boolean, message: string }>('/api/auth/set-password', { password });
  }

  forgotPassword(email: string): Observable<{ success: boolean, message: string }> {
    return this.http.post<{ success: boolean, message: string }>('/api/auth/forgot-password', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ success: boolean, message: string }> {
    return this.http.post<{ success: boolean, message: string }>('/api/auth/reset-password', { token, newPassword });
  }

  updateProfileLicense(licenseCode: string): Observable<User> {
    return this.http.post<User>('/api/auth/license', { licenseCode });
  }

  demoLogin(role: 'passenger' | 'driver'): Observable<{ user: User, token: string, refreshToken: string }> {
    return this.http.post<{ user: User, token: string, refreshToken: string }>('/api/auth/demo-login', { role });
  }

  refreshToken(refreshToken: string): Observable<{ accessToken: string }> {
    return this.http.post<{ accessToken: string }>('/api/auth/refresh', { refreshToken });
  }

  logout(refreshToken?: string): Observable<boolean> {
    return this.http.post<boolean>('/api/auth/logout', { refreshToken });
  }
}

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

  login(phone: string): Observable<boolean> {
    return this.http.post<boolean>('/api/auth/login', { phone });
  }

  verifyOtp(phone: string, otp: string): Observable<{ user: User, token: string, refreshToken: string }> {
    return this.http.post<{ user: User, token: string, refreshToken: string }>('/api/auth/verify-otp', { phone, otp });
  }

  signup(name: string, email: string, phone: string, license?: string): Observable<{ user: User, token: string, refreshToken: string }> {
    return this.http.post<{ user: User, token: string, refreshToken: string }>('/api/auth/signup', { name, email, phone, license });
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

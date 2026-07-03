import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User } from '../models/user.models';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthStore {
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  
  currentUser = signal<User | null>(null);
  token = signal<string | null>(null);
  refreshTokenSignal = signal<string | null>(null);

  isLoggedIn = computed(() => this.currentUser() !== null);
  isDriver = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    return user.driverDetails?.isLicenseVerified || !!user.licensePlaceholder;
  });

  constructor() {}

  initAuth(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (isPlatformBrowser(this.platformId)) {
        const storedToken = localStorage.getItem('jwt_token');
        const storedRefreshToken = localStorage.getItem('refresh_token');
        
        if (storedRefreshToken) {
          this.refreshTokenSignal.set(storedRefreshToken);
        }

        if (storedToken) {
          this.token.set(storedToken);
          this.authService.getCurrentUser().subscribe({
            next: (user) => {
              if (user) {
                this.currentUser.set(user);
                resolve();
              } else {
                this.attemptRefreshOrLogoutPromise().then(() => resolve());
              }
            },
            error: () => {
              this.attemptRefreshOrLogoutPromise().then(() => resolve());
            }
          });
        } else if (storedRefreshToken) {
          this.attemptRefreshOrLogoutPromise().then(() => resolve());
        } else {
          resolve();
        }
      } else {
        resolve();
      }
    });
  }

  private attemptRefreshOrLogoutPromise(): Promise<void> {
    return new Promise<void>((resolve) => {
      const rToken = this.refreshTokenSignal();
      if (rToken) {
        this.authService.refreshToken(rToken).subscribe({
          next: (res) => {
            this.setToken(res.accessToken);
            this.authService.getCurrentUser().subscribe({
              next: (user) => {
                if (user) this.currentUser.set(user);
                else this.logout();
                resolve();
              },
              error: () => {
                this.logout();
                resolve();
              }
            });
          },
          error: () => {
            this.logout();
            resolve();
          }
        });
      } else {
        this.logout();
        resolve();
      }
    });
  }

  setCurrentUser(user: User | null) {
    this.currentUser.set(user);
  }

  setToken(token: string | null) {
    this.token.set(token);
    if (isPlatformBrowser(this.platformId)) {
      if (token) {
        localStorage.setItem('jwt_token', token);
      } else {
        localStorage.removeItem('jwt_token');
      }
    }
  }

  setSession(token: string | null, refreshToken: string | null) {
    this.token.set(token);
    this.refreshTokenSignal.set(refreshToken);
    if (isPlatformBrowser(this.platformId)) {
      if (token) {
        localStorage.setItem('jwt_token', token);
      } else {
        localStorage.removeItem('jwt_token');
      }
      
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      } else {
        localStorage.removeItem('refresh_token');
      }
    }
  }

  logout() {
    const rToken = this.refreshTokenSignal();
    
    // Revoke token in background
    if (rToken) {
      this.authService.logout(rToken).subscribe();
    }
    
    this.currentUser.set(null);
    this.token.set(null);
    this.refreshTokenSignal.set(null);
    
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
    }
  }
}

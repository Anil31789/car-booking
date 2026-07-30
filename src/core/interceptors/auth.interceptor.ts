import { inject, PLATFORM_ID, Injector } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { Router } from '@angular/router';
import { AuthStore } from '../store/auth.store';
import { AuthService } from '../services/auth.service';
import { catchError, throwError, BehaviorSubject } from 'rxjs';
import { filter, switchMap, take } from 'rxjs/operators';

let isRefreshing = false;
const refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const injector = inject(Injector);
  
  let apiReq = req;
  
  // Resolve SSR relative API request issues
  if (isPlatformServer(platformId) && req.url.startsWith('/api')) {
    const apiBase = (typeof process !== 'undefined' && process.env && process.env['API_BASE_URL']) 
      ? process.env['API_BASE_URL'] 
      : 'http://localhost:5000';
    apiReq = req.clone({
      url: `${apiBase}${req.url}`
    });
  }
  
  // Extract token from localStorage directly to prevent DI circular dependencies
  if (isPlatformBrowser(platformId)) {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      apiReq = apiReq.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
  }
  
  return next(apiReq).pipe(
    catchError((error: any) => {
      if (error instanceof HttpErrorResponse) {
        if ((error.status === 401 || error.status === 403) && isPlatformBrowser(platformId)) {
          const isAuthUrl = req.url.includes('/api/auth/refresh') || 
                            req.url.includes('/api/auth/login') || 
                            req.url.includes('/api/auth/signup') || 
                            req.url.includes('/api/auth/verify-otp') ||
                            req.url.includes('/api/auth/demo-login') ||
                            req.url.includes('/api/auth/logout');
                            
          if (!isAuthUrl) {
            const authStore = injector.get(AuthStore);
            const authService = injector.get(AuthService);
            const rToken = authStore.refreshTokenSignal();
            
            if (rToken) {
              if (!isRefreshing) {
                isRefreshing = true;
                refreshTokenSubject.next(null);
                
                return authService.refreshToken(rToken).pipe(
                  switchMap((res) => {
                    isRefreshing = false;
                    authStore.setToken(res.accessToken);
                    refreshTokenSubject.next(res.accessToken);
                    
                    return next(req.clone({
                      setHeaders: {
                        Authorization: `Bearer ${res.accessToken}`
                      }
                    }));
                  }),
                  catchError((refreshError) => {
                    isRefreshing = false;
                    authStore.logout();
                    router.navigate(['/welcome']);
                    return throwError(() => refreshError);
                  })
                );
              } else {
                return refreshTokenSubject.pipe(
                  filter(token => token !== null),
                  take(1),
                  switchMap((newToken) => {
                    return next(req.clone({
                      setHeaders: {
                        Authorization: `Bearer ${newToken}`
                      }
                    }));
                  })
                );
              }
            } else {
              authStore.logout();
              router.navigate(['/welcome']);
            }
          }
        }
      }
      return throwError(() => error);
    })
  );
};


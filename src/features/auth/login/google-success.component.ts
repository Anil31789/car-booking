import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-google-success',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="success-page">
      <div class="spinner"></div>
      <p>Completing sign in... Please wait.</p>
    </div>
  `,
  styles: [`
    .success-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      font-family: sans-serif;
      background-color: hsl(var(--bg-primary, 0 0% 100%));
      color: hsl(var(--text-primary, 0 0% 0%));
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(0,0,0,0.1);
      border-top-color: #0a84ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class GoogleSuccessComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authStore = inject(AuthStore);
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  ngOnInit() {
    // Only run auth loading inside the client browser to prevent SSR 401 failures during pre-rendering
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const token = this.route.snapshot.queryParams['token'];
    const refreshToken = this.route.snapshot.queryParams['refreshToken'] || null;

    if (token) {
      // 1. Save the JWT to localStorage first (makes it immediately available for the HTTP interceptor)
      localStorage.setItem('jwt_token', token);
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }

      // 2. Update the AuthStore with the token
      this.authStore.setSession(token, refreshToken);

      console.log("JWT =", localStorage.getItem("jwt_token"));
      console.log("REFRESH =", localStorage.getItem("refresh_token"));

      // 3. Only after the token exists in localStorage, call GET /api/auth/me
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          if (user) {
            this.authStore.setCurrentUser(user);
            // 4. Navigate directly to Home
            this.router.navigate(['/']);
          } else {
            this.router.navigate(['/login'], { queryParams: { error: 'SessionInitializationFailed' } });
          }
        },
        error: (err) => {
          console.error('Error initializing user profile after Google redirect:', err);
          this.router.navigate(['/login'], { queryParams: { error: 'ProfileFetchFailed' } });
        }
      });
    } else {
      this.router.navigate(['/login'], { queryParams: { error: 'NoTokenProvided' } });
    }
  }
}

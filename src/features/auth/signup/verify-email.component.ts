import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="auth-page fade-in">
      <header class="auth-header">
        <button class="back-btn" (click)="router.navigate(['/login'])">
          <span class="material-icons-outlined">arrow_back</span>
        </button>
      </header>

      <div class="auth-content">
        <!-- Verification Card -->
        <div class="verify-card glass-panel text-center">
          
          <!-- Loading State -->
          <div class="state-container fade-in" *ngIf="status === 'loading'">
            <span class="spinner large-spinner"></span>
            <h2>Verifying Email</h2>
            <p>Please wait while we verify your activation token...</p>
          </div>

          <!-- Success State -->
          <div class="state-container fade-in" *ngIf="status === 'success'">
            <span class="material-icons-outlined success-icon">verified</span>
            <h2 class="success-text">Email Verified!</h2>
            <p>Your email has been verified successfully.</p>
            <p class="redirect-info">Redirecting to login in {{ countdown }} seconds...</p>
            <button class="ripple-btn submit-btn" (click)="goToLogin()">
              Go to Login Now
            </button>
          </div>

          <!-- Error State -->
          <div class="state-container fade-in" *ngIf="status === 'error'">
            <span class="material-icons-outlined error-icon">cancel</span>
            <h2 class="error-text">Verification Failed</h2>
            <p class="error-description">{{ errorMsg }}</p>
            <button class="ripple-btn submit-btn" (click)="router.navigate(['/signup'])" style="margin-bottom: 12px;">
              Back to Sign Up
            </button>
            <button class="ripple-btn btn-secondary full-width" (click)="router.navigate(['/login'])">
              Go to Login
            </button>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px;
      background-color: hsl(var(--bg-primary));
    }

    .auth-header {
      .back-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: hsl(var(--text-primary));
        display: flex;
        align-items: center;
        padding: 4px;
        
        span { font-size: 24px; }
      }
    }

    .auth-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      margin: 40px 0;
      align-items: center;
    }

    .verify-card {
      width: 100%;
      max-width: 420px;
      padding: 40px 24px;
      border-radius: var(--border-radius-md);
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
    }

    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;

      h2 {
        font-size: 1.6rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        margin-bottom: 2px;
      }

      p {
        font-size: 0.9rem;
        color: hsl(var(--text-secondary));
        line-height: 1.45;
        margin: 0;
      }
    }

    .success-text {
      color: var(--color-secondary);
    }

    .error-text {
      color: var(--color-danger);
    }

    .success-icon {
      font-size: 64px;
      color: var(--color-secondary);
      filter: drop-shadow(0 4px 12px rgba(52, 199, 89, 0.25));
    }

    .error-icon {
      font-size: 64px;
      color: var(--color-danger);
      filter: drop-shadow(0 4px 12px rgba(255, 69, 58, 0.25));
    }

    .redirect-info {
      font-size: 0.8rem !important;
      color: hsl(var(--text-tertiary)) !important;
      font-style: italic;
    }

    .submit-btn {
      width: 100%;
      padding: 14px;
      margin-top: 10px;
    }

    .large-spinner {
      width: 48px;
      height: 48px;
      border-width: 4px;
      border-top-color: var(--color-primary);
    }

    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      border-top-color: hsl(var(--text-primary));
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .text-center {
      text-align: center;
    }
  `]
})
export class VerifyEmailComponent implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  errorMsg = '';
  countdown = 3;
  private timer: any;
  private hasRequested = false;

  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  router = inject(Router);

  ngOnInit() {
    // Only run activation query in the browser (client-side) to avoid duplicate SSR server call
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.hasRequested) {
      return;
    }

    const token = this.route.snapshot.queryParams['token'];
    const email = this.route.snapshot.queryParams['email'] || '';

    if (!token) {
      this.status = 'error';
      this.errorMsg = 'Invalid verification link. Token is missing.';
      return;
    }

    this.hasRequested = true;

    this.authService.verifyEmail(token, email).subscribe({
      next: (res) => {
        this.status = 'success';
        this.startCountdown();
      },
      error: (err) => {
        this.status = 'error';
        this.errorMsg = err.error?.error || 'Verification link expired or invalid.';
      }
    });
  }

  startCountdown() {
    this.timer = setInterval(() => {
      this.countdown--;
      if (this.countdown === 0) {
        this.goToLogin();
      }
    }, 1000);
  }

  goToLogin() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.router.navigate(['/login']);
  }
}

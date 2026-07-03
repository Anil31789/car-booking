import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-otp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-page fade-in">
      <header class="auth-header">
        <button class="back-btn" (click)="router.navigate(['/login'])">
          <span class="material-icons-outlined">arrow_back</span>
        </button>
      </header>

      <div class="auth-content">
        <h2>Enter Verification Code</h2>
        <p>We've sent a 6-digit verification code to <strong>{{ displayPhone }}</strong></p>

        <!-- OTP Input Form -->
        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="custom-input-group">
            <label>OTP Code</label>
            <div class="otp-inputs-row">
              <input 
                type="text" 
                maxLength="6"
                placeholder="XXXXXX"
                [(ngModel)]="otpValue"
                name="otp"
                required
                pattern="^[0-9]{6}$"
                class="otp-main-input" />
            </div>
            <div class="error-msg" *ngIf="errorMessage">
              {{ errorMessage }}
            </div>
          </div>

          <div class="timer-row">
            <span class="resend-lbl" *ngIf="countdown > 0">
              Resend code in <strong>{{ countdown }}s</strong>
            </span>
            <span class="resend-link" *ngIf="countdown === 0" (click)="resendCode()">
              Resend Code via SMS
            </span>
          </div>

          <button 
            type="submit" 
            class="ripple-btn submit-btn" 
            [disabled]="otpValue.length !== 6 || loading">
            <span class="spinner" *ngIf="loading"></span>
            {{ loading ? 'Verifying...' : 'Verify & Continue' }}
          </button>
        </form>
      </div>

      <div class="footer-hint">
        <span>By continuing, you confirm your mobile number is correct</span>
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

      h2 {
        font-size: 1.8rem;
        font-weight: 800;
        letter-spacing: -0.8px;
        margin-bottom: 6px;
      }

      p {
        font-size: 0.88rem;
        color: hsl(var(--text-secondary));
        line-height: 1.45;
        margin-bottom: 30px;
      }
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .custom-input-group {
      display: flex;
      flex-direction: column;
      gap: 8px;

      label {
        font-size: 0.72rem;
        font-weight: 700;
        color: hsl(var(--text-tertiary));
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .otp-inputs-row {
      display: flex;
      justify-content: center;
    }

    .otp-main-input {
      width: 100%;
      letter-spacing: 12px;
      font-size: 1.6rem;
      font-weight: 850;
      text-align: center;
      padding: 12px;
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      background-color: hsl(var(--bg-secondary));
      color: var(--color-primary);
      outline: none;
      transition: var(--transition-smooth);

      &:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15);
        background-color: hsl(var(--bg-primary));
      }
      
      &::placeholder {
        letter-spacing: normal;
        color: hsl(var(--text-tertiary));
        font-weight: 500;
      }
    }

    .error-msg {
      font-size: 0.75rem;
      color: var(--color-danger);
      font-weight: 600;
      margin-top: 4px;
      text-align: center;
    }

    .timer-row {
      display: flex;
      justify-content: center;
      font-size: 0.82rem;
      
      .resend-lbl {
        color: hsl(var(--text-secondary));
      }

      .resend-link {
        color: var(--color-primary);
        font-weight: 700;
        cursor: pointer;
      }
    }

    .submit-btn {
      width: 100%;
      padding: 14px;
    }

    .footer-hint {
      text-align: center;
      
      span {
        font-size: 0.72rem;
        color: hsl(var(--text-tertiary));
      }
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #ffffff;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class OtpComponent implements OnInit, OnDestroy {
  displayPhone = '';
  otpValue = '';
  loading = false;
  countdown = 60;
  errorMessage = '';

  private timerId: any = null;
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private platformId = inject(PLATFORM_ID);
  router = inject(Router);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.displayPhone = params['phone'] || '+91 9999999999';
    });

    this.startTimer();
  }

  ngOnDestroy() {
    this.clearTimer();
  }

  startTimer() {
    this.clearTimer();
    this.countdown = 60;
    
    // Zone.js Stability Check for SSR Prerendering
    if (isPlatformBrowser(this.platformId)) {
      this.timerId = setInterval(() => {
        if (this.countdown > 0) {
          this.countdown--;
        } else {
          this.clearTimer();
        }
      }, 1000);
    }
  }

  clearTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  resendCode() {
    this.startTimer();
    this.errorMessage = '';
    this.otpValue = '';
  }

  onSubmit() {
    if (this.otpValue.length !== 6) return;
    this.loading = true;
    this.errorMessage = '';
    
    this.authService.verifyOtp(this.displayPhone, this.otpValue).subscribe({
      next: (res) => {
        this.authStore.setCurrentUser(res.user);
        this.authStore.setToken(res.token);
        if (typeof window !== 'undefined') {
          localStorage.setItem('jwt_token', res.token);
        }
        this.loading = false;
        this.router.navigate(['/']);
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Invalid verification code. Please check and try again.';
      }
    });
  }
}

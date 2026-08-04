import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
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
        <h2>Choose New Password</h2>
        <p>Set a secure password for your HighwayPool account</p>

        <!-- Error Banner -->
        <div class="error-banner glass-panel" *ngIf="errorMsg">
          <span class="material-icons-outlined">error_outline</span>
          <span>{{ errorMsg }}</span>
        </div>

        <!-- Success Banner -->
        <div class="success-banner glass-panel" *ngIf="successMsg">
          <span class="material-icons-outlined">check_circle</span>
          <span>{{ successMsg }}</span>
        </div>

        <form (ngSubmit)="onSubmit()" #resetForm="ngForm" class="auth-form" *ngIf="!successMsg">
          <!-- Password -->
          <div class="custom-input-group">
            <label>New Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined prefix-icon">lock</span>
              <input 
                type="password" 
                placeholder="Min 8 characters, letters & numbers" 
                [(ngModel)]="password" 
                name="password"
                required
                minlength="8"
                #passwordInput="ngModel"
                class="search-input" />
            </div>
            <div class="validation-msg" *ngIf="password && !isPasswordStrong(password)">
              Password must be at least 8 characters long and contain both letters and numbers.
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="custom-input-group">
            <label>Confirm Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined prefix-icon">lock_open</span>
              <input 
                type="password" 
                placeholder="Re-enter password" 
                [(ngModel)]="confirmPassword" 
                name="confirmPassword"
                required
                #confirmInput="ngModel"
                class="search-input" />
            </div>
            <div class="validation-msg" *ngIf="confirmInput.touched && password !== confirmPassword">
              Passwords do not match.
            </div>
          </div>

          <button 
            type="submit" 
            class="ripple-btn submit-btn" 
            [disabled]="resetForm.invalid || (password !== confirmPassword) || !isPasswordStrong(password) || loading">
            <span class="spinner" *ngIf="loading"></span>
            {{ loading ? 'Saving password...' : 'Save Password' }}
          </button>
        </form>
      </div>

      <div class="footer-links">
        <span>Go back to <strong (click)="router.navigate(['/login'])">Log In</strong></span>
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

    .error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      border-radius: 8px;
      background-color: rgba(255, 69, 58, 0.1);
      border: 1px solid rgba(255, 69, 58, 0.2);
      color: var(--color-danger);
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 20px;

      span { font-size: 18px; }
    }

    .success-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      border-radius: 8px;
      background-color: rgba(52, 199, 89, 0.1);
      border: 1px solid rgba(52, 199, 89, 0.2);
      color: var(--color-secondary);
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 20px;
      justify-content: center;

      span { font-size: 18px; }
    }

    .custom-input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.72rem;
        font-weight: 700;
        color: hsl(var(--text-tertiary));
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .input-wrapper {
        display: flex;
        align-items: center;
        border: 1px solid hsl(var(--border-light));
        border-radius: var(--border-radius-sm);
        padding: 12px 14px;
        background-color: hsl(var(--bg-secondary));
        transition: var(--transition-smooth);

        &:focus-within {
          border-color: var(--color-primary);
          background-color: hsl(var(--bg-primary));
          box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15);
        }
      }

      .prefix-icon {
        font-size: 20px;
        color: hsl(var(--text-tertiary));
        margin-right: 12px;
      }

      .search-input {
        border: none;
        background: none;
        outline: none;
        font-size: 0.95rem;
        font-weight: 600;
        color: hsl(var(--text-primary));
        width: 100%;
      }

      .validation-msg {
        font-size: 0.72rem;
        color: var(--color-danger);
        font-weight: 600;
        margin-top: 2px;
      }
    }

    .submit-btn {
      width: 100%;
      padding: 14px;
    }

    .footer-links {
      text-align: center;
      
      span {
        font-size: 0.85rem;
        color: hsl(var(--text-secondary));
        
        strong {
          color: var(--color-primary);
          cursor: pointer;
        }
      }
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #ffffff;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  confirmPassword = '';
  token = '';
  loading = false;
  successMsg = '';
  errorMsg = '';

  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  router = inject(Router);

  ngOnInit() {
    this.token = this.route.snapshot.queryParams['token'] || '';
    if (!this.token) {
      this.errorMsg = 'Invalid or missing recovery token. Please request another reset link.';
    }
  }

  isPasswordStrong(pwd: string): boolean {
    if (!pwd || pwd.length < 8) return false;
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    return hasLetter && hasNumber;
  }

  onSubmit() {
    if (!this.password || !this.token || (this.password !== this.confirmPassword) || !this.isPasswordStrong(this.password)) return;
    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';

    this.authService.resetPassword(this.token, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMsg = 'Password reset successfully! Redirecting you to login...';
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Failed to reset password. The link may have expired.';
        this.loading = false;
      }
    });
  }
}

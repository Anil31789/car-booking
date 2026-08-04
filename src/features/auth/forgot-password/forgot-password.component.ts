import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
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
        <h2>Password Recovery</h2>
        <p>Enter your email address and we'll send you a recovery link to reset your password</p>

        <form (ngSubmit)="onSubmit()" #recoveryForm="ngForm" class="auth-form">
          <!-- Error Banner -->
          <div class="error-banner glass-panel" *ngIf="errorMsg">
            <span class="material-icons-outlined">error_outline</span>
            <span>{{ errorMsg }}</span>
          </div>

          <div class="custom-input-group">
            <label>Email Address</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined prefix-icon">email</span>
              <input 
                type="email" 
                placeholder="ramesh@example.com" 
                [(ngModel)]="email" 
                name="email"
                required
                email
                #emailInput="ngModel"
                class="search-input" />
            </div>
            <div class="validation-msg" *ngIf="emailInput.invalid && emailInput.touched">
              Please enter a valid email address.
            </div>
          </div>

          <button 
            type="submit" 
            class="ripple-btn submit-btn" 
            [disabled]="recoveryForm.invalid || success || loading">
            <span class="spinner" *ngIf="loading"></span>
            {{ success ? 'Recovery Email Sent' : 'Send Reset Link' }}
          </button>
          
          <div class="success-banner" *ngIf="success">
            <span class="material-icons-outlined">check_circle</span>
            <span>Recovery email sent! Check your inbox.</span>
          </div>
        </form>
      </div>

      <div class="footer-links">
        <span>Remember password? <strong (click)="router.navigate(['/login'])">Log In</strong></span>
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

    .success-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-radius: 8px;
      background-color: rgba(52, 199, 89, 0.1);
      border: 1px solid rgba(52, 199, 89, 0.2);
      color: var(--color-secondary);
      font-size: 0.82rem;
      font-weight: 600;
      justify-content: center;
      
      span { font-size: 16px; }
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
export class ForgotPasswordComponent {
  email = '';
  success = false;
  loading = false;
  errorMsg = '';

  private authService = inject(AuthService);
  router = inject(Router);

  onSubmit() {
    if (!this.email) return;
    this.loading = true;
    this.errorMsg = '';
    this.success = false;

    this.authService.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.loading = false;
        this.success = true;
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Failed to send recovery email. Please try again.';
        this.loading = false;
      }
    });
  }
}

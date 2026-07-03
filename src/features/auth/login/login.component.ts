import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-page fade-in">
      <header class="auth-header">
        <button class="back-btn" (click)="router.navigate(['/welcome'])">
          <span class="material-icons-outlined">arrow_back</span>
        </button>
      </header>

      <div class="auth-content">
        <h2>Welcome Back</h2>
        <p>Login to search, share, and pool rides instantly</p>

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm" class="auth-form">
          <div class="custom-input-group">
            <label>Mobile Number</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined prefix-icon">phone</span>
              <span class="country-code">+91</span>
              <input 
                type="tel" 
                placeholder="10-digit number" 
                [(ngModel)]="phoneNumber" 
                name="phone"
                required
                pattern="^[0-9]{10}$"
                #phoneInput="ngModel"
                class="search-input" />
            </div>
            <div class="validation-msg" *ngIf="phoneInput.invalid && phoneInput.touched">
              Please enter a valid 10-digit mobile number.
            </div>
          </div>

          <div class="form-links">
            <span class="forgot-link" (click)="router.navigate(['/forgot-password'])">Trouble logging in?</span>
          </div>

          <button 
            type="submit" 
            class="ripple-btn submit-btn" 
            [disabled]="loginForm.invalid || loading">
            <span class="spinner" *ngIf="loading"></span>
            {{ loading ? 'Sending OTP...' : 'Send OTP via SMS' }}
          </button>
        </form>
      </div>

      <div class="footer-links">
        <span>Don't have an account? <strong (click)="router.navigate(['/signup'])">Sign Up</strong></span>
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
        line-height: 1.4;
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
        margin-right: 8px;
      }

      .country-code {
        font-size: 0.95rem;
        font-weight: 700;
        color: hsl(var(--text-primary));
        margin-right: 8px;
        border-right: 1px solid hsl(var(--border-light));
        padding-right: 8px;
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

    .form-links {
      display: flex;
      justify-content: flex-end;
      
      .forgot-link {
        font-size: 0.8rem;
        color: var(--color-primary);
        font-weight: 600;
        cursor: pointer;
      }
    }

    .submit-btn {
      width: 100%;
      padding: 14px;
      margin-top: 10px;
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
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class LoginComponent {
  phoneNumber = '';
  loading = false;

  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  router = inject(Router);

  onSubmit() {
    if (!this.phoneNumber) return;
    this.loading = true;
    const phone = `+91 ${this.phoneNumber.trim()}`;
    
    // Bypass OTP screen: verify immediately and redirect to dashboard/home page
    this.authService.verifyOtp(phone, '123456').subscribe({
      next: (res) => {
        this.authStore.setCurrentUser(res.user);
        this.authStore.setSession(res.token, res.refreshToken);
        this.loading = false;
        this.router.navigate(['/']);
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}

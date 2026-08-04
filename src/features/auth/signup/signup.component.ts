import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-page fade-in">
      <header class="auth-header">
        <button class="back-btn" (click)="router.navigate(['/welcome'])" *ngIf="!success">
          <span class="material-icons-outlined">arrow_back</span>
        </button>
      </header>

      <div class="auth-content">
        <!-- Success State: Verification Email Sent -->
        <div class="success-state glass-panel fade-in" *ngIf="success">
          <span class="material-icons-outlined success-icon">mark_email_read</span>
          <h2>Verify Your Email</h2>
          <p>We've sent a verification link to <strong>{{ email }}</strong>. Please check your inbox and click the link to activate your account.</p>
          <button class="ripple-btn submit-btn" (click)="router.navigate(['/login'])">
            Go to Login
          </button>
        </div>

        <!-- Signup Form -->
        <div class="form-wrapper" *ngIf="!success">
          <h2>Create Account</h2>
          <p>Join HighwayPool to share commutes and cut costs</p>

          <!-- Error Banner -->
          <div class="error-banner glass-panel" *ngIf="errorMsg">
            <span class="material-icons-outlined">error_outline</span>
            <span>{{ errorMsg }}</span>
          </div>

          <form (ngSubmit)="onSubmit()" #signupForm="ngForm" class="auth-form">
            <!-- Full Name -->
            <div class="custom-input-group">
              <label>Full Name</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined prefix-icon">person</span>
                <input 
                  type="text" 
                  placeholder="e.g. Ramesh Kumar" 
                  [(ngModel)]="name" 
                  name="name"
                  required
                  #nameInput="ngModel"
                  class="search-input" />
              </div>
            </div>

            <!-- Email Address -->
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

            <!-- Password -->
            <div class="custom-input-group">
              <label>Password</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined prefix-icon">lock</span>
                <input 
                  type="password" 
                  placeholder="Min 8 characters" 
                  [(ngModel)]="password" 
                  name="password"
                  required
                  minlength="8"
                  #passwordInput="ngModel"
                  class="search-input" />
              </div>
              <div class="validation-msg" *ngIf="passwordInput.invalid && passwordInput.touched">
                Password must be at least 8 characters long.
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

            <!-- Optional Phone Number -->
            <div class="custom-input-group">
              <label>Mobile Number (Optional)</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined prefix-icon">phone</span>
                <span class="country-code">+91</span>
                <input 
                  type="tel" 
                  placeholder="10-digit number" 
                  [(ngModel)]="phone" 
                  name="phone"
                  pattern="^[0-9]{10}$"
                  #phoneInput="ngModel"
                  class="search-input" />
              </div>
              <div class="validation-msg" *ngIf="phoneInput.invalid && phoneInput.touched && phone">
                Please enter a valid 10-digit mobile number.
              </div>
            </div>

            <button 
              type="submit" 
              class="ripple-btn submit-btn" 
              [disabled]="signupForm.invalid || (password !== confirmPassword) || loading">
              <span class="spinner" *ngIf="loading"></span>
              {{ loading ? 'Creating Account...' : 'Sign Up' }}
            </button>
          </form>
        </div>
      </div>

      <div class="footer-links" *ngIf="!success">
        <span>Already have an account? <strong (click)="router.navigate(['/login'])">Log In</strong></span>
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
      margin: 20px 0;

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
        margin-bottom: 24px;
      }
    }

    .success-state {
      text-align: center;
      padding: 40px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-md);

      .success-icon {
        font-size: 64px;
        color: var(--color-secondary);
        filter: drop-shadow(0 4px 10px rgba(52, 199, 89, 0.2));
      }

      p {
        margin-bottom: 10px;
      }
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

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
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

    .submit-btn {
      width: 100%;
      padding: 14px;
      margin-top: 10px;
    }

    .footer-links {
      text-align: center;
      margin-top: 10px;
      
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
export class SignupComponent {
  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  phone = '';
  loading = false;
  success = false;
  errorMsg = '';

  private authService = inject(AuthService);
  router = inject(Router);

  onSubmit() {
    if (!this.name || !this.email || !this.password || (this.password !== this.confirmPassword)) return;
    this.loading = true;
    this.errorMsg = '';
    
    const phoneNo = this.phone ? `+91 ${this.phone.trim()}` : undefined;
    this.authService.register(this.name, this.email, this.password, phoneNo).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Registration failed. Please try again.';
        this.loading = false;
      }
    });
  }
}

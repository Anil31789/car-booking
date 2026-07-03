import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-signup',
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
        <h2>Create Account</h2>
        <p>Join HighwayPool to share commutes and cut costs</p>

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

          <!-- Phone Number -->
          <div class="custom-input-group">
            <label>Mobile Number</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined prefix-icon">phone</span>
              <span class="country-code">+91</span>
              <input 
                type="tel" 
                placeholder="10-digit number" 
                [(ngModel)]="phone" 
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

          <!-- Optional License Number -->
          <div class="custom-input-group">
            <label>Driving License (Optional)</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined prefix-icon">badge</span>
              <input 
                type="text" 
                placeholder="e.g. DL-123456MH" 
                [(ngModel)]="license" 
                name="license"
                class="search-input" />
            </div>
            <div class="helper-text">
              Add a license to register as a Driver and offer rides.
            </div>
          </div>

          <button 
            type="submit" 
            class="ripple-btn submit-btn" 
            [disabled]="signupForm.invalid || loading">
            <span class="spinner" *ngIf="loading"></span>
            {{ loading ? 'Creating Account...' : 'Sign Up' }}
          </button>
        </form>
      </div>

      <div class="footer-links">
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

      .helper-text {
        font-size: 0.7rem;
        color: hsl(var(--text-tertiary));
        font-weight: 500;
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
  phone = '';
  license = '';
  loading = false;

  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  router = inject(Router);

  onSubmit() {
    if (!this.name || !this.email || !this.phone) return;
    this.loading = true;
    const phoneNo = `+91 ${this.phone.trim()}`;
    this.authService.signup(this.name, this.email, phoneNo, this.license).subscribe({
      next: (res) => {
        this.authStore.setCurrentUser(res.user);
        this.authStore.setSession(res.token, res.refreshToken);
        this.loading = false;
        this.router.navigate(['/']);
      },
      error: () => this.loading = false
    });
  }
}

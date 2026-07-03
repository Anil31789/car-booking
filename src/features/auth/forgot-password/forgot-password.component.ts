import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

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
        <p>Enter your mobile number and we'll send you an recovery link to log back in</p>

        <form (ngSubmit)="onSubmit()" #recoveryForm="ngForm" class="auth-form">
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
          </div>

          <button 
            type="submit" 
            class="ripple-btn submit-btn" 
            [disabled]="recoveryForm.invalid || success">
            {{ success ? 'Recovery Link Sent' : 'Send Reset Link' }}
          </button>
          
          <div class="success-banner" *ngIf="success">
            <span class="material-icons-outlined">check_circle</span>
            <span>Recovery SMS sent! Check your messages.</span>
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
  `]
})
export class ForgotPasswordComponent {
  phoneNumber = '';
  success = false;

  router = inject(Router);

  onSubmit() {
    if (!this.phoneNumber) return;
    this.success = true;
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 2000);
  }
}

import { Component, inject, OnInit } from '@angular/core';
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

        <!-- Error Banner -->
        <div class="error-banner glass-panel" *ngIf="errorMsg">
          <span class="material-icons-outlined">error_outline</span>
          <span>{{ errorMsg }}</span>
        </div>

        <!-- Google Sign-In Button Container -->
        <div class="google-login-container">
          <button type="button" class="google-passport-btn" (click)="loginWithGooglePassport()">
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" />
            <span>Continue with Google</span>
          </button>
        </div>

        <div class="auth-divider">
          <span class="line"></span>
          <span class="text">or use email</span>
          <span class="line"></span>
        </div>

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm" class="auth-form">
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
                placeholder="Enter password" 
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

          <div class="form-links">
            <span class="forgot-link" (click)="router.navigate(['/forgot-password'])">Forgot Password?</span>
          </div>

          <button 
            type="submit" 
            class="ripple-btn submit-btn" 
            [disabled]="loginForm.invalid || loading">
            <span class="spinner" *ngIf="loading"></span>
            {{ loading ? 'Logging In...' : 'Log In' }}
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

    .google-login-container {
      margin-bottom: 24px;
      display: flex;
      justify-content: center;
      width: 100%;
    }

    .google-passport-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px 24px;
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      background-color: hsl(var(--bg-secondary));
      color: hsl(var(--text-primary));
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background-color: hsl(var(--bg-tertiary));
        border-color: hsl(var(--text-tertiary));
      }

      img {
        width: 18px;
        height: 18px;
      }
    }

    .auth-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;

      .line {
        flex: 1;
        height: 1px;
        background-color: hsl(var(--border-light));
      }

      .text {
        font-size: 0.76rem;
        font-weight: 600;
        color: hsl(var(--text-tertiary));
        text-transform: uppercase;
        letter-spacing: 0.5px;
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
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  loading = false;
  errorMsg = '';

  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  router = inject(Router);

  ngOnInit() {
    if (typeof window !== 'undefined') {
      if ((window as any).google) {
        this.initGoogleSignIn();
      } else {
        const interval = setInterval(() => {
          if ((window as any).google) {
            this.initGoogleSignIn();
            clearInterval(interval);
          }
        }, 300);
      }
    }
  }

  initGoogleSignIn() {
    (window as any).google.accounts.id.initialize({
      client_id: '999888777-mockclientid.apps.googleusercontent.com', // fallback/mock client ID
      callback: (response: any) => this.handleGoogleCredentialResponse(response)
    });
    
    const btnContainer = document.getElementById('google-signin-btn');
    if (btnContainer) {
      (window as any).google.accounts.id.renderButton(
        btnContainer,
        { theme: 'outline', size: 'large', width: 320 }
      );
    }
  }

  loginWithGooglePassport() {
    if (typeof window !== 'undefined') {
      window.location.href = '/api/auth/google';
    }
  }

  handleGoogleCredentialResponse(response: any) {
    this.loading = true;
    this.errorMsg = '';
    
    this.authService.googleLogin(response.credential).subscribe({
      next: (res) => {
        this.authStore.setCurrentUser(res.user);
        this.authStore.setSession(res.token, res.refreshToken);
        this.loading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Google Login failed. Please try again.';
        this.loading = false;
      }
    });
  }

  onSubmit() {
    if (!this.email || !this.password) return;
    this.loading = true;
    this.errorMsg = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        this.authStore.setCurrentUser(res.user);
        this.authStore.setSession(res.token, res.refreshToken);
        this.loading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Authentication failed. Please verify credentials.';
        this.loading = false;
      }
    });
  }
}

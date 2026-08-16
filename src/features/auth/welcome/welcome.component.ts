import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="welcome-container fade-in">
      <div class="header-banner">
        <span class="material-icons-outlined banner-logo">directions_car</span>
        <h1>HighwayPool</h1>
        <p>Carpooling made safe, smart, and social</p>
      </div>

      <div class="cta-actions">
        <button class="ripple-btn full-width" (click)="router.navigate(['/login'])">
          Get Started
        </button>
        <button class="ripple-btn btn-secondary full-width" (click)="router.navigate(['/signup'])">
          Create Account
        </button>
      </div>

      <footer class="welcome-footer">
        <span>By signing in you agree to our Terms and Privacy Statement</span>
      </footer>
    </div>
  `,
  styles: [`
    .welcome-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 24px;
      background-color: hsl(var(--bg-secondary));
    }

    .header-banner {
      text-align: center;
      margin-top: 100px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;

      .banner-logo {
        font-size: 56px;
        color: var(--color-primary);
        filter: drop-shadow(0 4px 12px rgba(10, 132, 255, 0.3));
      }

      h1 {
        font-size: 2.1rem;
        font-weight: 800;
        letter-spacing: -1px;
        line-height: 1.1;
      }

      p {
        font-size: 0.88rem;
        color: hsl(var(--text-secondary));
        max-width: 250px;
        line-height: 1.4;
      }
    }

    .cta-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 40px;

      .full-width {
        width: 100%;
      }
    }

    .welcome-footer {
      text-align: center;
      margin-top: 30px;

      span {
        font-size: 0.68rem;
        color: hsl(var(--text-tertiary));
        line-height: 1.4;
      }
    }
  `]
})
export class WelcomeComponent {
  authStore = inject(AuthStore);
  authService = inject(AuthService);
  router = inject(Router);
}

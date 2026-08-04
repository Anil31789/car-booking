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

      <div class="visual-cards-container">
        <!-- Visual option 1 -->
        <div class="glass-panel visual-card" (click)="bypassLogin('passenger')">
          <div class="visual-icon bg-blue">
            <span class="material-icons-outlined">hail</span>
          </div>
          <div class="visual-desc">
            <h3>Passenger Demo</h3>
            <p>Sign in instantly as Rohan Deshmukh to search and book rides.</p>
          </div>
          <span class="material-icons-outlined arrow">arrow_forward</span>
        </div>

        <!-- Visual option 2 -->
        <div class="glass-panel visual-card" (click)="bypassLogin('driver')">
          <div class="visual-icon bg-green">
            <span class="material-icons-outlined">local_taxi</span>
          </div>
          <div class="visual-desc">
            <h3>Driver Demo</h3>
            <p>Sign in instantly as Amit Sharma to publish and manage offers.</p>
          </div>
          <span class="material-icons-outlined arrow">arrow_forward</span>
        </div>
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
      margin-top: 30px;
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

    .visual-cards-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin: 40px 0;
    }

    .visual-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px;
      cursor: pointer;
      border: 1px solid hsl(var(--border-light));
      transition: var(--transition-spring);

      &:hover {
        border-color: rgba(10, 132, 255, 0.2);
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }

      .visual-icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        
        span { font-size: 22px; }

        &.bg-blue {
          background-color: var(--color-primary);
          box-shadow: 0 4px 10px rgba(10, 132, 255, 0.3);
        }

        &.bg-green {
          background-color: var(--color-secondary);
          box-shadow: 0 4px 10px rgba(52, 199, 89, 0.3);
        }
      }

      .visual-desc {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;

        h3 {
          font-size: 0.95rem;
          font-weight: 800;
        }

        p {
          font-size: 0.75rem;
          color: hsl(var(--text-secondary));
          line-height: 1.35;
        }
      }

      .arrow {
        font-size: 18px;
        color: hsl(var(--text-tertiary));
      }
    }

    .cta-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      
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

  // Bypass session automatically for instant testing
  bypassLogin(role: 'passenger' | 'driver') {
    this.authService.demoLogin(role).subscribe({
      next: (res) => {
        this.authStore.setCurrentUser(res.user);
        this.authStore.setSession(res.token, res.refreshToken);
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Bypass login failed:', err);
      }
    });
  }
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-bottom-navigation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="bottom-nav glass-panel">
      <div 
        *ngFor="let item of navItems" 
        class="nav-item" 
        [class.active]="currentUrl === item.path" 
        (click)="navigate(item.path)">
        <span class="material-icons-outlined nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
        <div class="active-indicator" *ngIf="currentUrl === item.path"></div>
      </div>
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: fixed;
      bottom: 12px;
      left: 12px;
      right: 12px;
      height: 64px;
      border-radius: var(--border-radius-md);
      z-index: 1000;
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding: 0 8px !important;
      border: 1px solid var(--glass-border);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      
      @media (min-width: 501px) {
        width: 476px;
        left: 50%;
        transform: translateX(-50%);
        bottom: 16px;
      }
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      cursor: pointer;
      position: relative;
      width: 60px;
      height: 100%;
      user-select: none;
      transition: var(--transition-smooth);

      .nav-icon {
        font-size: 22px;
        color: hsl(var(--text-tertiary));
        transition: var(--transition-spring);
      }

      .nav-label {
        font-size: 0.62rem;
        font-weight: 700;
        color: hsl(var(--text-tertiary));
        transition: var(--transition-smooth);
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      &.active {
        .nav-icon {
          color: var(--color-primary);
          transform: translateY(-2px);
        }

        .nav-label {
          color: var(--color-primary);
        }
      }

      &:active {
        transform: scale(0.92);
      }
    }

    .active-indicator {
      position: absolute;
      bottom: 4px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background-color: var(--color-primary);
      box-shadow: 0 0 8px rgba(10, 132, 255, 0.6);
    }
  `]
})
export class BottomNavigationComponent {
  private router = inject(Router);

  currentUrl = '/';

  navItems = [
    { label: 'Home', icon: 'explore', path: '/' },
    { label: 'Search', icon: 'search', path: '/search' },
    { label: 'Bookings', icon: 'receipt_long', path: '/bookings' },
    { label: 'Driver', icon: 'dashboard', path: '/driver' },
    { label: 'Profile', icon: 'person', path: '/profile' }
  ];

  constructor() {
    // Sync current URL
    this.currentUrl = this.router.url.split('?')[0];

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentUrl = event.urlAfterRedirects.split('?')[0];
      });
  }

  navigate(path: string) {
    this.router.navigate([path]);
  }
}

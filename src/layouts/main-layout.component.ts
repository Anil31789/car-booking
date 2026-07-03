import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { BottomNavigationComponent } from '../shared/components/bottom-navigation.component';
import { AuthStore } from '../core/store/auth.store';
import { UserStore } from '../core/store/user.store';
import { NotificationStore } from '../core/store/notification.store';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, BottomNavigationComponent],
  template: `
    <header class="app-header glass-panel">
      <div class="header-container">
        <div class="app-logo" (click)="navigateHome()">
          <span class="material-icons-outlined brand-icon">directions_car</span>
          <span class="brand-name">CoRide</span>
        </div>
        
        <div class="header-actions">
          <!-- Light/Dark toggle button -->
          <button class="icon-btn" (click)="toggleTheme()" [title]="userStore.darkMode() ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
            <span class="material-icons-outlined">
              {{ userStore.darkMode() ? 'light_mode' : 'dark_mode' }}
            </span>
          </button>

          <!-- Notification Bell -->
          <button class="icon-btn notification-bell-btn" (click)="toggleNotifications()" [class.has-unread]="notificationStore.unreadCount() > 0" title="Notifications">
            <span class="material-icons-outlined">notifications</span>
            <span class="notification-badge" *ngIf="notificationStore.unreadCount() > 0">
              {{ notificationStore.unreadCount() }}
            </span>
          </button>
          
          <!-- User avatar initials link to profile -->
          <div class="user-avatar" *ngIf="authStore.currentUser() as user" (click)="navigateProfile()" [style.background-color]="getAvatarColor(user.name)">
            {{ getInitials(user.name) }}
          </div>
        </div>
      </div>
    </header>

    <!-- Notification Center Dropdown Drawer overlay -->
    <div class="notification-drawer glass-panel slide-in" *ngIf="showNotifications()">
      <header class="drawer-header">
        <h4>Notifications</h4>
        <div class="drawer-actions">
          <button class="txt-btn" (click)="notificationStore.markAllAsRead()" *ngIf="notificationStore.unreadCount() > 0">Mark all read</button>
          <button class="close-btn-icon" (click)="showNotifications.set(false)">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
      </header>
      
      <div class="drawer-content">
        <div class="notification-list" *ngIf="notificationStore.notifications().length > 0; else emptyNotifs">
          <div 
            class="notification-item" 
            *ngFor="let notif of notificationStore.notifications()" 
            [class.unread]="!notif.isRead"
            (click)="handleNotificationClick(notif)">
            <div class="notif-header">
              <span class="material-icons-outlined type-icon" [style.color]="getNotificationColor(notif.type)">
                {{ getNotificationIcon(notif.type) }}
              </span>
              <span class="notif-title">{{ notif.title }}</span>
              <span class="notif-time">{{ notif.createdAt | date:'shortTime' }}</span>
            </div>
            <p class="notif-message">{{ notif.message }}</p>
          </div>
        </div>
        <ng-template #emptyNotifs>
          <div class="empty-notifications">
            <span class="material-icons-outlined empty-icon">notifications_off</span>
            <p>You have no notifications</p>
          </div>
        </ng-template>
      </div>
    </div>
    
    <main class="main-content">
      <router-outlet></router-outlet>
    </main>
    
    <app-bottom-navigation *ngIf="showBottomNav()"></app-bottom-navigation>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
      position: relative;
      background-color: hsl(var(--bg-primary));
      box-shadow: var(--shadow-lg);
      border-left: 1px solid hsl(var(--border-light));
      border-right: 1px solid hsl(var(--border-light));
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }

    .app-header {
      position: sticky;
      top: 0;
      z-index: 100;
      height: 60px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      border-radius: 0 0 var(--border-radius-md) var(--border-radius-md) !important;
      border-top: none !important;
      border-left: none !important;
      border-right: none !important;
      box-shadow: var(--shadow-sm);
    }

    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .app-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      
      .brand-icon {
        color: var(--color-primary);
        font-size: 26px;
        transition: var(--transition-spring);
      }
      
      .brand-name {
        font-family: var(--font-primary);
        font-weight: 850;
        font-size: 1.25rem;
        letter-spacing: -0.6px;
        background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      &:active .brand-icon {
        transform: scale(0.9) rotate(-10deg);
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .notification-bell-btn {
      position: relative;
      
      &.has-unread {
        color: var(--color-primary);
      }
    }

    .notification-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      background-color: var(--color-danger);
      color: #ffffff;
      font-size: 0.62rem;
      font-weight: 800;
      min-width: 15px;
      height: 15px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      border: 1.5px solid hsl(var(--bg-primary));
    }

    /* Notification Drawer styles */
    .notification-drawer {
      position: absolute;
      top: 65px;
      right: 16px;
      left: 16px;
      z-index: 110;
      max-height: 380px;
      display: flex;
      flex-direction: column;
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-md);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      background-color: hsl(var(--bg-secondary));
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-bottom: 1px solid hsl(var(--border-light));
      
      h4 {
        margin: 0;
        font-size: 0.92rem;
        font-weight: 850;
        color: hsl(var(--text-primary));
      }
      
      .drawer-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .txt-btn {
        background: none;
        border: none;
        color: var(--color-primary);
        font-size: 0.72rem;
        font-weight: 700;
        cursor: pointer;
        padding: 4px;
        
        &:hover {
          text-decoration: underline;
        }
      }
      
      .close-btn-icon {
        background: none;
        border: none;
        cursor: pointer;
        color: hsl(var(--text-tertiary));
        display: flex;
        align-items: center;
        padding: 2px;
        
        span { font-size: 18px; }
        
        &:hover {
          color: hsl(var(--text-primary));
        }
      }
    }

    .drawer-content {
      overflow-y: auto;
      flex: 1;
      max-height: 320px;
    }

    .notification-list {
      display: flex;
      flex-direction: column;
    }

    .notification-item {
      padding: 12px 14px;
      border-bottom: 1px solid hsl(var(--border-light));
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: var(--transition-smooth);
      
      &:hover {
        background-color: hsl(var(--bg-secondary));
      }
      
      &.unread {
        background-color: rgba(10, 132, 255, 0.03);
        border-left: 3px solid var(--color-primary);
        padding-left: 11px;
      }
    }

    .notif-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      
      .type-icon {
        font-size: 16px;
      }
      
      .notif-title {
        font-weight: 750;
        color: hsl(var(--text-primary));
        flex: 1;
      }
      
      .notif-time {
        font-size: 0.65rem;
        color: hsl(var(--text-tertiary));
        font-weight: 500;
      }
    }

    .notif-message {
      margin: 0;
      font-size: 0.74rem;
      color: hsl(var(--text-secondary));
      line-height: 1.35;
    }

    .empty-notifications {
      padding: 40px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      color: hsl(var(--text-tertiary));
      
      .empty-icon {
        font-size: 36px;
        color: hsl(var(--text-tertiary));
      }
      
      p {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 600;
      }
    }

    .icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: hsl(var(--text-secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      border-radius: 50%;
      transition: var(--transition-smooth);
      
      span {
        font-size: 22px;
      }
      
      &:hover {
        background-color: hsl(var(--bg-tertiary));
        color: hsl(var(--text-primary));
      }
      
      &:active {
        transform: scale(0.95);
      }
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 750;
      font-size: 0.75rem;
      font-family: var(--font-primary);
      border: 1.5px solid var(--color-primary);
      cursor: pointer;
      user-select: none;
      box-shadow: var(--shadow-sm);
      transition: var(--transition-smooth);
      
      &:active {
        transform: scale(0.9);
      }
    }

    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
    }
  `]
})
export class MainLayoutComponent {
  authStore = inject(AuthStore);
  userStore = inject(UserStore);
  notificationStore = inject(NotificationStore);
  private router = inject(Router);

  showBottomNav = signal(true);
  showNotifications = signal(false);

  toggleNotifications() {
    this.showNotifications.update(s => !s);
    if (this.showNotifications()) {
      this.notificationStore.loadNotifications();
    }
  }

  getNotificationIcon(type: string): string {
    if (type === 'booking_request') return 'hail';
    if (type === 'booking_accepted') return 'check_circle';
    if (type === 'booking_rejected') return 'cancel';
    return 'notifications';
  }

  getNotificationColor(type: string): string {
    if (type === 'booking_request') return 'var(--color-primary)';
    if (type === 'booking_accepted') return 'var(--color-secondary)';
    if (type === 'booking_rejected') return 'var(--color-danger)';
    return 'hsl(var(--text-secondary))';
  }

  handleNotificationClick(notif: any) {
    this.notificationStore.markAsRead(notif.id);
    this.showNotifications.set(false);
    
    if (notif.type === 'booking_request') {
      this.router.navigate(['/driver']);
    } else {
      this.router.navigate(['/bookings']);
    }
  }

  constructor() {
    this.updateNavigationVisibility(this.router.url);
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateNavigationVisibility(event.urlAfterRedirects);
    });
  }

  private updateNavigationVisibility(url: string) {
    const cleanUrl = url.split('?')[0];
    const isSubPage = cleanUrl.startsWith('/ride/') || cleanUrl.startsWith('/booking/');
    this.showBottomNav.set(!isSubPage);
  }

  navigateHome() {
    this.router.navigate(['/']);
  }

  navigateProfile() {
    this.router.navigate(['/profile']);
  }

  toggleTheme() {
    this.userStore.toggleDarkMode();
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 65%, 45%)`;
  }
}

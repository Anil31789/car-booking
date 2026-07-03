import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../core/store/auth.store';
import { UserStore } from '../../core/store/user.store';
import { AuthService } from '../../core/services/auth.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { LegalDialogComponent } from './legal-dialog.component';
import { ContactDialogComponent } from './contact-dialog.component';
import { DonateDialogComponent } from './donate-dialog.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <div class="profile-page slide-in" *ngIf="authStore.currentUser() as user">
      <header class="page-header">
        <h3>Profile</h3>
      </header>

      <!-- Profile Summary Banner Card -->
      <section class="profile-summary glass-panel">
        <div class="avatar-circle" [style.background-color]="getAvatarColor(user.name)">
          {{ getInitials(user.name) }}
        </div>
        <div class="profile-meta">
          <h4>{{ user.name }}</h4>
          <span class="profile-phone">{{ user.phone }}</span>
          <span class="profile-email">{{ user.email }}</span>
        </div>
      </section>

      <!-- Verified driver badge status / license verification form -->
      <section class="profile-section glass-panel">
        <h4 class="section-title">Driver Credentials</h4>
        
        <!-- Case 1: Driver is already registered and verified -->
        <div class="verified-driver-status slide-in" *ngIf="authStore.isDriver()">
          <span class="material-icons-outlined verified-icon">verified</span>
          <div class="status-desc">
            <h5>Verified Carpool Driver</h5>
            <p>License Code: <strong>{{ user.licensePlaceholder }}</strong></p>
          </div>
        </div>

        <!-- Case 2: User is not registered as a driver yet -->
        <div class="driver-signup-form slide-in" *ngIf="!authStore.isDriver()">
          <p class="driver-prompt-text">Register as a driver to share your trip offers and save travel expenses.</p>
          
          <form (ngSubmit)="verifyLicense()" #licenseForm="ngForm" class="license-submit-form">
            <div class="custom-input-group">
              <label>Driving License Number</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined prefix-icon">badge</span>
                <input 
                  type="text" 
                  placeholder="e.g. DL-901239MH" 
                  [(ngModel)]="licenseCode" 
                  name="license"
                  required
                  #licInput="ngModel"
                  class="search-input" />
              </div>
            </div>

            <button 
              type="submit" 
              class="ripple-btn verify-btn" 
              [disabled]="licenseForm.invalid || loading">
              <span class="spinner" *ngIf="loading"></span>
              {{ loading ? 'Saving credentials...' : 'Verify License Code' }}
            </button>
          </form>
        </div>
      </section>

      <!-- Preferences and settings -->
      <section class="profile-section glass-panel">
        <h4 class="section-title">App Settings</h4>
        
        <!-- Toggle Dark Mode -->
        <div class="setting-row">
          <div class="setting-meta">
            <span class="setting-title">Dark Theme Mode</span>
            <span class="setting-sub">Toggle dark aesthetic interface</span>
          </div>
          
          <label class="ios-switch">
            <input 
              type="checkbox" 
              [ngModel]="userStore.darkMode()" 
              (ngModelChange)="toggleTheme()" />
            <span class="slider-switch"></span>
          </label>
        </div>
      </section>

      <!-- Legal and community settings section -->
      <section class="profile-section glass-panel">
        <h4 class="section-title">Legal & Community</h4>
        <div class="settings-list">
          
          <!-- About -->
          <div class="setting-row clickable" (click)="openLegal('about')">
            <div class="setting-meta">
              <span class="setting-title">About HighwayPool</span>
              <span class="setting-sub">Learn about our mission and carpooling</span>
            </div>
            <span class="material-icons-outlined arrow-icon">info</span>
          </div>

          <!-- Terms -->
          <div class="setting-row clickable" (click)="openLegal('terms')">
            <div class="setting-meta">
              <span class="setting-title">Terms & Conditions</span>
              <span class="setting-sub">Verify platform rules and liability exemptions</span>
            </div>
            <span class="material-icons-outlined arrow-icon">gavel</span>
          </div>

          <!-- Privacy -->
          <div class="setting-row clickable" (click)="openLegal('privacy')">
            <div class="setting-meta">
              <span class="setting-title">Privacy Policy</span>
              <span class="setting-sub">Check how your data is handled and deletion rights</span>
            </div>
            <span class="material-icons-outlined arrow-icon">security</span>
          </div>

          <!-- Guidelines -->
          <div class="setting-row clickable" (click)="openLegal('guidelines')">
            <div class="setting-meta">
              <span class="setting-title">Community Guidelines</span>
              <span class="setting-sub">Code of conduct and highway rules</span>
            </div>
            <span class="material-icons-outlined arrow-icon">groups</span>
          </div>

          <!-- Contact Us -->
          <div class="setting-row clickable" (click)="openContact()">
            <div class="setting-meta">
              <span class="setting-title">Contact & Support</span>
              <span class="setting-sub">Send feedback or reach our helpline</span>
            </div>
            <span class="material-icons-outlined arrow-icon">chat</span>
          </div>

          <!-- Donate -->
          <div class="setting-row clickable" (click)="openDonate()">
            <div class="setting-meta">
              <span class="setting-title">Support HighwayPool (Donate)</span>
              <span class="setting-sub text-danger font-sm">Help keep our servers active & voluntary donation</span>
            </div>
            <span class="material-icons-outlined arrow-icon text-danger">favorite</span>
          </div>

        </div>
      </section>

      <!-- Log out actions -->
      <div class="profile-actions">
        <button 
          class="ripple-btn btn-secondary logout-btn" 
          [class.confirm-logout-btn]="confirmLogout"
          (click)="onLogout()">
          <span class="material-icons-outlined">logout</span>
          {{ confirmLogout ? 'Click to Confirm Log Out' : 'Log Out Session' }}
        </button>
      </div>

    </div>
  `,
  styles: [`
    .profile-page {
      padding: 16px;
      padding-bottom: 100px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .page-header {
      h3 {
        font-size: 1.25rem;
        font-weight: 800;
        letter-spacing: -0.5px;
      }
    }

    /* Summary card banner */
    .profile-summary {
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .avatar-circle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 750;
      font-size: 1.35rem;
      font-family: var(--font-primary);
      border: 2px solid var(--color-primary);
      box-shadow: var(--shadow-sm);
    }

    .profile-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;

      h4 { font-size: 1.05rem; font-weight: 850; }
      .profile-phone { font-size: 0.82rem; color: hsl(var(--text-secondary)); font-weight: 600; }
      .profile-email { font-size: 0.72rem; color: hsl(var(--text-tertiary)); font-weight: 500; }
    }

    /* Common layout section */
    .profile-section {
      padding: 18px;
    }

    .section-title {
      font-size: 0.8rem;
      font-weight: 800;
      color: hsl(var(--text-secondary));
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 14px;
    }

    /* Verified driver badge */
    .verified-driver-status {
      display: flex;
      align-items: center;
      gap: 12px;
      background-color: rgba(52, 199, 89, 0.05);
      border: 1px solid rgba(52, 199, 89, 0.15);
      border-radius: 8px;
      padding: 12px 14px;

      .verified-icon {
        font-size: 32px;
        color: var(--color-secondary);
      }

      .status-desc {
        display: flex;
        flex-direction: column;
        gap: 2px;

        h5 { font-size: 0.88rem; font-weight: 800; color: var(--color-secondary); }
        p { font-size: 0.78rem; color: hsl(var(--text-secondary)); }
      }
    }

    /* Driver signup form */
    .driver-signup-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .driver-prompt-text {
      font-size: 0.8rem;
      color: hsl(var(--text-secondary));
      line-height: 1.45;
    }

    .license-submit-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .custom-input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.7rem;
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
        padding: 10px 12px;
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

      .search-input {
        border: none;
        background: none;
        outline: none;
        font-size: 0.9rem;
        font-weight: 600;
        color: hsl(var(--text-primary));
        width: 100%;
      }
    }

    .verify-btn {
      width: 100%;
      padding: 10px 14px;
      font-size: 0.8rem;
    }

    /* App settings */
    .setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .setting-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .setting-title {
      font-size: 0.85rem;
      font-weight: 750;
      color: hsl(var(--text-primary));
    }

    .setting-sub {
      font-size: 0.7rem;
      color: hsl(var(--text-secondary));
    }

    /* iOS custom switch style */
    .ios-switch {
      position: relative;
      display: inline-block;
      width: 46px;
      height: 26px;
      
      input { 
        opacity: 0;
        width: 0;
        height: 0;
        
        &:checked + .slider-switch {
          background-color: var(--color-secondary);
          
          &::before {
            transform: translateX(20px);
          }
        }
      }
    }

    .slider-switch {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: hsl(var(--border-medium));
      transition: .3s;
      border-radius: 34px;

      &::before {
        position: absolute;
        content: "";
        height: 20px;
        width: 20px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      }
    }

    /* Action logouts */
    .profile-actions {
      margin-top: 10px;
    }

    .logout-btn {
      width: 100%;
      padding: 14px;
      color: var(--color-danger);
      background-color: rgba(255, 69, 58, 0.05);
      border: 1px solid rgba(255, 69, 58, 0.1);
      
      &:hover {
        background-color: rgba(255, 69, 58, 0.1);
      }
    }

    .confirm-logout-btn {
      background-color: var(--color-danger) !important;
      color: white !important;
      border-color: var(--color-danger) !important;
      &:hover {
        background-color: var(--color-danger) !important;
      }
    }

    .settings-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .setting-row.clickable {
      cursor: pointer;
      transition: var(--transition-smooth);
      
      &:hover {
        opacity: 0.85;
        transform: translateX(4px);
      }
      
      .arrow-icon {
        color: hsl(var(--text-tertiary));
        font-size: 1.25rem;
      }

      .arrow-icon.text-danger {
        color: var(--color-danger);
      }
      
      .font-sm {
        font-size: 0.65rem;
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
export class ProfileComponent {
  authStore = inject(AuthStore);
  userStore = inject(UserStore);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  router = inject(Router);

  licenseCode = '';
  loading = false;
  confirmLogout = false;

  openLegal(type: 'about' | 'terms' | 'privacy' | 'guidelines') {
    this.dialog.open(LegalDialogComponent, {
      data: { type },
      width: '90%',
      maxWidth: '480px',
      panelClass: 'custom-dialog-panel'
    });
  }

  openContact() {
    this.dialog.open(ContactDialogComponent, {
      width: '90%',
      maxWidth: '480px',
      panelClass: 'custom-dialog-panel'
    });
  }

  openDonate() {
    this.dialog.open(DonateDialogComponent, {
      width: '90%',
      maxWidth: '480px',
      panelClass: 'custom-dialog-panel'
    });
  }

  verifyLicense() {
    if (!this.licenseCode) return;
    this.loading = true;
    this.authService.updateProfileLicense(this.licenseCode).subscribe({
      next: (user) => {
        this.authStore.setCurrentUser(user);
        this.loading = false;
        this.licenseCode = '';
      },
      error: () => this.loading = false
    });
  }

  toggleTheme() {
    this.userStore.toggleDarkMode();
  }

  onLogout() {
    if (this.confirmLogout) {
      this.authService.logout().subscribe(() => {
        this.authStore.logout();
        this.router.navigate(['/welcome']);
      });
      this.confirmLogout = false;
    } else {
      this.confirmLogout = true;
      setTimeout(() => {
        if (this.confirmLogout) {
          this.confirmLogout = false;
        }
      }, 3000);
    }
  }

  // Offline initials fallback generators
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

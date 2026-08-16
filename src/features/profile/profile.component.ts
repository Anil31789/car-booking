import { Component, inject, OnInit } from '@angular/core';
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

      <!-- Contact Information Section -->
      <section class="profile-section glass-panel">
        <h4 class="section-title">Contact Information</h4>
        <form (ngSubmit)="savePhone()" #phoneForm="ngForm" class="license-submit-form" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="custom-input-group">
            <label>Mobile Number</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined prefix-icon">phone</span>
              <input
                type="text"
                placeholder="e.g. +919876543210"
                [(ngModel)]="phoneValue"
                name="phone"
                required
                pattern="^\\+?[1-9]\\d{1,14}$"
                #phoneInput="ngModel"
                class="search-input" />
            </div>
            <div class="validation-msg" *ngIf="phoneInput.invalid && phoneInput.touched" style="font-size: 0.72rem; color: var(--color-danger); font-weight: 600; margin-top: 2px;">
              A valid phone number is required.
            </div>
          </div>

          <button
            type="submit"
            class="ripple-btn verify-btn"
            [disabled]="phoneForm.invalid || phoneLoading"
            style="width: 100%; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span class="spinner" *ngIf="phoneLoading"></span>
            {{ phoneLoading ? 'Saving number...' : 'Update Phone Number' }}
          </button>

          <div style="font-size: 0.78rem; color: var(--color-secondary); font-weight: 600; text-align: center; margin-top: 4px;" *ngIf="phoneSuccess">
            Phone number updated successfully!
          </div>
          <div style="font-size: 0.78rem; color: var(--color-danger); font-weight: 600; text-align: center; margin-top: 4px;" *ngIf="phoneError">
            {{ phoneError }}
          </div>
        </form>
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

      <!-- Security Settings -->
      <section class="profile-section glass-panel">
        <h4 class="section-title">Security & Account</h4>

        <!-- Setup Password -->
        <div class="setting-row" style="flex-direction: column; align-items: stretch; gap: 12px; padding: 12px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div class="setting-meta">
              <span class="setting-title">Account Password</span>
              <span class="setting-sub">Set password for email login capability</span>
            </div>

            <button
              type="button"
              class="ripple-btn"
              style="padding: 8px 16px; font-size: 0.8rem; background-color: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer;"
              (click)="showPasswordForm = !showPasswordForm">
              {{ showPasswordForm ? 'Cancel' : 'Set Password' }}
            </button>
          </div>

          <!-- Password Setup Inline Form -->
          <div class="password-setup-form slide-in" *ngIf="showPasswordForm" style="margin-top: 10px; border-top: 1px solid hsl(var(--border-light)); padding-top: 16px; width: 100%;">
            <form (ngSubmit)="savePassword()" #passForm="ngForm" style="display: flex; flex-direction: column; gap: 12px;">
              <div class="custom-input-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 0.7rem; font-weight: 700; color: hsl(var(--text-tertiary)); text-transform: uppercase;">Choose Password</label>
                <div class="input-wrapper" style="display: flex; align-items: center; border: 1px solid hsl(var(--border-light)); border-radius: var(--border-radius-sm); padding: 10px 12px; background-color: hsl(var(--bg-secondary));">
                  <input
                    type="password"
                    placeholder="Min 8 characters"
                    [(ngModel)]="newPassword"
                    name="newPassword"
                    required
                    minlength="8"
                    #newPassInput="ngModel"
                    style="border: none; background: none; outline: none; font-size: 0.9rem; color: hsl(var(--text-primary)); width: 100%;" />
                </div>
              </div>
              <button
                type="submit"
                class="ripple-btn"
                [disabled]="passForm.invalid || passLoading"
                style="padding: 10px; width: 100%; font-size: 0.85rem; border: none; border-radius: 4px; background-color: var(--color-primary); color: white; cursor: pointer;">
                {{ passLoading ? 'Saving password...' : 'Save Password' }}
              </button>

              <div style="font-size: 0.78rem; color: var(--color-secondary); font-weight: 600; text-align: center; margin-top: 4px;" *ngIf="passSuccess">
                Password configured successfully!
              </div>
              <div style="font-size: 0.78rem; color: var(--color-danger); font-weight: 600; text-align: center; margin-top: 4px;" *ngIf="passError">
                {{ passError }}
              </div>
            </form>
          </div>
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
export class ProfileComponent implements OnInit {
  authStore = inject(AuthStore);
  userStore = inject(UserStore);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  router = inject(Router);

  licenseCode = '';
  loading = false;
  confirmLogout = false;

  phoneValue = '';
  phoneLoading = false;
  phoneSuccess = false;
  phoneError = '';

  ngOnInit() {
    this.phoneValue = this.authStore.currentUser()?.phone || '';
  }

  savePhone() {
    if (!this.phoneValue) return;
    this.phoneLoading = true;
    this.phoneSuccess = false;
    this.phoneError = '';
    this.authService.updatePhone(this.phoneValue).subscribe({
      next: (updatedUser) => {
        this.authStore.setCurrentUser(updatedUser);
        this.phoneLoading = false;
        this.phoneSuccess = true;
        setTimeout(() => {
          this.phoneSuccess = false;
        }, 3000);
      },
      error: (err) => {
        this.phoneError = err.error?.error || 'Failed to update phone number. Please try again.';
        this.phoneLoading = false;
      }
    });
  }

  // Security password config logic
  showPasswordForm = false;
  newPassword = '';
  passLoading = false;
  passSuccess = false;
  passError = '';

  savePassword() {
    if (!this.newPassword || this.newPassword.length < 8) return;
    this.passLoading = true;
    this.passSuccess = false;
    this.passError = '';
    this.authService.setPassword(this.newPassword).subscribe({
      next: () => {
        this.passLoading = false;
        this.passSuccess = true;
        this.newPassword = '';
        setTimeout(() => {
          this.showPasswordForm = false;
          this.passSuccess = false;
        }, 3000);
      },
      error: (err) => {
        this.passError = err.error?.error || 'Failed to save password. Please try again.';
        this.passLoading = false;
      }
    });
  }

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

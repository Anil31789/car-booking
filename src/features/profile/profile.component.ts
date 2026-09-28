import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../core/store/auth.store';
import { UserStore } from '../../core/store/user.store';
import { AuthService } from '../../core/services/auth.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { extract10DigitPhone, normalizeIndianMobile } from '../../core/utils/phone.utils';
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
        <div class="avatar-container">
          <div class="avatar-circle" *ngIf="!user.photoUrl || photoImageError" [style.background-color]="getAvatarColor(user.name)">
            {{ getInitials(user.name) }}
          </div>
          <img *ngIf="user.photoUrl && !photoImageError" [src]="user.photoUrl" (error)="photoImageError = true" [alt]="user.name" class="avatar-img" />

          <button class="avatar-edit-btn" (click)="fileInput.click()" [disabled]="userStore.photoLoading()" title="Upload or Change Profile Photo">
            <span class="material-icons-outlined">camera_alt</span>
          </button>
        </div>

        <input type="file" #fileInput (change)="onFileSelected($event)" accept="image/jpeg,image/png,image/webp,image/gif" style="display: none;" />

        <div class="profile-meta">
          <h4>{{ user.name }}</h4>
          <span class="profile-phone">{{ user.phone }}</span>
          <span class="profile-email">{{ user.email }}</span>

          <div class="user-trust-stats">
            <span class="user-stat-badge" *ngIf="user.createdAt">
              <span class="material-icons-outlined">event</span>
              <span>Member since {{ user.createdAt | date:'MMM yyyy' }}</span>
            </span>
            <span class="user-stat-badge">
              <span class="material-icons-outlined">directions_car</span>
              <span>{{ (user.tripsCount !== undefined ? user.tripsCount : user.driverDetails?.tripsCount) || 0 }} completed {{ ((user.tripsCount !== undefined ? user.tripsCount : user.driverDetails?.tripsCount) || 0) === 1 ? 'trip' : 'trips' }}</span>
            </span>
          </div>

          <div class="photo-actions">
            <button class="btn-text upload-btn" (click)="fileInput.click()" [disabled]="userStore.photoLoading()">
              {{ user.photoUrl ? 'Change Photo' : 'Upload Photo' }}
            </button>
            <button class="btn-text remove-btn" *ngIf="user.photoUrl" (click)="removePhoto()" [disabled]="userStore.photoLoading()">
              Remove Photo
            </button>
          </div>

          <div class="photo-status" *ngIf="userStore.photoLoading()">
            <span class="spinner-small"></span>
            <span>Updating photo...</span>
          </div>

          <div class="photo-error-msg" *ngIf="userStore.photoError()">
            <span class="material-icons-outlined error-icon">error_outline</span>
            <span>{{ userStore.photoError() }}</span>
          </div>
        </div>
      </section>

      <!-- Verification Status Section -->
      <section class="profile-section glass-panel">
        <h4 class="section-title">Verification Status</h4>
        <div class="verification-list">
          <div class="verification-row">
            <div class="v-left">
              <span class="material-icons-outlined v-icon" [class.verified]="user.isMobileVerified">
                {{ user.isMobileVerified ? 'verified' : 'hourglass_empty' }}
              </span>
              <div class="v-details">
                <span class="v-title">Phone Number</span>
                <span class="v-sub">{{ user.phone || 'No phone number added' }}</span>
              </div>
            </div>
            <span class="v-pill" [class.pill-success]="user.isMobileVerified">
              {{ user.isMobileVerified ? 'Verified' : 'Pending' }}
            </span>
          </div>

          <div class="verification-row">
            <div class="v-left">
              <span class="material-icons-outlined v-icon" [class.verified]="user.isEmailVerified">
                {{ user.isEmailVerified ? 'verified' : 'hourglass_empty' }}
              </span>
              <div class="v-details">
                <span class="v-title">Email Address</span>
                <span class="v-sub">{{ user.email || 'No email added' }}</span>
              </div>
            </div>
            <span class="v-pill" [class.pill-success]="user.isEmailVerified">
              {{ user.isEmailVerified ? 'Verified' : 'Pending' }}
            </span>
          </div>

          <div class="verification-row">
            <div class="v-left">
              <span class="material-icons-outlined v-icon" [class.verified]="user.isLicenseVerified || user.driverDetails?.isLicenseVerified">
                {{ (user.isLicenseVerified || user.driverDetails?.isLicenseVerified) ? 'verified' : 'hourglass_empty' }}
              </span>
              <div class="v-details">
                <span class="v-title">Driving License</span>
                <span class="v-sub">{{ (user.isLicenseVerified || user.driverDetails?.isLicenseVerified) ? (user.licensePlaceholder || user.driverDetails?.licenseNumber || 'License verified') : 'Not verified yet' }}</span>
              </div>
            </div>
            <span class="v-pill" [class.pill-success]="user.isLicenseVerified || user.driverDetails?.isLicenseVerified">
              {{ (user.isLicenseVerified || user.driverDetails?.isLicenseVerified) ? 'Verified' : 'Not Verified' }}
            </span>
          </div>
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

      <!-- Registered Vehicles & Photos Section -->
      <section class="profile-section glass-panel" *ngIf="user.licensePlaceholder || authStore.isDriver() || (user.registeredVehicles && user.registeredVehicles.length > 0)">
        <div class="section-header-row">
          <h4 class="section-title" style="margin-bottom: 0;">Registered Vehicles & Photos</h4>
          <button class="btn-text add-veh-toggle-btn" (click)="showAddVehicleForm = !showAddVehicleForm">
            <span class="material-icons-outlined">{{ showAddVehicleForm ? 'close' : 'add' }}</span>
            {{ showAddVehicleForm ? 'Cancel' : 'Add Vehicle' }}
          </button>
        </div>
        <p class="veh-section-subtitle">
          Manage your vehicle photos. Upload up to 3 photos per vehicle to show co-passengers on your ride details.
        </p>

        <!-- Inline Add Vehicle Form -->
        <div class="add-vehicle-form slide-in" *ngIf="showAddVehicleForm">
          <form (ngSubmit)="saveNewVehicle()" #newVehForm="ngForm" class="vehicle-form-inline">
            <div class="veh-form-grid">
              <div class="custom-input-group">
                <label>Vehicle Model</label>
                <div class="input-wrapper">
                  <span class="material-icons-outlined prefix-icon">label</span>
                  <input type="text" placeholder="e.g. Honda City" [(ngModel)]="newVehModel" name="newVehModel" required class="search-input" />
                </div>
              </div>
              <div class="custom-input-group">
                <label>Number Plate</label>
                <div class="input-wrapper">
                  <span class="material-icons-outlined prefix-icon">pin</span>
                  <input type="text" placeholder="e.g. MH 02 BD 8492" [(ngModel)]="newVehPlate" name="newVehPlate" required class="search-input" />
                </div>
              </div>
              <div class="custom-input-group">
                <label>Body Type</label>
                <div class="input-wrapper">
                  <span class="material-icons-outlined prefix-icon">commute</span>
                  <select [(ngModel)]="newVehType" name="newVehType" class="search-input" style="background: none;">
                    <option value="Sedan">Sedan</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="SUV">SUV</option>
                    <option value="EV">EV / Electric</option>
                    <option value="Luxury">Premium / Luxury</option>
                  </select>
                </div>
              </div>
              <div class="custom-input-group">
                <label>Color</label>
                <div class="input-wrapper">
                  <span class="material-icons-outlined prefix-icon">palette</span>
                  <input type="text" placeholder="e.g. Silver Metallic" [(ngModel)]="newVehColor" name="newVehColor" class="search-input" />
                </div>
              </div>
            </div>

            <div class="veh-form-actions">
              <button type="submit" class="ripple-btn add-v-btn" [disabled]="newVehForm.invalid || newVehLoading">
                <span class="spinner" *ngIf="newVehLoading"></span>
                {{ newVehLoading ? 'Saving Vehicle...' : 'Register Vehicle' }}
              </button>
            </div>
            <div class="error-msg-banner" *ngIf="newVehError">{{ newVehError }}</div>
          </form>
        </div>

        <!-- Vehicles List -->
        <div class="registered-vehicles-list" *ngIf="user.registeredVehicles && user.registeredVehicles.length > 0">
          <div class="profile-vehicle-card" *ngFor="let veh of user.registeredVehicles">
            <div class="pveh-header">
              <div>
                <div class="pveh-title-row">
                  <span class="material-icons-outlined pveh-car-icon">directions_car</span>
                  <h5>{{ veh.model }}</h5>
                  <span class="pveh-plate">{{ veh.numberPlate }}</span>
                </div>
                <div class="pveh-sub">
                  <span>{{ veh.type || 'Sedan' }} &bull; {{ veh.color || 'Standard' }}</span>
                </div>
              </div>
              <span class="pveh-photo-count-pill" [class.full]="(veh.photos?.length || 0) >= 3">
                {{ (veh.photos?.length || 0) }}/3 photos
              </span>
            </div>

            <!-- Photo Gallery Grid -->
            <div class="pveh-photos-grid">
              <!-- Existing Photos with photoDetails -->
              <div class="pveh-photo-item" *ngFor="let photo of (veh.photoDetails || []); let pIdx = index">
                <img [src]="photo.photoUrl" [alt]="veh.model + ' photo ' + (pIdx + 1)" (click)="openPhotoPreview(photo.photoUrl)" />
                <div class="photo-overlay">
                  <button 
                    type="button" 
                    class="photo-action-btn view-btn" 
                    (click)="openPhotoPreview(photo.photoUrl)" 
                    title="View Full Size">
                    <span class="material-icons-outlined">visibility</span>
                  </button>
                  <button 
                    type="button" 
                    class="photo-action-btn replace-btn" 
                    (click)="replaceInput.click()" 
                    [disabled]="vehicleLoading[veh.id]" 
                    title="Replace Photo">
                    <span class="material-icons-outlined">edit</span>
                  </button>
                  <button 
                    type="button" 
                    class="photo-action-btn delete-btn" 
                    (click)="deleteVehiclePhoto(veh.id, photo.id)" 
                    [disabled]="vehicleLoading[veh.id]" 
                    title="Delete Photo">
                    <span class="material-icons-outlined">delete</span>
                  </button>
                </div>
                <input 
                  type="file" 
                  #replaceInput 
                  (change)="onVehiclePhotoSelected($event, veh.id, photo.id)" 
                  accept="image/jpeg,image/png,image/webp" 
                  style="display: none;" />
              </div>

              <!-- Fallback rendering if photoDetails is empty but photos URL array exists -->
              <ng-container *ngIf="(!veh.photoDetails || veh.photoDetails.length === 0) && (veh.photos && veh.photos.length > 0)">
                <div class="pveh-photo-item" *ngFor="let url of veh.photos; let pIdx = index">
                  <img [src]="url" [alt]="veh.model + ' photo ' + (pIdx + 1)" (click)="openPhotoPreview(url)" />
                  <div class="photo-overlay">
                    <button type="button" class="photo-action-btn view-btn" (click)="openPhotoPreview(url)" title="View Full Size">
                      <span class="material-icons-outlined">visibility</span>
                    </button>
                  </div>
                </div>
              </ng-container>

              <!-- Add Photo Slot (if < 3) -->
              <div 
                class="pveh-add-slot" 
                *ngIf="(veh.photos?.length || 0) < 3 && !vehicleLoading[veh.id]"
                (click)="addPhotoInput.click()"
                title="Add vehicle photo (Max 3, up to 5 MB)">
                <span class="material-icons-outlined">add_a_photo</span>
                <span class="slot-label">Add Photo</span>
                <input 
                  type="file" 
                  #addPhotoInput 
                  (change)="onVehiclePhotoSelected($event, veh.id)" 
                  accept="image/jpeg,image/png,image/webp" 
                  style="display: none;" />
              </div>

              <!-- Limit Reached Badge -->
              <div class="pveh-limit-slot" *ngIf="(veh.photos?.length || 0) >= 3">
                <span class="material-icons-outlined">check_circle</span>
                <span class="limit-label">Max 3/3 Reached</span>
              </div>
            </div>

            <!-- Vehicle Photo loading/status/error indicators -->
            <div class="pveh-status-row" *ngIf="vehicleLoading[veh.id]">
              <span class="spinner-small"></span>
              <span>Processing vehicle photo...</span>
            </div>
            <div class="pveh-success-row" *ngIf="vehicleSuccess[veh.id]">
              <span class="material-icons-outlined">check</span>
              <span>{{ vehicleSuccess[veh.id] }}</span>
            </div>
            <div class="pveh-error-row" *ngIf="vehicleError[veh.id]">
              <span class="material-icons-outlined error-icon">error_outline</span>
              <span>{{ vehicleError[veh.id] }}</span>
            </div>
          </div>
        </div>

        <!-- Empty state when no vehicles registered yet -->
        <div class="no-vehicles-empty" *ngIf="!user.registeredVehicles || user.registeredVehicles.length === 0">
          <span class="material-icons-outlined empty-car-icon">no_crash</span>
          <p>No vehicles registered yet. Click "+ Add Vehicle" to register a car and upload photos.</p>
        </div>
      </section>

      <!-- Contact Information Section -->
      <section class="profile-section glass-panel">
        <h4 class="section-title">Contact Information</h4>
        <form (ngSubmit)="savePhone()" class="phone-form" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="custom-input-group">
            <label>Mobile Number</label>
            <div class="phone-input-wrapper">
              <span class="country-code-pill">
                <span class="flag-icon">🇮🇳</span>
                <span class="code-text">+91</span>
              </span>
              <input
                type="tel"
                inputmode="numeric"
                maxlength="10"
                placeholder="10-digit mobile number"
                [value]="phoneValue"
                (input)="onPhoneInput($event)"
                (paste)="onPhonePaste($event)"
                name="phone"
                required
                class="phone-number-input" />
            </div>
            <div class="field-hint" *ngIf="phoneValue.length > 0 && phoneValue.length < 10">
              Please enter {{ 10 - phoneValue.length }} more {{ 10 - phoneValue.length === 1 ? 'digit' : 'digits' }}
            </div>
            <div class="field-hint verified-hint" *ngIf="phoneValue.length === 10">
              <span class="material-icons-outlined hint-icon">check_circle</span>
              <span>Ready to save: +91 {{ phoneValue }}</span>
            </div>
          </div>

          <button
            type="submit"
            class="ripple-btn verify-btn"
            [disabled]="phoneValue.length !== 10 || phoneLoading"
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

      <!-- Lightbox Photo Preview Modal -->
      <div class="lightbox-backdrop fade-in" *ngIf="previewPhotoUrl" (click)="closePhotoPreview()">
        <div class="lightbox-modal slide-up" (click)="$event.stopPropagation()">
          <button class="lightbox-close-btn" (click)="closePhotoPreview()" title="Close">
            <span class="material-icons-outlined">close</span>
          </button>
          <img [src]="previewPhotoUrl" alt="Vehicle Photo Preview" class="lightbox-img" />
        </div>
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

    .avatar-container {
      position: relative;
      width: 64px;
      height: 64px;
      flex-shrink: 0;
    }

    .avatar-circle {
      width: 64px;
      height: 64px;
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

    .avatar-img {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--color-primary);
      box-shadow: var(--shadow-sm);
    }

    .avatar-edit-btn {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background-color: var(--color-primary);
      color: #ffffff;
      border: 2px solid hsl(var(--bg-primary));
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: var(--transition-smooth);

      span {
        font-size: 14px;
      }

      &:hover {
        transform: scale(1.1);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .photo-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 4px;

      .btn-text {
        background: none;
        border: none;
        padding: 0;
        font-size: 0.76rem;
        font-weight: 700;
        cursor: pointer;
        transition: var(--transition-smooth);

        &.upload-btn {
          color: var(--color-primary);
          &:hover { text-decoration: underline; }
        }

        &.remove-btn {
          color: var(--color-danger, #ff453a);
          &:hover { text-decoration: underline; }
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }

    .photo-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      color: hsl(var(--text-secondary));
      margin-top: 4px;
    }

    .photo-error-msg {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
      color: var(--color-danger, #ff453a);
      font-weight: 600;
      margin-top: 4px;

      .error-icon {
        font-size: 14px;
      }
    }

    .profile-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;

      h4 { font-size: 1.05rem; font-weight: 850; }
      .profile-phone { font-size: 0.82rem; color: hsl(var(--text-secondary)); font-weight: 600; }
      .profile-email { font-size: 0.72rem; color: hsl(var(--text-tertiary)); font-weight: 500; }
    }

    .user-trust-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
      margin-bottom: 2px;
    }

    .user-stat-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      color: hsl(var(--text-secondary));
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      padding: 2px 7px;
      border-radius: var(--border-radius-sm);

      span.material-icons-outlined {
        font-size: 13px;
        color: var(--color-primary);
      }
    }

    /* Verification Status Checklist */
    .verification-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .verification-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
    }

    .v-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .v-icon {
      font-size: 22px;
      color: hsl(var(--text-tertiary));

      &.verified {
        color: var(--color-secondary);
      }
    }

    .v-details {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .v-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: hsl(var(--text-primary));
    }

    .v-sub {
      font-size: 0.72rem;
      color: hsl(var(--text-secondary));
    }

    .v-pill {
      font-size: 0.68rem;
      font-weight: 750;
      padding: 3px 8px;
      border-radius: 999px;
      background-color: hsl(var(--bg-tertiary));
      color: hsl(var(--text-tertiary));
      border: 1px solid hsl(var(--border-light));
      text-transform: uppercase;
      letter-spacing: 0.3px;

      &.pill-success {
        background-color: rgba(52, 199, 89, 0.12);
        color: var(--color-secondary);
        border-color: rgba(52, 199, 89, 0.25);
      }
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
    }

    /* Indian phone input with fixed +91 pill */
    .phone-input-wrapper {
      display: flex;
      align-items: center;
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      background-color: hsl(var(--bg-secondary));
      transition: var(--transition-smooth);
      overflow: hidden;

      &:focus-within {
        border-color: var(--color-primary);
        background-color: hsl(var(--bg-primary));
        box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15);
      }
    }

    .country-code-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      background-color: hsl(var(--bg-tertiary, var(--bg-primary)));
      border-right: 1px solid hsl(var(--border-light));
      color: hsl(var(--text-primary));
      font-weight: 700;
      font-size: 0.88rem;
      user-select: none;
      flex-shrink: 0;

      .flag-icon {
        font-size: 1.05rem;
      }
    }

    .phone-number-input {
      flex: 1;
      border: none;
      background: none;
      outline: none;
      padding: 10px 14px;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 1px;
      color: hsl(var(--text-primary));
      font-family: inherit;

      &::placeholder {
        letter-spacing: normal;
        font-weight: 500;
        color: hsl(var(--text-tertiary));
      }
    }

    .field-hint {
      font-size: 0.72rem;
      color: hsl(var(--text-tertiary));
      margin-top: 2px;
      font-weight: 500;

      &.verified-hint {
        color: var(--color-secondary);
        display: flex;
        align-items: center;
        gap: 4px;
        font-weight: 600;

        .hint-icon {
          font-size: 14px;
        }
      }
    }

    /* Registered Vehicles & Photos styles */
    .section-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .veh-section-subtitle {
      font-size: 0.75rem;
      color: hsl(var(--text-secondary));
      margin-bottom: 14px;
      line-height: 1.4;
    }

    .add-veh-toggle-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      color: var(--color-primary);
      font-size: 0.78rem;
      font-weight: 750;
      cursor: pointer;

      span {
        font-size: 18px;
      }

      &:hover {
        text-decoration: underline;
      }
    }

    .add-vehicle-form {
      background: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-md);
      padding: 14px;
      margin-bottom: 16px;
    }

    .veh-form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 12px;

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }

    .veh-form-actions {
      display: flex;
      justify-content: flex-end;
    }

    .add-v-btn {
      padding: 8px 18px;
      font-size: 0.8rem;
      background-color: var(--color-primary);
      color: #ffffff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .registered-vehicles-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .profile-vehicle-card {
      background: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-md);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .pveh-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .pveh-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      .pveh-car-icon {
        font-size: 22px;
        color: var(--color-primary);
      }

      h5 {
        font-size: 0.95rem;
        font-weight: 800;
        color: hsl(var(--text-primary));
        margin: 0;
      }

      .pveh-plate {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        background: hsl(var(--bg-primary));
        border: 1px solid hsl(var(--border-light));
        color: hsl(var(--text-secondary));
        letter-spacing: 0.5px;
      }
    }

    .pveh-sub {
      font-size: 0.75rem;
      color: hsl(var(--text-secondary));
      margin-top: 2px;
    }

    .pveh-photo-count-pill {
      font-size: 0.72rem;
      font-weight: 750;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(10, 132, 255, 0.1);
      color: var(--color-primary);
      border: 1px solid rgba(10, 132, 255, 0.2);
      white-space: nowrap;

      &.full {
        background: rgba(52, 199, 89, 0.12);
        color: var(--color-secondary);
        border-color: rgba(52, 199, 89, 0.25);
      }
    }

    .pveh-photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .pveh-photo-item {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      overflow: hidden;
      background: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
      cursor: pointer;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.2s ease;
      }

      &:hover img {
        transform: scale(1.05);
      }

      .photo-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      &:hover .photo-overlay {
        opacity: 1;
      }

      .photo-action-btn {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.9);
        color: #1c1c1e;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease;

        span { font-size: 15px; }

        &:hover {
          transform: scale(1.15);
          background: #ffffff;
        }

        &.delete-btn {
          background: rgba(255, 69, 58, 0.9);
          color: #ffffff;
          &:hover { background: #ff453a; }
        }
      }
    }

    .pveh-add-slot {
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      border: 2px dashed hsl(var(--border-light));
      background: rgba(255, 255, 255, 0.02);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
      transition: var(--transition-smooth);
      color: hsl(var(--text-secondary));

      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background: rgba(10, 132, 255, 0.06);
      }

      span.material-icons-outlined {
        font-size: 24px;
      }

      span.slot-label {
        font-size: 0.7rem;
        font-weight: 700;
      }
    }

    .pveh-limit-slot {
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      border: 1px dashed rgba(52, 199, 89, 0.25);
      background: rgba(52, 199, 89, 0.04);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: var(--color-secondary);

      span.material-icons-outlined {
        font-size: 22px;
      }

      span.limit-label {
        font-size: 0.68rem;
        font-weight: 700;
      }
    }

    .pveh-status-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      color: hsl(var(--text-secondary));
    }

    .pveh-success-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      color: var(--color-secondary);
      font-weight: 600;

      span.material-icons-outlined { font-size: 16px; }
    }

    .pveh-error-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      color: var(--color-danger);
      font-weight: 600;

      .error-icon { font-size: 16px; }
    }

    .no-vehicles-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      text-align: center;
      gap: 8px;
      color: hsl(var(--text-secondary));

      .empty-car-icon {
        font-size: 36px;
        color: hsl(var(--text-tertiary));
      }

      p {
        font-size: 0.8rem;
        margin: 0;
      }
    }

    .error-msg-banner {
      font-size: 0.75rem;
      color: var(--color-danger);
      font-weight: 600;
      margin-top: 6px;
    }

    /* Lightbox Modal */
    .lightbox-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .lightbox-modal {
      position: relative;
      max-width: 90vw;
      max-height: 85vh;
      display: flex;
      align-items: center;
      justify-content: center;

      img {
        max-width: 100%;
        max-height: 85vh;
        object-fit: contain;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
      }

      .lightbox-close-btn {
        position: absolute;
        top: -16px;
        right: -16px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        transition: transform 0.2s ease;

        &:hover {
          transform: scale(1.1);
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
export class ProfileComponent implements OnInit {
  authStore = inject(AuthStore);
  userStore = inject(UserStore);
  private authService = inject(AuthService);
  private vehicleService = inject(VehicleService);
  private dialog = inject(MatDialog);
  router = inject(Router);

  licenseCode = '';
  loading = false;
  confirmLogout = false;

  phoneValue = '';
  phoneLoading = false;
  phoneSuccess = false;
  phoneError = '';

  // Vehicle & Photo Management
  vehicleLoading: { [vehId: string]: boolean } = {};
  vehicleError: { [vehId: string]: string } = {};
  vehicleSuccess: { [vehId: string]: string } = {};
  previewPhotoUrl: string | null = null;

  showAddVehicleForm = false;
  newVehModel = '';
  newVehPlate = '';
  newVehType = 'Sedan';
  newVehColor = 'Silver';
  newVehLoading = false;
  newVehError = '';

  ngOnInit() {
    this.phoneValue = extract10DigitPhone(this.authStore.currentUser()?.phone);
    this.authService.getCurrentUser().subscribe(u => {
      if (u) {
        this.authStore.setCurrentUser(u);
        if (!this.phoneValue && u.phone) {
          this.phoneValue = extract10DigitPhone(u.phone);
        }
      }
    });
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    this.phoneValue = digits;
    input.value = digits;
  }

  onPhonePaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') || '';
    const digits = extract10DigitPhone(text).slice(0, 10);
    this.phoneValue = digits;
  }

  savePhone() {
    if (this.phoneValue.length !== 10) {
      this.phoneError = 'Please enter a valid 10-digit Indian mobile number.';
      return;
    }
    const normalized = normalizeIndianMobile(this.phoneValue);
    if (!normalized) {
      this.phoneError = 'Please enter a valid 10-digit Indian mobile number.';
      return;
    }
    this.phoneLoading = true;
    this.phoneSuccess = false;
    this.phoneError = '';
    this.authService.updatePhone(normalized).subscribe({
      next: (updatedUser) => {
        this.authStore.setCurrentUser(updatedUser);
        this.phoneValue = extract10DigitPhone(updatedUser.phone);
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

  saveNewVehicle() {
    if (!this.newVehModel || !this.newVehPlate) {
      this.newVehError = 'Vehicle model and number plate are required.';
      return;
    }
    this.newVehLoading = true;
    this.newVehError = '';
    this.vehicleService.addVehicle({
      model: this.newVehModel.trim(),
      numberPlate: this.newVehPlate.trim().toUpperCase(),
      type: this.newVehType,
      color: this.newVehColor.trim() || 'Standard'
    }).subscribe({
      next: (res) => {
        this.newVehLoading = false;
        this.showAddVehicleForm = false;
        this.newVehModel = '';
        this.newVehPlate = '';
        const user = this.authStore.currentUser();
        if (user) {
          const existing = user.registeredVehicles || [];
          this.authStore.setCurrentUser({
            ...user,
            registeredVehicles: [...existing, res.vehicle]
          });
        }
      },
      error: (err) => {
        this.newVehLoading = false;
        this.newVehError = err.error?.error || 'Failed to register vehicle. Please try again.';
      }
    });
  }

  async onVehiclePhotoSelected(event: Event, vehicleId: string, replacePhotoId?: string) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    input.value = '';

    if (file.size > 5 * 1024 * 1024) {
      this.vehicleError[vehicleId] = 'Image file size exceeds maximum limit of 5 MB.';
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.vehicleError[vehicleId] = 'Invalid image format. Allowed formats: JPEG, PNG, WEBP.';
      return;
    }

    this.vehicleLoading[vehicleId] = true;
    this.vehicleError[vehicleId] = '';
    this.vehicleSuccess[vehicleId] = '';

    try {
      const resizedBase64 = await this.resizeImage(file, 1200, 900);
      const request$ = replacePhotoId
        ? this.vehicleService.replaceVehiclePhoto(vehicleId, replacePhotoId, resizedBase64)
        : this.vehicleService.uploadVehiclePhoto(vehicleId, resizedBase64);

      request$.subscribe({
        next: (res) => {
          this.vehicleLoading[vehicleId] = false;
          this.vehicleSuccess[vehicleId] = replacePhotoId ? 'Photo replaced successfully!' : 'Photo uploaded successfully!';
          this.updateVehiclePhotosInStore(vehicleId, res.photos);
          setTimeout(() => { this.vehicleSuccess[vehicleId] = ''; }, 3000);
        },
        error: (err) => {
          this.vehicleLoading[vehicleId] = false;
          this.vehicleError[vehicleId] = err.error?.error || 'Failed to upload vehicle photo.';
        }
      });
    } catch (err) {
      this.vehicleLoading[vehicleId] = false;
      this.vehicleError[vehicleId] = 'Failed to process selected image file.';
    }
  }

  deleteVehiclePhoto(vehicleId: string, photoId: string) {
    if (!confirm('Are you sure you want to delete this vehicle photo?')) return;
    this.vehicleLoading[vehicleId] = true;
    this.vehicleError[vehicleId] = '';
    this.vehicleSuccess[vehicleId] = '';

    this.vehicleService.deleteVehiclePhoto(vehicleId, photoId).subscribe({
      next: (res) => {
        this.vehicleLoading[vehicleId] = false;
        this.vehicleSuccess[vehicleId] = 'Photo deleted successfully.';
        this.updateVehiclePhotosInStore(vehicleId, res.photos);
        setTimeout(() => { this.vehicleSuccess[vehicleId] = ''; }, 3000);
      },
      error: (err) => {
        this.vehicleLoading[vehicleId] = false;
        this.vehicleError[vehicleId] = err.error?.error || 'Failed to delete vehicle photo.';
      }
    });
  }

  private updateVehiclePhotosInStore(vehicleId: string, photos: any[]) {
    const user = this.authStore.currentUser();
    if (!user || !user.registeredVehicles) return;
    const updated = user.registeredVehicles.map(veh => {
      if (veh.id === vehicleId) {
        return {
          ...veh,
          photos: photos.map(p => p.photoUrl),
          photoDetails: photos
        };
      }
      return veh;
    });
    this.authStore.setCurrentUser({
      ...user,
      registeredVehicles: updated
    });
  }

  openPhotoPreview(url?: string | null) {
    if (url) {
      this.previewPhotoUrl = url;
    }
  }

  closePhotoPreview() {
    this.previewPhotoUrl = null;
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

  photoImageError = false;

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    input.value = '';

    // Validate size (max 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      this.userStore.photoError.set('Image file size exceeds maximum limit of 5 MB.');
      return;
    }

    // Validate format
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      this.userStore.photoError.set('Invalid file type. Please select a JPEG, PNG, WEBP, or GIF image.');
      return;
    }

    try {
      const resizedDataUrl = await this.resizeImage(file, 500, 500);
      this.photoImageError = false;
      await this.userStore.uploadProfilePhoto(resizedDataUrl, this.authStore);
    } catch (err) {
      this.userStore.photoError.set('Failed to process selected image file.');
    }
  }

  async removePhoto() {
    this.photoImageError = false;
    await this.userStore.removeProfilePhoto(this.authStore);
  }

  private resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target.result);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = (err) => reject(err);
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
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

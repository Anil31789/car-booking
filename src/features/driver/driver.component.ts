import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RideStore } from '../../core/store/ride.store';
import { AuthStore } from '../../core/store/auth.store';
import { BookingStore } from '../../core/store/booking.store';
import { Stop } from '../../core/models/ride.models';
import { LocationAutocompleteComponent } from '../../shared/components/location-autocomplete.component';
import { RideService } from '../../core/services/ride.service';

interface PassengerRequest {
  id: string;
  passengerName: string;
  passengerPhoto: string;
  seats: number;
  rideId: string;
  rideRoute: string;
  status: 'pending' | 'accepted' | 'rejected';
}

@Component({
  selector: 'app-driver',
  standalone: true,
  imports: [CommonModule, FormsModule, LocationAutocompleteComponent],
  template: `
    <div class="driver-page slide-in">
      
      <!-- Premium Segmented View Control -->
      <section class="segment-controls">
        <button 
          class="segment-btn" 
          [class.active]="activeTab === 'listings'" 
          (click)="switchTab('listings')">
          <span class="material-icons-outlined">directions_car</span>
          My Offers
        </button>
        <button 
          class="segment-btn" 
          [class.active]="activeTab === 'publish'" 
          (click)="switchTab('publish')">
          <span class="material-icons-outlined">add_circle</span>
          Offer a Ride
        </button>
      </section>

      <!-- TAB 1: Manage Ride Listings & Passenger Requests -->
      <div class="tab-content" *ngIf="activeTab === 'listings'">
        
        <!-- Passenger Requests / Approvals Panel -->
        <section class="approvals-section" *ngIf="incomingRequests.length > 0">
          <h3 class="section-title">Incoming Booking Requests</h3>
          <div class="requests-list">
            <div 
              *ngFor="let req of incomingRequests" 
              class="request-card glass-panel">
              
              <div class="req-header">
                <div class="req-avatar" [style.background-color]="getAvatarColor(req.passengerName)">
                  {{ getInitials(req.passengerName) }}
                </div>
                <div class="req-meta">
                  <span class="req-name">{{ req.passengerName }}</span>
                  <span class="req-seats">Wants {{ req.seats }} seat{{ req.seats > 1 ? 's' : '' }}</span>
                </div>
                <span class="req-badge">₹{{ req.totalPrice }}</span>
              </div>
              
              <p class="req-route-info">
                Route: <strong>{{ req.rideRoute }}</strong>
              </p>

              <!-- Real Accept/Reject triggers -->
              <div class="req-actions">
                <button class="ripple-btn btn-secondary reject-btn" (click)="rejectRequest(req.id)">
                  Reject
                </button>
                <button class="ripple-btn accept-btn" (click)="acceptRequest(req.id, req.rideId, req.seats)">
                  Accept
                </button>
              </div>

            </div>
          </div>
        </section>

        <!-- Confirmed Bookings & Payments Panel -->
        <section class="approvals-section" *ngIf="confirmedBookings.length > 0">
          <h3 class="section-title">Confirmed Bookings & Payments</h3>
          <div class="requests-list">
            <div 
              *ngFor="let req of confirmedBookings" 
              class="request-card glass-panel">
              
              <div class="req-header">
                <div class="req-avatar" [style.background-color]="getAvatarColor(req.passengerName)">
                  {{ getInitials(req.passengerName) }}
                </div>
                <div class="req-meta">
                  <span class="req-name">{{ req.passengerName }}</span>
                  <span class="req-seats">Booked {{ req.seats }} seat{{ req.seats > 1 ? 's' : '' }}</span>
                </div>
                <span class="req-badge">₹{{ req.totalPrice }}</span>
              </div>
              
              <p class="req-route-info">
                Route: <strong>{{ req.rideRoute }}</strong>
              </p>

              <div class="payment-summary-block">
                <span>Method: <strong>{{ req.paymentMethod }}</strong></span> &bull;
                <span>Status: <strong [class.paid-text]="req.paymentStatus === 'Paid'" [class.pending-text]="req.paymentStatus === 'Pending'">{{ req.paymentStatus }}</strong></span>
              </div>

              <!-- Mark as Paid trigger -->
              <div class="req-actions" *ngIf="canMarkPaid(req)">
                <button 
                  class="ripple-btn accept-btn mark-paid-btn" 
                  [class.confirm-btn]="confirmMarkPaidId === req.id"
                  (click)="markPaid(req.id)">
                  {{ confirmMarkPaidId === req.id ? 'Click to Confirm' : 'Mark as Paid' }}
                </button>
              </div>

            </div>
          </div>
        </section>

        <!-- Main Offers Listings list -->
        <section class="listings-section">
          <h3 class="section-title">Your Offered Rides</h3>
          
          <!-- Store error banner -->
          <div class="error-banner glass-panel slide-in" *ngIf="rideStore.error() || bookingStore.error()">
            <span class="material-icons-outlined">error_outline</span>
            <p>{{ rideStore.error() || bookingStore.error() }}</p>
          </div>
          
          <!-- Loader skeleton -->
          <div class="skeletons-list" *ngIf="rideStore.loading()">
            <div class="skeleton-card skeleton" style="height: 120px" *ngFor="let s of [1, 2]"></div>
          </div>

          <div class="real-offers" *ngIf="!rideStore.loading()">
            <div class="offers-list" *ngIf="rideStore.offeredRides().length > 0; else emptyOffers">
              
              <div class="offer-card glass-panel" *ngFor="let ride of rideStore.offeredRides()">
                <div class="offer-header">
                  <span class="offer-route">{{ ride.startLocation }} &rarr; {{ ride.destination }}</span>
                  <span class="offer-price">₹{{ ride.pricePerSeat }}/seat</span>
                </div>
                
                <p class="offer-time-lbl">
                  <span class="material-icons-outlined icon-mini">today</span>
                  {{ ride.departureDate | date:'MMM dd, yyyy' }} at {{ ride.departureTime }}
                </p>

                <div class="offer-details-row">
                  <span class="badge badge-primary">
                    {{ ride.availableSeats }} / {{ ride.totalSeats }} seats left
                  </span>
                  <span class="badge badge-warning" *ngIf="ride.stops.length > 0">
                    {{ ride.stops.length }} stop(s)
                  </span>
                </div>

                <div class="offer-actions">
                  <button 
                    class="ripple-btn btn-secondary cancel-offer-btn" 
                    [class.confirm-cancel-btn]="confirmCancelOfferId === ride.id"
                    (click)="cancelOffer(ride.id)">
                    {{ confirmCancelOfferId === ride.id ? 'Confirm Cancel?' : 'Cancel Offer' }}
                  </button>
                </div>
              </div>

            </div>

            <ng-template #emptyOffers>
              <div class="empty-offers-card">
                <span class="material-icons-outlined empty-car-icon">directions_car</span>
                <h3>No Offered Rides</h3>
                <p>You haven't published any rides yet. Offer a ride to share travel costs and make friends!</p>
                <button class="ripple-btn publish-prompt-btn" (click)="switchTab('publish')">
                  Publish First Ride
                </button>
              </div>
            </ng-template>
          </div>
        </section>

      </div>

      <!-- TAB 2: Offer Ride Publishing Form -->
      <div class="tab-content scrollable-form" *ngIf="activeTab === 'publish'">
        <div class="publish-card glass-panel">
          <h3 class="section-title" style="margin-bottom: 20px">Offer a Ride</h3>
          
          <form (ngSubmit)="onPublish()" #publishForm="ngForm" class="publish-form">
            <!-- Start Location Autocomplete -->
            <app-location-autocomplete
              [label]="'Starting Point'"
              [placeholder]="'Leaving from (e.g. Mumbai)'"
              [(value)]="from"
              [icon]="'trip_origin'"
              [iconClass]="'text-primary'">
            </app-location-autocomplete>

            <!-- Intermediary Stops custom list builder with location dropdown -->
            <div class="stops-builder-section">
              <label class="builder-lbl">Intermediary Stops</label>
              
              <div class="builder-list" *ngIf="stops.length > 0">
                <div class="builder-row slide-in" *ngFor="let stop of stops; let i = index">
                  <span class="builder-node">&bull;</span>
                  <span class="builder-name">{{ stop.name }} ({{ stop.arrivalTime }})</span>
                  <button type="button" class="remove-stop-btn" (click)="removeStop(i)">
                    <span class="material-icons-outlined">remove_circle_outline</span>
                  </button>
                </div>
              </div>
              
              <!-- Autocomplete Stop Input row -->
              <div class="stop-inputs-row">
                <div class="autocomplete-stop-wrapper">
                  <app-location-autocomplete
                    [placeholder]="'Stop (e.g. Lonavala)'"
                    [(value)]="newStopName"
                    [icon]="'place'"
                    [iconClass]="'text-tertiary'">
                  </app-location-autocomplete>
                </div>
                <input type="time" [(ngModel)]="newStopTime" name="newTime" class="stop-input-time" />
                <button type="button" class="add-stop-btn" (click)="addStop()" [disabled]="!newStopName || !newStopTime">
                  Add
                </button>
              </div>
            </div>

            <!-- Destination Location Autocomplete -->
            <app-location-autocomplete
              [label]="'Destination Point'"
              [placeholder]="'Going to (e.g. Pune)'"
              [(value)]="to"
              [icon]="'place'"
              [iconClass]="'text-secondary'">
            </app-location-autocomplete>

            <!-- Date and Time row -->
            <div class="form-double-row">
              <div class="custom-input-group">
                <label>Date</label>
                <div class="input-wrapper">
                  <input type="date" [(ngModel)]="date" name="date" required [min]="minDate" class="form-input" />
                </div>
              </div>
              <div class="custom-input-group">
                <label>Time</label>
                <div class="input-wrapper">
                  <input type="time" [(ngModel)]="time" name="time" required class="form-input" />
                </div>
              </div>
            </div>

            <!-- Pricing and Seats double row -->
            <div class="form-double-row">
              <div class="custom-input-group">
                <label>Seats Offered</label>
                <div class="input-wrapper">
                  <span class="material-icons-outlined prefix-icon">event_seat</span>
                  <select [(ngModel)]="seats" name="seats" required class="form-select">
                    <option [value]="2">2 Seats</option>
                    <option [value]="3">3 Seats</option>
                    <option [value]="4" selected>4 Seats</option>
                    <option [value]="6">6 Seats</option>
                  </select>
                </div>
              </div>
              <div class="custom-input-group">
                <label>Price per Seat (₹)</label>
                <div class="input-wrapper">
                  <span class="material-icons-outlined prefix-icon">payments</span>
                  <input type="number" [(ngModel)]="price" name="price" required min="100" class="form-input-number" />
                </div>
              </div>
            </div>

            <!-- Vehicle Selection Dropdown -->
            <div class="custom-input-group">
              <label>Select Registered Vehicle</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined prefix-icon">directions_car</span>
                <select [(ngModel)]="selectedVehicleId" name="selectedVehicleId" (change)="onVehicleSelectChange()" required class="form-select">
                  <option *ngFor="let veh of authStore.currentUser()?.registeredVehicles" [value]="veh.id">
                    {{ veh.model }} ({{ veh.numberPlate }}) - {{ veh.color }}
                  </option>
                  <option value="custom">Enter Custom Vehicle...</option>
                </select>
              </div>
            </div>

            <!-- Vehicle Details Form (visible and auto-populated) -->
            <div class="vehicle-details-subform slide-in">
              <!-- Vehicle Name/Model -->
              <div class="custom-input-group">
                <label>Vehicle Name / Model</label>
                <div class="input-wrapper">
                  <span class="material-icons-outlined prefix-icon">badge</span>
                  <input 
                    type="text" 
                    placeholder="e.g. BMW 3 Series" 
                    [(ngModel)]="vehicleModel" 
                    name="vehicleModel" 
                    required 
                    class="form-input" />
                </div>
              </div>

              <!-- Vehicle Type & Color row -->
              <div class="form-double-row">
                <div class="custom-input-group">
                  <label>Vehicle Type</label>
                  <div class="input-wrapper">
                    <span class="material-icons-outlined prefix-icon">build</span>
                    <select [(ngModel)]="vehicleType" name="vehicleType" required class="form-select">
                      <option value="Sedan">Sedan</option>
                      <option value="Hatchback">Hatchback</option>
                      <option value="SUV">SUV</option>
                      <option value="EV">EV</option>
                      <option value="Luxury">Luxury</option>
                    </select>
                  </div>
                </div>
                <div class="custom-input-group">
                  <label>Vehicle Color</label>
                  <div class="input-wrapper">
                    <span class="material-icons-outlined prefix-icon">palette</span>
                    <input 
                      type="text" 
                      placeholder="e.g. Portimao Blue" 
                      [(ngModel)]="vehicleColor" 
                      name="vehicleColor" 
                      required 
                      class="form-input" />
                  </div>
                </div>
              </div>

              <!-- Vehicle Registration Number -->
              <div class="custom-input-group">
                <label>Vehicle Registration Number</label>
                <div class="input-wrapper">
                  <span class="material-icons-outlined prefix-icon">tag</span>
                  <input 
                    type="text" 
                    placeholder="e.g. MH-12-AB-2049" 
                    [(ngModel)]="vehicleNumber" 
                    name="vehicleNumber" 
                    required 
                    class="form-input" />
                </div>
              </div>
            </div>

            <div class="custom-input-group">
              <label>About Ride (Optional)</label>
              <div class="input-wrapper">
                <textarea 
                  [(ngModel)]="about" 
                  name="about" 
                  placeholder="Tell passengers about AC status, music choice, baggage spaces, etc." 
                  class="form-textarea"></textarea>
              </div>
            </div>

            <!-- Error Banner -->
            <div class="error-banner glass-panel slide-in" *ngIf="rideStore.error()">
              <span class="material-icons-outlined">error_outline</span>
              <p>{{ rideStore.error() }}</p>
            </div>

            <button 
              type="submit" 
              class="ripple-btn submit-btn" 
              [disabled]="publishForm.invalid || rideStore.loading()">
              <span class="spinner" *ngIf="rideStore.loading()"></span>
              {{ rideStore.loading() ? 'Publishing...' : 'Offer Ride' }}
            </button>
          </form>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .driver-page {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 90px;
      height: 100vh;
    }

    /* Segmented tab controls */
    .segment-controls {
      display: flex;
      background-color: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      padding: 4px;
    }

    .segment-btn {
      flex: 1;
      border: none;
      background: none;
      padding: 10px;
      font-size: 0.85rem;
      font-weight: 700;
      color: hsl(var(--text-secondary));
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 6px;
      transition: var(--transition-spring);

      span { font-size: 18px; }

      &.active {
        background-color: var(--color-primary);
        color: #ffffff;
      }
    }

    .tab-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      
      &.scrollable-form {
        overflow-y: auto;
      }
    }

    /* Requests list */
    .approvals-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .section-title {
      font-size: 1rem;
      font-weight: 800;
      color: hsl(var(--text-primary));
    }

    .requests-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .request-card {
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      border: 1px solid rgba(var(--color-primary-rgb), 0.1);
      transition: var(--transition-smooth);

      &.fading-out {
        opacity: 0.8;
      }
    }

    .req-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .req-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 750;
      font-size: 0.9rem;
      font-family: var(--font-primary);
    }

    .req-meta {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .req-name {
      font-size: 0.88rem;
      font-weight: 750;
      color: hsl(var(--text-primary));
    }

    .req-seats {
      font-size: 0.72rem;
      color: hsl(var(--text-secondary));
    }

    .req-badge {
      background-color: rgba(52, 199, 89, 0.1);
      color: var(--color-secondary);
      font-size: 0.8rem;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .req-route-info {
      font-size: 0.78rem;
      color: hsl(var(--text-secondary));
      line-height: 1.3;
    }

    .req-actions {
      display: flex;
      gap: 10px;
    }

    .reject-btn {
      flex: 1;
      padding: 10px;
      font-size: 0.8rem;
    }

    .accept-btn {
      flex: 2;
      padding: 10px;
      font-size: 0.8rem;
      background-color: var(--color-secondary);
      box-shadow: 0 4px 12px rgba(52, 199, 89, 0.25);
    }

    .response-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 8px;
      border-radius: var(--border-radius-sm);
      
      &.accepted {
        background-color: rgba(52, 199, 89, 0.05);
        color: var(--color-secondary);
      }

      &.rejected {
        background-color: rgba(255, 69, 58, 0.05);
        color: var(--color-danger);
      }

      span { font-size: 18px; }
    }

    .payment-summary-block {
      font-size: 0.75rem;
      color: hsl(var(--text-secondary));
      display: flex;
      gap: 6px;
      
      .paid-text { color: var(--color-secondary); }
      .pending-text { color: #ff9f0a; }
    }

    .mark-paid-btn {
      background-color: var(--color-primary) !important;
      box-shadow: 0 4px 12px rgba(10, 132, 255, 0.25) !important;
    }

    /* Offers list */
    .real-offers {
      display: flex;
      flex-direction: column;
    }

    .offers-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .offer-card {
      padding: 16px;
      border-radius: var(--border-radius-sm);
    }

    .offer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .offer-route {
      font-size: 0.95rem;
      font-weight: 800;
      color: hsl(var(--text-primary));
    }

    .offer-price {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--color-primary);
    }

    .offer-time-lbl {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: hsl(var(--text-secondary));
      margin-top: 4px;
    }

    .icon-mini { font-size: 14px; }

    .offer-details-row {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }

    .badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;

      &.badge-primary { background-color: rgba(10, 132, 255, 0.1); color: var(--color-primary); }
      &.badge-warning { background-color: rgba(255, 179, 0, 0.1); color: #ffb300; }
    }

    .offer-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
      border-top: 1px solid hsl(var(--border-light));
      padding-top: 10px;
    }

    .cancel-offer-btn {
      padding: 8px 16px;
      font-size: 0.75rem;
      background-color: rgba(255, 69, 58, 0.05);
      color: var(--color-danger);
      box-shadow: none;
      
      &:hover {
        background-color: rgba(255, 69, 58, 0.1);
        box-shadow: none;
      }
    }

    /* Empty state */
    .empty-offers-card {
      text-align: center;
      padding: 40px 20px;
      background-color: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      
      h3 { font-size: 1.15rem; }
      p { font-size: 0.8rem; color: hsl(var(--text-secondary)); max-width: 260px; line-height: 1.4; }
    }

    .empty-car-icon {
      font-size: 40px;
      color: hsl(var(--text-tertiary));
    }

    .publish-prompt-btn {
      padding: 10px 20px;
      font-size: 0.8rem;
    }

    /* Publish form wizard */
    .publish-card {
      padding: 20px;
    }

    .publish-form {
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
        background-color: hsl(var(--bg-primary));
        padding: 4px;
        transition: var(--transition-smooth);

        &:focus-within {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15);
        }
      }

      .prefix-icon {
        font-size: 20px;
        color: hsl(var(--text-tertiary));
        margin-left: 10px;
        margin-right: 2px;
      }

      .form-input, .form-select, .form-input-number {
        border: none;
        background: none;
        outline: none;
        font-size: 0.95rem;
        font-weight: 600;
        color: hsl(var(--text-primary));
        width: 100%;
        padding: 8px 10px;
      }

      .form-select {
        cursor: pointer;
      }

      .form-textarea {
        border: none;
        background: none;
        outline: none;
        font-size: 0.9rem;
        font-weight: 600;
        color: hsl(var(--text-primary));
        width: 100%;
        min-height: 80px;
        padding: 8px 12px;
        resize: none;
      }
    }

    .form-double-row {
      display: flex;
      gap: 12px;
      
      .custom-input-group {
        flex: 1;
      }
    }

    .vehicle-details-subform {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 14px;
      border-radius: var(--border-radius-sm);
      border: 1.5px dashed hsl(var(--border-light));
      background-color: rgba(var(--color-primary-rgb), 0.02);
      margin-bottom: 4px;
    }

    .submit-btn {
      width: 100%;
      padding: 14px;
      margin-top: 12px;
    }

    /* Dynamic stops builder */
    .stops-builder-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .builder-lbl {
      font-size: 0.72rem;
      font-weight: 700;
      color: hsl(var(--text-tertiary));
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .builder-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      padding: 10px;
      border-radius: var(--border-radius-sm);
    }

    .builder-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .builder-node {
      font-size: 1.25rem;
      color: var(--color-primary);
    }

    .builder-name {
      font-size: 0.8rem;
      font-weight: 600;
      color: hsl(var(--text-primary));
      flex: 1;
    }

    .remove-stop-btn {
      background: none;
      border: none;
      color: var(--color-danger);
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 2px;
      span { font-size: 16px; }
    }

    .stop-inputs-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .autocomplete-stop-wrapper {
      flex: 3;
    }

    .stop-input-time {
      flex: 2;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid hsl(var(--border-light));
      background-color: hsl(var(--bg-primary));
      color: hsl(var(--text-primary));
      font-size: 0.85rem;
      outline: none;
      height: 42px;
      font-weight: 600;
    }

    .add-stop-btn {
      background-color: hsl(var(--bg-tertiary));
      border: 1px solid hsl(var(--border-light));
      color: hsl(var(--text-primary));
      padding: 10px 14px;
      font-size: 0.78rem;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      height: 42px;
      transition: var(--transition-spring);

      &:hover { background-color: hsl(var(--border-light)); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
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

    /* Skeletons */
    .skeletons-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-card {
      border-radius: var(--border-radius-sm);
      background-color: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background-color: rgba(255, 69, 58, 0.1);
      border: 1px solid rgba(255, 69, 58, 0.25);
      border-radius: var(--border-radius-sm);
      color: var(--color-danger);
      font-size: 0.82rem;
      font-weight: 600;
      margin: 12px 0;

      span {
        font-size: 20px;
      }
      p {
        margin: 0;
      }
    }

    .confirm-btn {
      background-color: #ff9f0a !important;
      box-shadow: 0 4px 12px rgba(255, 159, 10, 0.25) !important;
      color: white !important;
    }
    
    .confirm-cancel-btn {
      background-color: var(--color-danger) !important;
      color: white !important;
      box-shadow: 0 4px 12px rgba(255, 69, 58, 0.25) !important;
      &:hover {
        background-color: var(--color-danger) !important;
      }
    }
  `]
})
export class DriverComponent implements OnInit {
  rideStore = inject(RideStore);
  authStore = inject(AuthStore);
  bookingStore = inject(BookingStore);
  rideService = inject(RideService);
  router = inject(Router);
  platformId = inject(PLATFORM_ID);

  activeTab: 'listings' | 'publish' = 'listings';
  confirmMarkPaidId: string | null = null;
  confirmCancelOfferId: string | null = null;

  // Publish Form parameters
  from = '';
  to = '';
  date = '';
  time = '';
  seats = 4;
  price = 350;

  // Vehicle Selection parameters
  selectedVehicleId = 'custom';
  vehicleModel = '';
  vehicleType: 'Sedan' | 'Hatchback' | 'SUV' | 'EV' | 'Luxury' = 'Sedan';
  vehicleColor = '';
  vehicleNumber = '';

  about = '';

  minDate = '';

  // Intermediary stops builder parameters
  stops: Stop[] = [];
  newStopName = '';
  newStopTime = '';

  // Live Requests queue
  get incomingRequests() {
    return this.bookingStore.driverBookings().filter(b => b.status === 'pending');
  }

  get confirmedBookings() {
    return this.bookingStore.driverBookings().filter(b => b.status === 'upcoming' || b.status === 'completed');
  }

  canMarkPaid(req: any): boolean {
    if (req.paymentStatus === 'Paid') return false;
    try {
      const [year, month, day] = req.departureDate.split('-').map(Number);
      const [hours, minutes] = req.departureTime.split(':').map(Number);
      const depDate = new Date(year, month - 1, day, hours, minutes);
      return depDate < new Date();
    } catch (e) {
      return false;
    }
  }

  markPaid(bookingId: string) {
    if (this.confirmMarkPaidId === bookingId) {
      this.bookingStore.markBookingAsPaid(bookingId);
      this.confirmMarkPaidId = null;
    } else {
      this.confirmMarkPaidId = bookingId;
      setTimeout(() => {
        if (this.confirmMarkPaidId === bookingId) {
          this.confirmMarkPaidId = null;
        }
      }, 3000);
    }
  }

  ngOnInit() {
    
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];
    this.date = this.minDate;

    const user = this.authStore.currentUser();
    if (user) {
      this.rideStore.loadOfferedRides(user.id);
      this.bookingStore.loadDriverBookings();
      
      // Auto-populate first vehicle if exists
      if (user.registeredVehicles && user.registeredVehicles.length > 0) {
        const firstVeh = user.registeredVehicles[0];
        this.selectedVehicleId = firstVeh.id;
        this.vehicleModel = firstVeh.model;
        this.vehicleType = firstVeh.type;
        this.vehicleColor = firstVeh.color;
        this.vehicleNumber = firstVeh.numberPlate;
      } else {
        this.selectedVehicleId = 'custom';
      }
    }
  }

  onVehicleSelectChange() {
    const user = this.authStore.currentUser();
    if (this.selectedVehicleId === 'custom') {
      this.vehicleModel = '';
      this.vehicleType = 'Sedan';
      this.vehicleColor = '';
      this.vehicleNumber = '';
    } else if (user && user.registeredVehicles) {
      const found = user.registeredVehicles.find((v: any) => v.id === this.selectedVehicleId);
      if (found) {
        this.vehicleModel = found.model;
        this.vehicleType = found.type;
        this.vehicleColor = found.color;
        this.vehicleNumber = found.numberPlate;
      }
    }
  }

  generateSimulatedRequests(driverId: string) {
    // Deprecated - using live requests from database
  }

  switchTab(tab: 'listings' | 'publish') {
    this.activeTab = tab;
  }

  // Stops actions
  addStop() {
    if (!this.newStopName || !this.newStopTime) return;
    this.stops.push({
      name: this.newStopName,
      arrivalTime: this.newStopTime
    });
    this.newStopName = '';
    this.newStopTime = '';
  }

  removeStop(idx: number) {
    this.stops.splice(idx, 1);
  }

  onPublish() {
    if (!this.from || !this.to || !this.date || !this.time || !this.vehicleModel || !this.vehicleNumber || !this.vehicleColor) return;

    const rideData = {
      startLocation: this.from,
      destination: this.to,
      stops: [...this.stops],
      departureDate: this.date,
      departureTime: this.time,
      availableSeats: Number(this.seats),
      totalSeats: Number(this.seats),
      pricePerSeat: Number(this.price),
      vehicle: {
        id: this.selectedVehicleId === 'custom' ? `veh_${Date.now()}` : this.selectedVehicleId,
        model: this.vehicleModel,
        numberPlate: this.vehicleNumber.toUpperCase().trim(),
        type: this.vehicleType,
        color: this.vehicleColor
      },
      aboutRide: this.about
    };

    const user = this.authStore.currentUser();
    if (user) {
      // If it's a custom vehicle or we've updated it, check if we should add/update it in registered vehicles
      const isExisting = user.registeredVehicles?.some(
        (v: any) => v.numberPlate.toUpperCase().trim() === this.vehicleNumber.toUpperCase().trim()
      );
      
      if (!isExisting) {
        const newVeh = {
          id: `veh_${Date.now()}`,
          model: this.vehicleModel,
          numberPlate: this.vehicleNumber.toUpperCase().trim(),
          type: this.vehicleType,
          color: this.vehicleColor
        };
        
        const updatedVehicles = [...(user.registeredVehicles || []), newVeh];
        const updatedUser = {
          ...user,
          registeredVehicles: updatedVehicles
        };
        
        // Save to AuthStore
        this.authStore.setCurrentUser(updatedUser);
        
        // Set selected vehicle ID to the newly saved vehicle
        this.selectedVehicleId = newVeh.id;
      }
    }

    this.rideStore.publishRide(rideData, () => {
      // Clear forms
      this.from = '';
      this.to = '';
      this.stops = [];
      this.about = '';
      this.price = 350;
      this.seats = 4;
      
      // Reload offered list and navigate back to listings tab
      if (user) {
        this.rideStore.loadOfferedRides(user.id);
      }
      this.switchTab('listings');
    });
  }

  cancelOffer(rideId: string) {
    if (this.confirmCancelOfferId === rideId) {
      this.rideStore.cancelOfferedRide(rideId);
      this.confirmCancelOfferId = null;
    } else {
      this.confirmCancelOfferId = rideId;
      setTimeout(() => {
        if (this.confirmCancelOfferId === rideId) {
          this.confirmCancelOfferId = null;
        }
      }, 3000);
    }
  }

  // Request queue actions
  acceptRequest(reqId: string, rideId: string, seats: number) {
    this.bookingStore.acceptBookingRequest(reqId, () => {
      const user = this.authStore.currentUser();
      if (user) {
        this.rideStore.loadOfferedRides(user.id);
      }
    });
  }

  rejectRequest(reqId: string) {
    this.bookingStore.rejectBookingRequest(reqId);
  }

  // Local dynamic HSL initial avatars fallback
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

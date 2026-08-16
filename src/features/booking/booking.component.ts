import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RideStore } from '../../core/store/ride.store';
import { BookingStore } from '../../core/store/booking.store';
import { AuthStore } from '../../core/store/auth.store';
import { Booking } from '../../core/models/booking.models';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="booking-page slide-in" *ngIf="!rideStore.loading() && rideStore.activeRide() as ride; else loader">

      <!-- Back Header -->
      <header class="page-header" *ngIf="!bookingSuccess">
        <button class="back-btn" (click)="router.navigate(['/ride', ride.id])">
          <span class="material-icons-outlined">arrow_back</span>
        </button>
        <h3>Checkout</h3>
      </header>

      <!-- CHECKOUT STEPS -->
      <div class="checkout-content" *ngIf="!bookingSuccess">
        <!-- 1. Seat Picker Stepper Widget -->
        <section class="checkout-card glass-panel">
          <h4 class="card-title">Select Seats</h4>
          <p class="card-desc">Adjust the number of seats you'd like to book using the controls below.</p>

          <div class="stepper-container">
            <div class="stepper-vehicle-info">
              <span class="material-icons-outlined vehicle-icon">directions_car</span>
              <div class="vehicle-details">
                <h5>{{ ride.vehicle.model }}</h5>
                <span class="vehicle-badge">{{ ride.vehicle.type }} ({{ ride.totalSeats }} seats capacity)</span>
              </div>
            </div>

            <div class="stepper-counter-row">
              <div class="stepper-label-column">
                <span class="stepper-label">Number of Passengers</span>
                <span class="stepper-sublabel">Book up to {{ ride.availableSeats }} available seats</span>
              </div>
              <div class="stepper-controls">
                <button class="step-btn" [disabled]="seatsToBook <= 1" (click)="decrementSeats()">
                  <span class="material-icons-outlined">remove</span>
                </button>
                <span class="step-value">{{ seatsToBook }}</span>
                <button class="step-btn" [disabled]="seatsToBook >= ride.availableSeats" (click)="incrementSeats()">
                  <span class="material-icons-outlined">add</span>
                </button>
              </div>
            </div>

            <div class="stepper-summary-box">
              <div class="summary-stat">
                <span class="stat-lbl">Available Seats</span>
                <span class="stat-val text-primary">{{ ride.availableSeats }}</span>
              </div>
              <div class="vertical-divider-thin"></div>
              <div class="summary-stat">
                <span class="stat-lbl">Selected Seats</span>
                <span class="stat-val text-secondary">{{ seatsToBook }}</span>
              </div>
              <div class="vertical-divider-thin"></div>
              <div class="summary-stat">
                <span class="stat-lbl">Remaining Seats</span>
                <span class="stat-val text-muted">{{ ride.availableSeats - seatsToBook }}</span>
              </div>
            </div>

            <div class="assigned-seats-hint" *ngIf="selectedSeats.length > 0">
              <span class="material-icons-outlined info-icon text-primary">info</span>
              <span>Automatically assigned: <strong>Seat #{{ selectedSeats.join(', #') }}</strong></span>
            </div>
          </div>
        </section>

        <!-- 2. Passenger Details Verification -->
        <section class="checkout-card glass-panel" *ngIf="authStore.currentUser() as user">
          <h4 class="card-title">Passenger Verification</h4>
          <div class="user-meta-summary">
            <span class="meta-label">Primary Rider</span>
            <h5>{{ user.name }}</h5>
            <span>{{ user.phone }} &bull; {{ user.email }}</span>
          </div>
        </section>

        <!-- 3. Payment Selection -->
        <section class="checkout-card glass-panel">
          <h4 class="card-title">Select Payment Mode</h4>
          <p class="card-desc">MVP supports direct passenger-to-driver payments via Cash or UPI.</p>

          <div class="payment-options">
            <div class="pay-option" [class.active]="paymentMethod === 'Cash'" (click)="paymentMethod = 'Cash'">
              <span class="material-icons-outlined pay-icon">payments</span>
              <span>Direct Driver Payment - Cash</span>
            </div>
            <div class="pay-option" [class.active]="paymentMethod === 'UPI'" (click)="paymentMethod = 'UPI'">
              <span class="material-icons-outlined pay-icon">qr_code</span>
              <span>Direct Driver Payment - UPI</span>
            </div>
          </div>
        </section>

        <!-- 4. Fare Breakdown -->
        <section class="checkout-card glass-panel billing-breakdown">
          <h4 class="card-title">Fare Details</h4>
          <div class="fare-row">
            <span>Seat cost (₹{{ ride.pricePerSeat }} x {{ seatsToBook }})</span>
            <span>₹{{ ride.pricePerSeat * seatsToBook }}</span>
          </div>
          <div class="fare-row">
            <span>HighwayPool Service Fee</span>
            <span style="font-weight:700; color:var(--color-secondary);">₹0 <span style="font-size:0.68rem; font-weight:500; opacity:0.8;">(Promotional Period)</span></span>
          </div>
          <div class="fare-row total">
            <span>Total Payable</span>
            <span class="total-price">₹{{ ride.pricePerSeat * seatsToBook }}</span>
          </div>
        </section>

        <!-- Phone verification check -->
        <div class="active-bookings-warning fade-in" *ngIf="!authStore.currentUser()?.phone" style="padding: 16px; background-color: rgba(255, 69, 58, 0.1); border: 1px solid rgba(255, 69, 58, 0.25); border-radius: 6px; color: var(--color-danger); font-size: 0.85rem; font-weight: 600; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="material-icons-outlined">error_outline</span>
            <span>A mobile contact number is required to book a ride so the driver can reach you.</span>
          </div>
          <button
            type="button"
            class="ripple-btn btn-secondary"
            style="align-self: flex-start; padding: 6px 12px; font-size: 0.78rem;"
            (click)="router.navigate(['/profile'])">
            Go to Profile & Add Phone
          </button>
        </div>

        <!-- Error Banner -->
        <div class="error-banner glass-panel slide-in" *ngIf="bookingStore.error()">
          <span class="material-icons-outlined">error_outline</span>
          <p>{{ bookingStore.error() }}</p>
        </div>

        <!-- Submit Button -->
        <button
          class="ripple-btn submit-booking-btn"
          [disabled]="selectedSeats.length !== seatsToBook || bookingStore.loading() || !authStore.currentUser()?.phone"
          (click)="confirmBooking()">
          <span class="spinner" *ngIf="bookingStore.loading()"></span>
          {{ bookingStore.loading() ? 'Reserving seat...' : 'Pay & Confirm Reservation' }}
        </button>
      </div>

      <!-- SUCCESS TICKET CONFIRMATION SCREEN -->
      <section class="success-panel slide-in" *ngIf="bookingSuccess && activeBooking">
        <div class="ticket-card glass-panel">
          <span class="material-icons-outlined success-icon">check_circle</span>
          <h3>Seat Reserved!</h3>
          <p class="success-desc">Show the ticket details at boarding time.</p>

          <div class="ticket-details">
            <div class="ticket-row">
              <span class="ticket-lbl">Booking ID:</span>
              <span class="ticket-val text-primary">{{ activeBooking.id }}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-lbl">Route:</span>
              <span class="ticket-val">{{ ride.startLocation }} &rarr; {{ ride.destination }}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-lbl">Date & Time:</span>
              <span class="ticket-val">{{ ride.departureDate | date:'MMM dd, yyyy' }} at {{ ride.departureTime }}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-lbl">Seats Booked:</span>
              <span class="ticket-val">{{ activeBooking.seatsBooked }} seat{{ activeBooking.seatsBooked > 1 ? 's' : '' }} (Seat #{{ selectedSeats.join(', #') }})</span>
            </div>
            <div class="ticket-row total-row">
              <span class="ticket-lbl">Amount Paid:</span>
              <span class="ticket-val">₹{{ activeBooking.totalPrice }}</span>
            </div>
          </div>

          <!-- Mock Ticket QR Code -->
          <div class="ticket-qr-container">
            <div class="mock-qr-box">
              <div class="qr-inner-pattern"></div>
              <span class="material-icons-outlined qr-overlay-icon">qr_code_2</span>
            </div>
            <span class="qr-lbl">Boarding pass qr code</span>
          </div>

          <button class="ripple-btn done-btn" (click)="router.navigate(['/bookings'])">
            Go to My Bookings
          </button>
        </div>
      </section>

    </div>

    <ng-template #loader>
      <div class="page-loader">
        <span class="spinner-large"></span>
      </div>
    </ng-template>
  `,
  styles: [`
    .booking-page {
      padding: 16px;
      padding-bottom: 90px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .page-header {
      display: flex;
      align-items: center;
      gap: 16px;
      height: 48px;

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

      h3 {
        font-size: 1.15rem;
        font-weight: 800;
      }
    }

    .checkout-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .checkout-card {
      padding: 18px;
    }

    .card-title {
      font-size: 0.95rem;
      font-weight: 800;
      color: hsl(var(--text-primary));
      margin-bottom: 4px;
    }

    .card-desc {
      font-size: 0.76rem;
      color: hsl(var(--text-secondary));
      line-height: 1.4;
      margin-bottom: 16px;
    }

    /* Stepper selection layout */
    .stepper-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: 12px 0;
    }

    .stepper-vehicle-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid hsl(var(--border-light));

      .vehicle-icon {
        font-size: 28px;
        color: var(--color-primary);
      }

      .vehicle-details {
        h5 {
          margin: 0;
          font-size: 0.88rem;
          font-weight: 800;
          color: hsl(var(--text-primary));
        }
        .vehicle-badge {
          font-size: 0.7rem;
          color: hsl(var(--text-tertiary));
          font-weight: 600;
        }
      }
    }

    .stepper-counter-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stepper-label-column {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .stepper-label {
        font-size: 0.88rem;
        font-weight: 750;
        color: hsl(var(--text-primary));
      }
      .stepper-sublabel {
        font-size: 0.7rem;
        color: hsl(var(--text-tertiary));
        font-weight: 600;
      }
    }

    .stepper-controls {
      display: flex;
      align-items: center;
      gap: 14px;

      .step-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1.5px solid hsl(var(--border-medium));
        background: none;
        color: hsl(var(--text-primary));
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: var(--transition-smooth);

        span { font-size: 18px; font-weight: 700; }

        &:hover:not(:disabled) {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background-color: rgba(10, 132, 255, 0.02);
        }

        &:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
      }

      .step-value {
        font-size: 1.15rem;
        font-weight: 855;
        color: hsl(var(--text-primary));
        min-width: 18px;
        text-align: center;
      }
    }

    .stepper-summary-box {
      display: flex;
      justify-content: space-between;
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: 8px;
      padding: 10px 14px;
      margin-top: 4px;

      .vertical-divider-thin {
        width: 1px;
        background-color: hsl(var(--border-light));
      }

      .summary-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        flex: 1;

        .stat-lbl {
          font-size: 0.62rem;
          font-weight: 750;
          text-transform: uppercase;
          color: hsl(var(--text-tertiary));
          letter-spacing: 0.4px;
        }
        .stat-val {
          font-size: 0.95rem;
          font-weight: 855;
        }
      }
    }

    .assigned-seats-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.72rem;
      color: hsl(var(--text-secondary));
      background-color: hsl(var(--bg-secondary));
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px dashed hsl(var(--border-medium));

      .info-icon {
        font-size: 16px;
      }

      strong {
        color: hsl(var(--text-primary));
      }
    }

    /* Verification card */
    .user-meta-summary {
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 3px;

      .meta-label {
        font-size: 0.65rem;
        font-weight: 700;
        color: hsl(var(--text-tertiary));
        text-transform: uppercase;
      }

      h5 { font-size: 0.9rem; font-weight: 850; }
      span { font-size: 0.72rem; color: hsl(var(--text-secondary)); font-weight: 500; }
    }

    /* Payment selection */
    .payment-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pay-option {
      border: 1px solid hsl(var(--border-light));
      border-radius: 8px;
      padding: 12px 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      color: hsl(var(--text-secondary));
      transition: var(--transition-smooth);

      .pay-icon { font-size: 18px; color: hsl(var(--text-tertiary)); }

      &.active {
        border-color: var(--color-primary);
        background-color: rgba(10, 132, 255, 0.03);
        color: var(--color-primary);

        .pay-icon { color: var(--color-primary); }
      }
    }

    .payment-inputs {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 10px;
    }

    .pay-input {
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid hsl(var(--border-light));
      background-color: hsl(var(--bg-secondary));
      color: hsl(var(--text-primary));
      font-size: 0.82rem;
      outline: none;

      &:focus { border-color: var(--color-primary); background-color: hsl(var(--bg-primary)); }
    }

    .double-input {
      display: flex;
      gap: 8px;
      input { flex: 1; }
    }

    /* Billing breakdown */
    .billing-breakdown {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .fare-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.82rem;
        color: hsl(var(--text-secondary));

        &.total {
          border-top: 1px solid hsl(var(--border-light));
          padding-top: 10px;
          font-size: 0.95rem;
          color: hsl(var(--text-primary));
          font-weight: 800;

          .total-price {
            font-size: 1.15rem;
            color: var(--color-primary);
          }
        }
      }
    }

    .submit-booking-btn {
      width: 100%;
      padding: 14px;
      margin-top: 6px;
    }

    /* Success screen */
    .success-panel {
      width: 100%;
    }

    .ticket-card {
      padding: 30px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 16px;
      border: 1px solid rgba(52, 199, 89, 0.2);

      .success-icon {
        font-size: 56px;
        color: var(--color-secondary);
      }

      h3 {
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.5px;
      }

      .success-desc {
        font-size: 0.82rem;
        color: hsl(var(--text-secondary));
        line-height: 1.45;
        max-width: 320px;
      }
    }

    .ticket-details {
      width: 100%;
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      text-align: left;

      .ticket-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;

        .ticket-lbl { color: hsl(var(--text-secondary)); font-weight: 500; }
        .ticket-val { font-weight: 700; color: hsl(var(--text-primary)); }

        &.total-row {
          border-top: 1px dashed hsl(var(--border-medium));
          padding-top: 8px;
          font-size: 0.88rem;

          .ticket-val { color: var(--color-primary); }
        }
      }
    }

    .ticket-qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      margin-top: 10px;

      .mock-qr-box {
        position: relative;
        width: 80px;
        height: 80px;
        border-radius: 8px;
        border: 1px solid hsl(var(--border-medium));
        background-color: #ffffff;
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;

        .qr-inner-pattern {
          width: 100%;
          height: 100%;
          background-image:
            linear-gradient(45deg, #000000 25%, transparent 25%),
            linear-gradient(-45deg, #000000 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #000000 75%),
            linear-gradient(-45deg, transparent 75%, #000000 75%);
          background-size: 8px 8px;
          background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
          opacity: 0.12;
        }

        .qr-overlay-icon {
          position: absolute;
          font-size: 44px;
          color: #000000;
        }
      }

      .qr-lbl {
        font-size: 0.65rem;
        font-weight: 700;
        color: hsl(var(--text-tertiary));
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .done-btn {
      width: 100%;
      padding: 14px;
      margin-top: 10px;
      background-color: var(--color-secondary);
      box-shadow: 0 4px 14px rgba(52, 199, 89, 0.25);
    }

    /* Skeletons */
    .page-loader {
      min-height: 80vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .spinner-large {
      width: 40px;
      height: 40px;
      border: 3px solid hsl(var(--border-light));
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #ffffff;
      animation: spin 0.8s linear infinite;
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
      margin: 10px 0;

      span {
        font-size: 20px;
      }
      p {
        margin: 0;
      }
    }
  `]
})
export class BookingComponent implements OnInit {
  rideStore = inject(RideStore);
  bookingStore = inject(BookingStore);
  authStore = inject(AuthStore);
  private route = inject(ActivatedRoute);
  router = inject(Router);

  seatsToBook = 1;
  selectedSeats: number[] = [];
  paymentMethod: 'UPI' | 'Cash' = 'Cash';

  bookingSuccess = false;
  activeBooking: Booking | null = null;

  constructor() {
    effect(() => {
      const ride = this.rideStore.activeRide();
      if (ride) {
        if (this.seatsToBook > ride.availableSeats) {
          this.seatsToBook = ride.availableSeats || 1;
        }
        this.updateSelectedSeats();
      }
    });
  }

  ngOnInit() {
    const rideId = this.route.snapshot.paramMap.get('id');
    if (rideId) {
      this.rideStore.loadRideDetails(rideId);
    }

    // Set seats count from store
    const q = this.rideStore.searchQuery();
    if (q) {
      this.seatsToBook = q.passengers;
    }
  }

  getAvailableSeatNumbers(): number[] {
    const ride = this.rideStore.activeRide();
    if (!ride) return [];
    const occupied = ride.occupiedSeats || [];
    const list: number[] = [];
    for (let i = 1; i <= ride.totalSeats; i++) {
      if (!occupied.includes(i)) {
        list.push(i);
      }
    }
    return list;
  }

  updateSelectedSeats() {
    const avail = this.getAvailableSeatNumbers();
    this.selectedSeats = avail.slice(0, this.seatsToBook);
  }

  incrementSeats() {
    const ride = this.rideStore.activeRide();
    if (!ride) return;
    if (this.seatsToBook < ride.availableSeats) {
      this.seatsToBook++;
      this.updateSelectedSeats();
    }
  }

  decrementSeats() {
    if (this.seatsToBook > 1) {
      this.seatsToBook--;
      this.updateSelectedSeats();
    }
  }

  confirmBooking() {
    const ride = this.rideStore.activeRide();
    if (!ride) return;

    const payload = {
      rideId: ride.id,
      seatsBooked: this.seatsToBook,
      paymentMethod: this.paymentMethod as any,
      selectedSeats: this.selectedSeats
    };

    this.bookingStore.createBooking(payload, (booking) => {
      this.activeBooking = booking;
      this.bookingSuccess = true;
    });
  }
}

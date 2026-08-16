import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BookingStore } from '../../core/store/booking.store';
import { AuthStore } from '../../core/store/auth.store';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bookings-page slide-in">
      <header class="page-header">
        <h3>My Bookings</h3>
      </header>

      <!-- Segmented Tab Controls -->
      <section class="tab-controls glass-panel">
        <button class="tab-btn" [class.active]="activeTab === 'upcoming'" (click)="activeTab = 'upcoming'">
          Upcoming
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'completed'" (click)="activeTab = 'completed'">
          Completed
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'cancelled'" (click)="activeTab = 'cancelled'">
          Cancelled
        </button>
      </section>

      <!-- Bookings Content list -->
      <div class="bookings-list-container">
        <!-- Error Banner -->
        <div class="error-banner glass-panel slide-in" *ngIf="bookingStore.error()">
          <span class="material-icons-outlined">error_outline</span>
          <p>{{ bookingStore.error() }}</p>
        </div>
        <!-- Loader Skeletons -->
        <div class="skeletons-list" *ngIf="bookingStore.loading()">
          <div class="skeleton-card skeleton" style="height: 140px;" *ngFor="let s of [1, 2]"></div>
        </div>

        <div class="real-bookings" *ngIf="!bookingStore.loading()">
          <div class="bookings-list" *ngIf="getActiveList().length > 0; else emptyState">
            
            <div class="booking-card glass-panel" *ngFor="let bk of getActiveList()" (click)="viewRideDetails(bk.rideId)" title="Click to view details">
              <!-- Booking Card Header -->
              <div class="bk-header">
                <span class="bk-route" *ngIf="bk.ride">{{ bk.ride.startLocation }} &rarr; {{ bk.ride.destination }}</span>
                <span class="bk-status" [class]="bk.status">{{ getStatusLabel(bk) }}</span>
              </div>
              
              <div class="bk-body" *ngIf="bk.ride">
                <p class="bk-time">
                  <span class="material-icons-outlined icon-mini">today</span>
                  {{ bk.ride.departureDate | date:'MMM dd, yyyy' }} at {{ bk.ride.departureTime }}
                </p>
                <p class="bk-meta">
                  <span>Seats: <strong>{{ bk.seatsBooked }}</strong></span> &bull; 
                  <span>Total: <strong>₹{{ bk.totalPrice + 30 }}</strong></span>
                </p>
                <div class="payment-summary">
                  <span class="pay-lbl">Payment Mode:</span>
                  <span class="pay-val"><strong>{{ bk.paymentMethod }}</strong></span> &bull;
                  <span class="pay-lbl">Status:</span>
                  <span class="pay-val" [class.paid]="bk.paymentStatus === 'Paid'" [class.pending]="bk.paymentStatus === 'Pending'">
                    <strong>{{ bk.paymentStatus }}</strong>
                  </span>
                </div>
                <div class="driver-summary" *ngIf="bk.ride">
                  <div class="summary-row">
                    <span class="driver-lbl">Driver:</span>
                    <span class="driver-name">{{ bk.ride.driverName }}</span>
                  </div>
                  <div class="contact-details" *ngIf="bk.status === 'upcoming' || bk.status === 'completed'">
                    <div class="summary-row">
                      <span class="driver-lbl">Phone:</span>
                      <span class="driver-info">{{ bk.ride.driverPhone }}</span>
                    </div>
                    <div class="summary-row" *ngIf="bk.ride.vehicle">
                      <span class="driver-lbl">Vehicle:</span>
                      <span class="driver-info">{{ bk.ride.vehicle.model }} ({{ bk.ride.vehicle.color }} - {{ bk.ride.vehicle.numberPlate }})</span>
                    </div>
                  </div>
                  <div class="contact-details-hidden" *ngIf="bk.status === 'pending'">
                    <div class="summary-row" *ngIf="bk.ride.vehicle">
                      <span class="driver-lbl">Vehicle:</span>
                      <span class="driver-info">{{ bk.ride.vehicle.model }}</span>
                    </div>
                    <div class="summary-row text-muted-small">
                      <span class="driver-info">Contact info available after driver approval.</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Cancellation Actions -->
              <div class="bk-actions" *ngIf="bk.status === 'upcoming'">
                <button 
                  class="ripple-btn btn-secondary cancel-booking-btn" 
                  [class.confirm-cancel-btn]="confirmCancelBookingId === bk.id"
                  (click)="cancelReservation(bk.id); $event.stopPropagation()">
                  {{ confirmCancelBookingId === bk.id ? 'Confirm Cancel?' : 'Cancel Booking' }}
                </button>
              </div>
            </div>

          </div>

          <ng-template #emptyState>
            <div class="empty-bookings-card glass-panel">
              <span class="material-icons-outlined empty-icon">receipt_long</span>
              <h4>No Bookings Found</h4>
              <p>You do not have any {{ activeTab }} ride reservations recorded.</p>
              <button class="ripple-btn book-prompt-btn" (click)="router.navigate(['/'])" *ngIf="activeTab === 'upcoming'">
                Find a Ride
              </button>
            </div>
          </ng-template>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .bookings-page {
      padding: 16px;
      padding-bottom: 90px;
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

    /* Tab segment controls */
    .tab-controls {
      display: flex;
      padding: 4px !important;
      border-radius: var(--border-radius-sm);
      border: 1px solid hsl(var(--border-light));
    }

    .tab-btn {
      flex: 1;
      border: none;
      background: none;
      padding: 8px 12px;
      font-size: 0.82rem;
      font-weight: 700;
      color: hsl(var(--text-secondary));
      cursor: pointer;
      border-radius: 6px;
      transition: var(--transition-spring);

      &.active {
        background-color: var(--color-primary);
        color: #ffffff;
      }
    }

    .bookings-list-container {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .bookings-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .booking-card {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      border: 1px solid hsl(var(--border-light));
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        border-color: rgba(10, 132, 255, 0.25);
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
    }

    .bk-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid hsl(var(--border-light));
      padding-bottom: 8px;
    }

    .bk-route {
      font-size: 0.9rem;
      font-weight: 800;
      color: hsl(var(--text-primary));
    }

    .bk-status {
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
      padding: 3px 6px;
      border-radius: 4px;

      &.upcoming { background-color: rgba(10, 132, 255, 0.1); color: var(--color-primary); }
      &.pending { background-color: rgba(255, 159, 10, 0.1); color: #ff9f0a; }
      &.completed { background-color: rgba(52, 199, 89, 0.1); color: var(--color-secondary); }
      &.cancelled { background-color: rgba(255, 69, 58, 0.1); color: var(--color-danger); }
    }

    .bk-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .bk-time {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: hsl(var(--text-secondary));
    }

    .icon-mini { font-size: 15px; color: hsl(var(--text-tertiary)); }

    .bk-meta {
      font-size: 0.78rem;
      color: hsl(var(--text-secondary));
      margin-top: 2px;
    }

    .driver-summary {
      font-size: 0.75rem;
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 8px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 6px;
      border: 1px dashed rgba(255, 255, 255, 0.08);
    }
    
    .summary-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .driver-lbl { 
      color: hsl(var(--text-tertiary)); 
      font-weight: 500;
      min-width: 60px;
    }
    
    .driver-name { 
      font-weight: 700; 
      color: hsl(var(--text-primary)); 
    }

    .driver-info {
      font-weight: 600;
      color: hsl(var(--text-secondary));
    }

    .text-muted-small {
      font-style: italic;
      color: hsl(var(--text-tertiary));
      font-size: 0.65rem;
      margin-top: 2px;
    }

    .payment-summary {
      font-size: 0.72rem;
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
      color: hsl(var(--text-secondary));

      .pay-lbl { color: hsl(var(--text-tertiary)); }
      .pay-val {
        color: hsl(var(--text-primary));
        &.paid { color: var(--color-secondary); }
        &.pending { color: #ff9f0a; }
      }
    }

    .bk-actions {
      border-top: 1px solid hsl(var(--border-light));
      padding-top: 10px;
      display: flex;
      justify-content: flex-end;
    }

    .cancel-booking-btn {
      padding: 6px 12px;
      font-size: 0.75rem;
      color: var(--color-danger);
      background-color: rgba(255, 69, 58, 0.05);
      border: none;
      
      &:hover {
        background-color: rgba(255, 69, 58, 0.1);
      }
    }

    .confirm-cancel-btn {
      background-color: var(--color-danger) !important;
      color: white !important;
      &:hover {
        background-color: var(--color-danger) !important;
      }
    }

    /* Empty state bookings */
    .empty-bookings-card {
      text-align: center;
      padding: 40px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;

      .empty-icon { font-size: 40px; color: hsl(var(--text-tertiary)); }
      h4 { font-size: 1.05rem; }
      p { font-size: 0.8rem; color: hsl(var(--text-secondary)); max-width: 250px; line-height: 1.4; }
    }

    .book-prompt-btn {
      padding: 10px 20px;
      font-size: 0.8rem;
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
      margin-bottom: 12px;

      span {
        font-size: 20px;
      }
      p {
        margin: 0;
      }
    }
  `]
})
export class BookingsComponent implements OnInit {
  bookingStore = inject(BookingStore);
  authStore = inject(AuthStore);
  router = inject(Router);

  getStatusLabel(bk: any): string {
    if (bk.status === 'cancelled') {
      if (bk.cancelledBy === 'driver') return 'Cancelled by Driver';
      if (bk.cancelledBy === 'passenger') return 'Cancelled by Passenger';
      return 'Cancelled';
    }
    return bk.status;
  }

  activeTab: 'upcoming' | 'completed' | 'cancelled' = 'upcoming';
  confirmCancelBookingId: string | null = null;

  ngOnInit() {
    const user = this.authStore.currentUser();
    if (user) {
      this.bookingStore.loadBookings(user.id);
    }
  }

  getActiveList() {
    if (this.activeTab === 'upcoming') return this.bookingStore.upcomingBookings();
    if (this.activeTab === 'completed') return this.bookingStore.completedBookings();
    return this.bookingStore.cancelledBookings();
  }

  cancelReservation(id: string) {
    if (this.confirmCancelBookingId === id) {
      this.bookingStore.cancelBooking(id);
      this.confirmCancelBookingId = null;
    } else {
      this.confirmCancelBookingId = id;
      setTimeout(() => {
        if (this.confirmCancelBookingId === id) {
          this.confirmCancelBookingId = null;
        }
      }, 3000);
    }
  }

  viewRideDetails(rideId: string) {
    this.router.navigate(['/ride', rideId]);
  }
}

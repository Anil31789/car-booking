import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RideStore } from '../../core/store/ride.store';
import { UserStore } from '../../core/store/user.store';
import { AuthStore } from '../../core/store/auth.store';
import { BookingStore } from '../../core/store/booking.store';
import { StarRatingComponent } from '../../shared/components/star-rating.component';

@Component({
  selector: 'app-ride-details',
  standalone: true,
  imports: [CommonModule, FormsModule, StarRatingComponent],
  template: `
    <div class="ride-details-page slide-in" *ngIf="!rideStore.loading() && rideStore.activeRide() as ride; else loader">
      
      <!-- Sticky back navigation header -->
      <header class="page-header">
        <button class="back-btn" (click)="router.navigate(['/search'])">
          <span class="material-icons-outlined">arrow_back</span>
        </button>
        <h3>Ride Details</h3>
      </header>

      <div class="details-content">
        <!-- Route Banner header -->
        <section class="route-banner glass-panel">
          <div class="route-date">
            <span class="material-icons-outlined date-icon">today</span>
            <span>{{ ride.departureDate | date:'EEEE, dd MMMM yyyy' }}</span>
          </div>
          <h2>{{ ride.startLocation }} &rarr; {{ ride.destination }}</h2>
        </section>

        <!-- Driver details -->
        <section class="driver-section glass-panel">
          <div class="driver-header">
            <!-- Offline initials avatar -->
            <div class="driver-avatar large" [style.background-color]="getAvatarColor(ride.driverName)">
              {{ getInitials(ride.driverName) }}
            </div>
            <div class="driver-info">
              <h4>{{ ride.driverName }}</h4>
              <span class="driver-joined">Member since {{ ride.driverJoined }} &bull; {{ ride.driverTrips }} trips completed</span>
              <app-star-rating [rating]="ride.driverRating"></app-star-rating>
            </div>
          </div>
          <div class="driver-phone" *ngIf="ride.driverPhone">
            <span class="material-icons-outlined text-secondary">phone</span>
            <span>{{ ride.driverPhone }}</span>
          </div>
        </section>

        <!-- Timeline Stopovers route details -->
        <section class="timeline-section glass-panel">
          <h4 class="section-title">Ride Schedule</h4>
          
          <div class="timeline-flow">
            <!-- Departure -->
            <div class="flow-node">
              <div class="bullet bullet-blue"></div>
              <div class="node-meta">
                <span class="node-time">{{ ride.departureTime }}</span>
                <span class="node-name">{{ ride.startLocation }}</span>
              </div>
            </div>

            <!-- Intermediary stops -->
            <div class="flow-node" *ngFor="let stop of ride.stops">
              <div class="bullet bullet-orange"></div>
              <div class="node-meta">
                <span class="node-time">{{ stop.arrivalTime }}</span>
                <span class="node-name">{{ stop.name }} (Stopover)</span>
              </div>
            </div>

            <!-- Destination -->
            <div class="flow-node">
              <div class="bullet bullet-green"></div>
              <div class="node-meta">
                <span class="node-time">{{ ride.arrivalTime }}</span>
                <span class="node-name font-bold">{{ ride.destination }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Vehicle specs -->
        <section class="vehicle-section glass-panel">
          <h4 class="section-title">Vehicle & Comfort</h4>
          <div class="vehicle-card">
            <span class="material-icons-outlined car-icon">directions_car</span>
            <div class="vehicle-meta">
              <h5>{{ ride.vehicle.model }}</h5>
              <span>Type: {{ ride.vehicle.type }} &bull; Color: {{ ride.vehicle.color }}</span>
            </div>
            <span class="plate-badge">{{ ride.vehicle.numberPlate }}</span>
          </div>
          <p class="about-msg" *ngIf="ride.aboutRide">
            "{{ ride.aboutRide }}"
          </p>
        </section>

        <!-- Reviews list -->
        <section class="reviews-section glass-panel" *ngIf="!userStore.loading()">
          <div class="reviews-header-row">
            <h4 class="section-title">Passenger Reviews</h4>
            <button 
              *ngIf="isCurrentRideCompleted()"
              class="ripple-btn btn-secondary rate-driver-btn" 
              (click)="openReviewModal()">
              <span class="material-icons-outlined">rate_review</span>
              Rate Driver
            </button>
          </div>
          
          <div 
            *ngIf="!isCurrentRideCompleted()"
            class="rate-driver-notice animate-fade-in">
            <span class="material-icons-outlined notice-icon">info</span>
            <span>You can rate this driver after completing a ride.</span>
          </div>
          
          <div class="reviews-carousel" *ngIf="userStore.reviews().length > 0; else noReviews">
            <div class="review-card slide-in" *ngFor="let rev of userStore.reviews()">
              <div class="rev-header">
                <div class="rev-avatar" [style.background-color]="getAvatarColor(rev.reviewerName)">
                  {{ getInitials(rev.reviewerName) }}
                </div>
                <div class="rev-meta">
                  <span class="rev-name">{{ rev.reviewerName }}</span>
                  <span class="rev-date">{{ rev.createdAt | date:'MMM dd, yyyy' }}</span>
                </div>
                <app-star-rating [rating]="rev.rating" [showText]="false"></app-star-rating>
              </div>
              <p class="rev-comment" *ngIf="rev.comment">"{{ rev.comment }}"</p>
            </div>
          </div>
          <ng-template #noReviews>
            <p class="no-reviews-text">No reviews yet. Be the first to share your experience!</p>
          </ng-template>
        </section>

      </div>

      <!-- Action checkout footer bar -->
      <footer class="action-footer glass-panel">
        <div class="footer-price">
          <span class="footer-price-val">₹{{ ride.pricePerSeat }}</span>
          <span class="footer-price-lbl">per seat</span>
        </div>
        <button 
          class="ripple-btn book-btn" 
          [class.disabled-btn]="ride.availableSeats === 0"
          [disabled]="ride.availableSeats === 0"
          (click)="bookRide(ride.id)">
          {{ ride.availableSeats === 0 ? 'Fully Booked' : 'Book Seats' }}
        </button>
      </footer>

      <!-- Premium Glassmorphic Rate Driver Modal Sheet -->
      <div class="modal-backdrop fade-in" *ngIf="showReviewModal" (click)="closeReviewModal()">
        <div class="modal-sheet slide-up glass-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>Rate {{ ride.driverName }}</h4>
            <button class="close-modal-btn" (click)="closeReviewModal()">
              <span class="material-icons-outlined">close</span>
            </button>
          </div>

          <form (ngSubmit)="submitReview()" #reviewForm="ngForm" class="review-form">
            <!-- Dynamic Star Rating Picker -->
            <div class="star-rating-picker">
              <span class="picker-label">Your Star Rating</span>
              <div class="stars-row">
                <span 
                  *ngFor="let star of [1, 2, 3, 4, 5]" 
                  class="material-icons-outlined star-picker-icon"
                  [class.filled]="star <= hoverRating || star <= selectedRating"
                  (mouseenter)="hoverRating = star"
                  (mouseleave)="hoverRating = 0"
                  (click)="selectedRating = star">
                  {{ star <= hoverRating || star <= selectedRating ? 'star' : 'star_border' }}
                </span>
              </div>
              <span class="rating-text-hint" *ngIf="selectedRating > 0">
                {{ getRatingHintText(selectedRating) }}
              </span>
            </div>

            <!-- Written Comment Textarea -->
            <div class="custom-input-group">
              <label>Written Review (Optional)</label>
              <div class="input-wrapper">
                <textarea 
                  [(ngModel)]="reviewComment" 
                  name="comment" 
                  placeholder="Share details of your travel comfort, communication, cleanliness, etc." 
                  class="form-textarea"></textarea>
              </div>
            </div>

            <!-- Submit Button -->
            <button 
              type="submit" 
              class="ripple-btn submit-review-btn" 
              [disabled]="selectedRating === 0">
              Submit Review
            </button>
          </form>
        </div>
      </div>

    </div>

    <ng-template #loader>
      <div class="page-loader">
        <span class="spinner-large"></span>
      </div>
    </ng-template>
  `,
  styles: [`
    .ride-details-page {
      padding: 16px;
      padding-bottom: 110px;
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

    .details-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Route banner */
    .route-banner {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .route-date {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        font-weight: 700;
        color: hsl(var(--text-secondary));
        text-transform: uppercase;
        letter-spacing: 0.5px;

        .date-icon { font-size: 16px; }
      }

      h2 {
        font-size: 1.4rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        color: var(--color-primary);
      }
    }

    /* Driver summary */
    .driver-section {
      padding: 18px;
    }

    .driver-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .driver-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 750;
      font-size: 1rem;
      font-family: var(--font-primary);
      border: 2px solid var(--color-primary);

      &.large {
        width: 54px;
        height: 54px;
        font-size: 1.25rem;
      }
    }

    .driver-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .driver-joined {
      font-size: 0.72rem;
      color: hsl(var(--text-secondary));
      font-weight: 500;
    }

    .driver-phone {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
      font-weight: 700;
      color: hsl(var(--text-primary));
      margin-top: 14px;
      border-top: 1px solid hsl(var(--border-light));
      padding-top: 12px;

      span { font-size: 18px; }
    }

    /* Timeline stops */
    .timeline-section {
      padding: 18px;
    }

    .section-title {
      font-size: 0.85rem;
      font-weight: 800;
      color: hsl(var(--text-secondary));
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }

    .timeline-flow {
      display: flex;
      flex-direction: column;
      gap: 20px;
      border-left: 2px dashed hsl(var(--border-medium));
      padding-left: 16px;
      margin-left: 12px;
    }

    .flow-node {
      position: relative;
    }

    .bullet {
      position: absolute;
      left: -22px;
      top: 4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: hsl(var(--border-medium));

      &.bullet-blue { background-color: var(--color-primary); box-shadow: 0 0 0 4px rgba(10, 132, 255, 0.2); }
      &.bullet-orange { background-color: #ffb300; }
      &.bullet-green { background-color: var(--color-secondary); box-shadow: 0 0 0 4px rgba(52, 199, 89, 0.2); }
    }

    .node-meta {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .node-time {
      font-size: 0.88rem;
      font-weight: 800;
      color: hsl(var(--text-primary));
      min-width: 52px;
    }

    .node-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: hsl(var(--text-secondary));

      &.font-bold {
        font-weight: 750;
        color: hsl(var(--text-primary));
      }
    }

    /* Vehicle specs */
    .vehicle-section {
      padding: 18px;
    }

    .vehicle-card {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 12px;
    }

    .car-icon {
      font-size: 24px;
      color: hsl(var(--text-secondary));
    }

    .vehicle-meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;

      h5 {
        font-size: 0.9rem;
        font-weight: 850;
      }

      span {
        font-size: 0.72rem;
        color: hsl(var(--text-secondary));
        font-weight: 500;
      }
    }

    .plate-badge {
      font-size: 0.72rem;
      font-weight: 800;
      background-color: hsl(var(--bg-tertiary));
      border: 1px solid hsl(var(--border-light));
      color: hsl(var(--text-primary));
      padding: 4px 8px;
      border-radius: 6px;
    }

    .about-msg {
      font-size: 0.8rem;
      font-style: italic;
      color: hsl(var(--text-secondary));
      line-height: 1.45;
      background-color: hsl(var(--bg-secondary));
      padding: 12px;
      border-radius: 8px;
    }

    /* Reviews section */
    .reviews-section {
      padding: 18px;
    }

    .reviews-carousel {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .review-card {
      padding: 14px;
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rev-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rev-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 750;
      font-size: 0.8rem;
      font-family: var(--font-primary);
    }

    .rev-meta {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .rev-name {
      font-size: 0.8rem;
      font-weight: 750;
      color: hsl(var(--text-primary));
    }

    .rev-date {
      font-size: 0.65rem;
      color: hsl(var(--text-tertiary));
    }

    .rev-comment {
      font-size: 0.78rem;
      color: hsl(var(--text-secondary));
      line-height: 1.4;
      font-style: italic;
    }

    .rate-driver-notice {
      display: flex;
      align-items: center;
      gap: 10px;
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      padding: 12px 14px;
      margin-bottom: 16px;
      font-size: 0.78rem;
      color: hsl(var(--text-secondary));
      font-weight: 600;
      
      .notice-icon {
        font-size: 18px;
        color: var(--color-primary);
      }
    }

    /* Action footer sticky */
    .action-footer {
      position: fixed;
      bottom: 12px;
      left: 12px;
      right: 12px;
      height: 72px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px !important;
      z-index: 1000;
      border-radius: var(--border-radius-md);
      border: 1px solid var(--glass-border);
      box-shadow: var(--shadow-lg);

      @media (min-width: 501px) {
        width: 476px;
        left: 50%;
        transform: translateX(-50%);
        bottom: 16px;
      }
    }

    .footer-price {
      display: flex;
      flex-direction: column;
    }

    .footer-price-val {
      font-size: 1.35rem;
      font-weight: 850;
      color: var(--color-primary);
      line-height: 1.1;
    }

    .footer-price-lbl {
      font-size: 0.65rem;
      font-weight: 700;
      color: hsl(var(--text-tertiary));
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .book-btn {
      padding: 12px 24px;
      font-size: 0.88rem;
    }

    .disabled-btn {
      background-color: hsl(var(--bg-tertiary)) !important;
      color: hsl(var(--text-tertiary)) !important;
      border: 1px solid hsl(var(--border-light)) !important;
      cursor: not-allowed !important;
      opacity: 0.6;
    }

    .reviews-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      
      .section-title {
        margin-bottom: 0 !important;
      }
    }

    .rate-driver-btn {
      padding: 6px 12px;
      font-size: 0.75rem;
      border-radius: var(--border-radius-sm);
      background-color: rgba(var(--color-primary-rgb), 0.05);
      color: var(--color-primary);
      box-shadow: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      
      span {
        font-size: 16px;
      }
      
      &:hover {
        background-color: rgba(var(--color-primary-rgb), 0.1);
        box-shadow: none;
      }
    }

    .no-reviews-text {
      font-size: 0.8rem;
      color: hsl(var(--text-secondary));
      font-style: italic;
      text-align: center;
      padding: 10px 0;
    }

    /* Modal Backdrop glass style */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 2000;
      display: flex;
      justify-content: center;
      align-items: flex-end; /* Bottom sheet on mobile */

      @media (min-width: 501px) {
        align-items: center; /* Centered modal on desktop */
      }
    }

    .modal-sheet {
      width: 100%;
      max-width: 500px;
      background-color: hsl(var(--bg-primary));
      border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
      padding: 24px;
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--glass-border);
      border-bottom: none;

      @media (min-width: 501px) {
        border-radius: var(--border-radius-lg);
        border-bottom: 1px solid var(--glass-border);
        margin: 16px;
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;

      h4 {
        font-size: 1.15rem;
        font-weight: 850;
      }
    }

    .close-modal-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: hsl(var(--text-secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 50%;
      transition: var(--transition-smooth);

      span { font-size: 20px; }

      &:hover {
        background-color: hsl(var(--bg-tertiary));
        color: hsl(var(--text-primary));
      }
    }

    .review-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* Star Picker Styling */
    .star-rating-picker {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      padding: 18px;

      .picker-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: hsl(var(--text-tertiary));
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .stars-row {
      display: flex;
      gap: 8px;
    }

    .star-picker-icon {
      font-size: 32px;
      color: hsl(var(--border-medium));
      cursor: pointer;
      user-select: none;
      transition: var(--transition-smooth);

      &:hover {
        transform: scale(1.15);
      }

      &.filled {
        color: #ffb300;
      }
    }

    .rating-text-hint {
      font-size: 0.8rem;
      font-weight: 750;
      color: var(--color-primary);
    }

    /* Input controls */
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
        border: 1px solid hsl(var(--border-light));
        border-radius: var(--border-radius-sm);
        background-color: hsl(var(--bg-secondary));
        padding: 4px;
        transition: var(--transition-smooth);

        &:focus-within {
          border-color: var(--color-primary);
          background-color: hsl(var(--bg-primary));
          box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15);
        }
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

    .submit-review-btn {
      width: 100%;
      padding: 14px;
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
  `]
})
export class RideDetailsComponent implements OnInit {
  authStore = inject(AuthStore);
  rideStore = inject(RideStore);
  userStore = inject(UserStore);
  bookingStore = inject(BookingStore);
  route = inject(ActivatedRoute);
  router = inject(Router);

  // Review Form parameters
  showReviewModal = false;
  selectedRating = 0;
  hoverRating = 0;
  reviewComment = '';

  constructor() {
    effect(() => {
      const ride = this.rideStore.activeRide();
      if (ride) {
        this.userStore.loadReviews(ride.driverId);
      }
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.rideStore.loadRideDetails(id);
    }
    const currentUser = this.authStore.currentUser();
    if (currentUser) {
      this.bookingStore.loadBookings(currentUser.id);
    }
  }

  bookRide(rideId: string) {
    this.router.navigate(['/booking', rideId]);
  }

  openReviewModal() {
    if (!this.isCurrentRideCompleted()) return;
    this.selectedRating = 0;
    this.hoverRating = 0;
    this.reviewComment = '';
    this.showReviewModal = true;
  }

  closeReviewModal() {
    this.showReviewModal = false;
  }

  getRatingHintText(rating: number): string {
    const hints: { [key: number]: string } = {
      1: 'Very Bad 😞',
      2: 'Bad 😐',
      3: 'Good 🙂',
      4: 'Very Good 😊',
      5: 'Excellent! 😄'
    };
    return hints[rating] || '';
  }

  getCompletedBookingId(): string {
    const ride = this.rideStore.activeRide();
    if (!ride) return '';

    const currentUser = this.authStore.currentUser();
    if (!currentUser) return '';

    const bookings = this.bookingStore.bookings();
    const booking = bookings.find(b => 
      b.passengerId === currentUser.id && 
      b.rideId === ride.id && 
      b.status === 'completed'
    );
    return booking ? booking.id : '';
  }

  submitReview() {
    if (this.selectedRating === 0) return;
    if (!this.isCurrentRideCompleted()) return;
    
    const ride = this.rideStore.activeRide();
    const currentUser = this.authStore.currentUser();
    const bookingId = this.getCompletedBookingId();
    if (ride && currentUser && bookingId) {
      this.userStore.submitReview(
        ride.driverId,
        this.selectedRating,
        this.reviewComment.trim(),
        currentUser.name,
        currentUser.photoUrl,
        bookingId,
        () => {
          // Reload the active ride details to update the average rating on the UI
          this.rideStore.loadRideDetails(ride.id);
        }
      );

      this.closeReviewModal();
    }
  }

  isCurrentRideCompleted(): boolean {
    const ride = this.rideStore.activeRide();
    if (!ride) return false;

    const currentUser = this.authStore.currentUser();
    if (!currentUser) return false;

    const bookings = this.bookingStore.bookings();
    return bookings.some(b => 
      b.passengerId === currentUser.id && 
      b.rideId === ride.id && 
      b.status === 'completed'
    );
  }

  // Offline fallback initials avatars generators
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

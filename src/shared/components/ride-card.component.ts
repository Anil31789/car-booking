import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Ride } from '../../core/models/ride.models';
import { StarRatingComponent } from './star-rating.component';

@Component({
  selector: 'app-ride-card',
  standalone: true,
  imports: [CommonModule, StarRatingComponent],
  template: `
    <div class="ride-card glass-panel" (click)="viewDetails()" title="Click to view details and book">
      <!-- Card Header: Driver Meta & Price -->
      <div class="card-header">
        <div class="driver-summary">
          <!-- Driver photo avatar with fallback -->
          <img *ngIf="ride.driverPhoto && !ride.imageError" [src]="ride.driverPhoto" (error)="ride.imageError = true" [alt]="ride.driverName" class="driver-avatar-img" />
          <div class="driver-avatar" *ngIf="!ride.driverPhoto || ride.imageError" [style.background-color]="getAvatarColor(ride.driverName)">
            {{ getInitials(ride.driverName) }}
          </div>
          <div class="driver-info">
            <div class="driver-name-row">
              <span class="driver-name">{{ ride.driverName }}</span>
              <span class="material-icons-outlined verified-badge" *ngIf="ride.isDriverVerified" title="Verified Driver">verified</span>
            </div>
            <app-star-rating [rating]="ride.driverRating" [showText]="false"></app-star-rating>
          </div>
        </div>
        <div class="price-container">
          <span class="price-val">₹{{ ride.pricePerSeat }}</span>
          <span class="price-lbl">per seat</span>
        </div>
      </div>

      <!-- Card Body: Travel Path Timeline -->
      <div class="card-body">
        <div class="timeline-route">
          <div class="timeline-node">
            <span class="node-time">{{ ride.departureTime }}</span>
            <div class="node-dot dep"></div>
            <span class="node-loc">{{ ride.startLocation }}</span>
          </div>

          <!-- Mid points indicator -->
          <div class="timeline-connector">
            <span class="stop-count" *ngIf="ride.stops.length > 0">
              {{ ride.stops.length }} stop{{ ride.stops.length > 1 ? 's' : '' }} ({{ ride.stops[0].name }})
            </span>
          </div>

          <div class="timeline-node">
            <span class="node-time">{{ ride.arrivalTime }}</span>
            <div class="node-dot dest"></div>
            <span class="node-loc font-bold">{{ ride.destination }}</span>
          </div>
        </div>
      </div>

      <!-- Card Footer: Vehicle and Seats Info -->
      <div class="card-footer">
        <div class="footer-meta">
          <span class="material-icons-outlined meta-icon">directions_car</span>
          <span class="meta-text">{{ ride.vehicle.model }}</span>
        </div>
        
        <span class="seats-badge" [class.danger]="ride.availableSeats === 1" [class.booked]="ride.availableSeats === 0">
          {{ ride.availableSeats === 0 ? 'Fully Booked' : (ride.availableSeats + ' seat' + (ride.availableSeats > 1 ? 's' : '') + ' left') }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .ride-card {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      border: 1px solid hsl(var(--border-light));
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        border-color: rgba(10, 132, 255, 0.25);
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid hsl(var(--border-light));
      padding-bottom: 12px;
    }

    .driver-summary {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .driver-avatar-img {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      object-fit: cover;
      border: 1.5px solid var(--color-primary);
      flex-shrink: 0;
    }

    .driver-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 750;
      font-size: 0.9rem;
      font-family: var(--font-primary);
      border: 1.5px solid var(--color-primary);
    }

    .driver-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .driver-name-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .driver-name {
      font-size: 0.88rem;
      font-weight: 750;
      color: hsl(var(--text-primary));
    }

    .verified-badge {
      font-size: 15px;
      color: var(--color-primary);
    }

    .price-container {
      text-align: right;
      display: flex;
      flex-direction: column;

      .price-val {
        font-size: 1.15rem;
        font-weight: 850;
        color: var(--color-primary);
        line-height: 1.1;
      }

      .price-lbl {
        font-size: 0.65rem;
        font-weight: 600;
        color: hsl(var(--text-tertiary));
        text-transform: uppercase;
      }
    }

    /* Path timeline layout */
    .card-body {
      padding: 4px 0;
    }

    .timeline-route {
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .timeline-node {
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 2;
    }

    .node-time {
      font-size: 0.85rem;
      font-weight: 750;
      color: hsl(var(--text-primary));
      min-width: 48px;
    }

    .node-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: hsl(var(--border-medium));
      border: 1.5px solid hsl(var(--bg-primary));

      &.dep {
        border-color: var(--color-primary);
        background-color: var(--color-primary);
      }

      &.dest {
        border-color: var(--color-secondary);
        background-color: var(--color-secondary);
      }
    }

    .node-loc {
      font-size: 0.85rem;
      font-weight: 600;
      color: hsl(var(--text-secondary));

      &.font-bold {
        font-weight: 750;
        color: hsl(var(--text-primary));
      }
    }

    .timeline-connector {
      margin-left: 51px;
      height: 22px;
      border-left: 2px dashed hsl(var(--border-medium));
      display: flex;
      align-items: center;
      padding-left: 12px;
    }

    .stop-count {
      font-size: 0.7rem;
      font-weight: 600;
      color: hsl(var(--text-tertiary));
    }

    /* Footer layouts */
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 10px;
      border-top: 1px solid hsl(var(--border-light));
    }

    .footer-meta {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .meta-icon {
      font-size: 15px;
      color: hsl(var(--text-tertiary));
    }

    .meta-text {
      font-size: 0.75rem;
      font-weight: 600;
      color: hsl(var(--text-secondary));
    }

    .seats-badge {
      font-size: 0.72rem;
      font-weight: 800;
      color: var(--color-secondary);
      background-color: rgba(52, 199, 89, 0.1);
      padding: 3px 8px;
      border-radius: 6px;

      &.danger {
        color: var(--color-danger);
        background-color: rgba(255, 69, 58, 0.1);
      }

      &.booked {
        color: hsl(var(--text-secondary));
        background-color: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
    }
  `]
})
export class RideCardComponent {
  @Input() ride!: Ride;

  private router = inject(Router);

  viewDetails() {
    this.router.navigate(['/ride', this.ride.id]);
  }

  // Offline initials fallback generator
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

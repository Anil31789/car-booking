import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RideStore } from '../../core/store/ride.store';
import { AuthStore } from '../../core/store/auth.store';
import { SearchQuery } from '../../core/models/ride.models';
import { RideCardComponent } from '../../shared/components/ride-card.component';
import { LocationAutocompleteComponent } from '../../shared/components/location-autocomplete.component';
import { RideService } from '../../core/services/ride.service';
import { Ride } from '../../core/models/ride.models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RideCardComponent, LocationAutocompleteComponent],
  template: `
    <div class="home-container slide-in">
      
      <!-- Visual Greeting -->
      <section class="greeting-banner">
        <h1 *ngIf="!authStore.isDriver()">Find your perfect ride</h1>
        <h1 *ngIf="authStore.isDriver()">Hello, {{ authStore.currentUser()?.name }}!</h1>
        
        <p *ngIf="!authStore.isDriver()">Book safe, cost-efficient rides across major highways in India.</p>
        <p *ngIf="authStore.isDriver()">Ready to share your next journey? Offer seats and slash travel costs, or manage pending passenger requests below.</p>
      </section>

      <!-- Driver Dashboard Quick Shortcuts (visible to drivers only) -->
      <section class="driver-shortcuts-section slide-in" *ngIf="authStore.isDriver()">
        <div class="driver-shortcut-card glass-panel">
          <div class="shortcut-header">
            <span class="material-icons-outlined shortcut-icon text-secondary">dashboard</span>
            <h4>Driver Control Board</h4>
          </div>
          <p class="shortcut-desc">Manage your active carpools, accept passenger requests, or post a new route offer.</p>
          <div class="shortcut-buttons">
            <button class="ripple-btn shortcut-btn-main" (click)="router.navigate(['/driver'])">
              <span class="material-icons-outlined">add_circle</span> Offer a Ride
            </button>
            <button class="ripple-btn btn-secondary shortcut-btn-sub" (click)="router.navigate(['/driver'])">
              <span class="material-icons-outlined">people</span> Manage Bookings
            </button>
          </div>
        </div>
      </section>

      <!-- Main Search Card Overlay -->
      <section class="search-section">
        <div class="search-card">
          <form (ngSubmit)="onSearch()" class="search-form">
            <!-- From Location Autocomplete -->
            <app-location-autocomplete
              [label]="'Leaving from'"
              [placeholder]="'e.g. Mumbai'"
              [(value)]="searchFrom"
              [icon]="'trip_origin'"
              [iconClass]="'text-primary'">
            </app-location-autocomplete>

            <div class="input-divider"></div>

            <!-- To Location Autocomplete -->
            <app-location-autocomplete
              [label]="'Going to'"
              [placeholder]="'e.g. Pune'"
              [(value)]="searchTo"
              [icon]="'place'"
              [iconClass]="'text-secondary'">
            </app-location-autocomplete>

            <div class="input-divider"></div>

            <!-- Date & Seats Row -->
            <div class="split-row">
              <!-- Departure Date -->
              <div class="input-row split-half">
                <span class="material-icons-outlined input-icon">today</span>
                <div class="input-details">
                  <label>Date</label>
                  <input 
                    type="date" 
                    [(ngModel)]="searchDate" 
                    name="date" 
                    required
                    [min]="minDate"
                    class="search-input" />
                </div>
              </div>

              <div class="vertical-divider"></div>

              <!-- Passenger count dropdown -->
              <div class="input-row split-half">
                <span class="material-icons-outlined input-icon">group</span>
                <div class="input-details">
                  <label>Passengers</label>
                  <select [(ngModel)]="searchSeats" name="seats" class="search-input select-input">
                    <option *ngFor="let num of [1, 2, 3, 4, 5, 6]" [value]="num">{{ num }} seat{{ num > 1 ? 's' : '' }}</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Search Action CTA -->
            <button type="submit" class="ripple-btn search-btn">
              <span class="material-icons-outlined">search</span>
              Search Rides
            </button>
          </form>
        </div>
      </section>

      <!-- Popular Routes Section -->
      <section class="home-section">
        <h3 class="section-title">Popular Routes</h3>
        <div class="routes-grid">
          <div 
            *ngFor="let route of popularRoutes" 
            class="route-pill" 
            (click)="selectPopularRoute(route.from, route.to)">
            <div class="route-pill-content">
              <span class="route-loc">{{ route.from }}</span>
              <span class="material-icons-outlined arrow-icon">arrow_forward</span>
              <span class="route-loc font-bold">{{ route.to }}</span>
            </div>
            <span class="route-price">From ₹{{ route.minPrice }}</span>
          </div>
        </div>
      </section>

      <!-- Recent Searches Section (simulated) -->
      <section class="home-section" *ngIf="recentSearches.length > 0">
        <h3 class="section-title">Recent Searches</h3>
        <div class="recent-searches-list">
          <div 
            *ngFor="let item of recentSearches" 
            class="recent-search-item" 
            (click)="selectRecentSearch(item)">
            <span class="material-icons-outlined history-icon">history</span>
            <div class="recent-meta">
              <span class="recent-route">{{ item.from }} &rarr; {{ item.to }}</span>
              <span class="recent-details">{{ item.date | date:'MMM dd' }} &bull; {{ item.passengers }} passenger{{ item.passengers > 1 ? 's' : '' }}</span>
            </div>
            <span class="material-icons-outlined chevron-icon">chevron_right</span>
          </div>
        </div>
      </section>

      <!-- Featured Rides -->
      <section class="home-section">
        <h3 class="section-title">Featured Rides</h3>
        <div class="featured-list">
          <app-ride-card 
            *ngFor="let ride of featuredRides" 
            [ride]="ride">
          </app-ride-card>
        </div>
      </section>

    </div>
  `,
  styles: [`
    .home-container {
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 90px;
    }

    .greeting-banner {
      h1 {
        font-size: 1.6rem;
        font-weight: 800;
        letter-spacing: -0.7px;
        line-height: 1.25;
        margin-bottom: 6px;
      }
      p {
        font-size: 0.85rem;
        color: hsl(var(--text-secondary));
        line-height: 1.4;
      }
    }

    // Search Card Form
    .search-card {
      background-color: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
      box-shadow: var(--shadow-md);
      border-radius: var(--border-radius-md);
      padding: 16px;
    }

    .search-form {
      display: flex;
      flex-direction: column;
    }

    .input-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 0;
    }

    .input-icon {
      font-size: 22px;
      color: hsl(var(--text-tertiary));
    }

    .input-details {
      display: flex;
      flex-direction: column;
      flex: 1;

      label {
        font-size: 0.72rem;
        font-weight: 700;
        color: hsl(var(--text-tertiary));
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      }
    }

    .search-input {
      border: none;
      background: none;
      outline: none;
      font-size: 0.95rem;
      font-weight: 600;
      color: hsl(var(--text-primary));
      padding: 0;
      width: 100%;
      
      &::placeholder {
        color: hsl(var(--text-tertiary));
        font-weight: 500;
      }
    }

    .select-input {
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
    }

    .input-divider {
      height: 1px;
      background-color: hsl(var(--border-light));
      margin: 8px 0;
    }

    .split-row {
      display: flex;
      align-items: center;
      border-top: 1px solid hsl(var(--border-light));
      border-bottom: 1px solid hsl(var(--border-light));
      margin-bottom: 16px;
    }

    .split-half {
      width: 48%;
      padding: 12px 0;
    }

    .vertical-divider {
      width: 1px;
      align-self: stretch;
      background-color: hsl(var(--border-light));
      margin: 8px 8px;
    }

    .search-btn {
      width: 100%;
      padding: 14px;
      border-radius: var(--border-radius-sm);
    }

    // Common Section Title
    .home-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .section-title {
      font-size: 1.05rem;
      font-weight: 850;
      color: hsl(var(--text-primary));
      letter-spacing: -0.3px;
    }

    // Popular Routes pill styles
    .routes-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .route-pill {
      background-color: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
      padding: 12px 16px;
      border-radius: var(--border-radius-sm);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      transition: var(--transition-spring);

      &:hover {
        border-color: rgba(10, 132, 255, 0.2);
        background-color: hsl(var(--bg-secondary));
        transform: translateY(-1px);
      }
    }

    .route-pill-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .route-loc {
      font-size: 0.88rem;
      font-weight: 500;
      color: hsl(var(--text-primary));

      &.font-bold {
        font-weight: 750;
      }
    }

    .arrow-icon {
      font-size: 15px;
      color: hsl(var(--text-tertiary));
    }

    .route-price {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--color-primary);
    }

    // Recent Searches
    .recent-searches-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .recent-search-item {
      background-color: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: var(--transition-spring);

      &:hover {
        border-color: rgba(10, 132, 255, 0.15);
        background-color: hsl(var(--bg-secondary));
      }
    }

    .history-icon {
      font-size: 20px;
      color: hsl(var(--text-tertiary));
    }

    .recent-meta {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .recent-route {
      font-size: 0.85rem;
      font-weight: 750;
      color: hsl(var(--text-primary));
    }

    .recent-details {
      font-size: 0.72rem;
      color: hsl(var(--text-secondary));
    }

    .chevron-icon {
      font-size: 18px;
      color: hsl(var(--text-tertiary));
    }

    // Driver Shortcuts
    .driver-shortcuts-section {
      width: 100%;
    }

    .driver-shortcut-card {
      padding: 16px;
      border: 1px solid rgba(52, 199, 89, 0.15);
      background: linear-gradient(135deg, rgba(52, 199, 89, 0.02), rgba(10, 132, 255, 0.02));
      border-radius: var(--border-radius-sm);
    }

    .shortcut-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .shortcut-icon {
        font-size: 20px;
      }

      h4 {
        font-size: 0.95rem;
        font-weight: 850;
        color: hsl(var(--text-primary));
      }
    }

    .shortcut-desc {
      font-size: 0.78rem;
      color: hsl(var(--text-secondary));
      line-height: 1.45;
      margin-bottom: 14px;
    }

    .shortcut-buttons {
      display: flex;
      gap: 12px;
    }

    .shortcut-btn-main {
      flex: 1;
      padding: 10px 14px;
      font-size: 0.78rem;
      background-color: var(--color-secondary);
      box-shadow: 0 4px 12px rgba(52, 199, 89, 0.2);
      
      &:hover {
        box-shadow: 0 6px 16px rgba(52, 199, 89, 0.3);
      }
    }

    .shortcut-btn-sub {
      flex: 1;
      padding: 10px 14px;
      font-size: 0.78rem;
    }

    // Featured Rides
    .featured-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `]
})
export class HomeComponent implements OnInit {
  rideStore = inject(RideStore);
  authStore = inject(AuthStore);
  router = inject(Router);
  rideService = inject(RideService);

  private platformId = inject(PLATFORM_ID);

  // Search parameters bound to form
  searchFrom = '';
  searchTo = '';
  searchDate = '';
  searchSeats = 1;

  minDate = '';
  featuredRides: Ride[] = [];

  popularRoutes = [
    { from: 'Mumbai', to: 'Pune', minPrice: 300 },
    { from: 'Nagpur', to: 'Pune', minPrice: 1000 },
    { from: 'Hyderabad', to: 'Bangalore', minPrice: 900 }
  ];

  recentSearches: SearchQuery[] = [];

  ngOnInit() {
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];
    this.searchDate = this.minDate;

    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('recent_searches');
      if (stored) {
        try {
          this.recentSearches = JSON.parse(stored);
        } catch (e) {
          this.recentSearches = [];
        }
      }
    }

    if (this.recentSearches.length === 0) {
      this.recentSearches = [
        { from: 'Mumbai', to: 'Pune', date: '', passengers: 2 },
        { from: 'Hyderabad', to: 'Bangalore', date: '', passengers: 1 }
      ];
    }

    // Autofill dates for recent searches to keep them valid
    const tomorrowStr = new Date();
    tomorrowStr.setDate(today.getDate() + 1);
    this.recentSearches.forEach(rs => {
      if (!rs.date) {
        rs.date = tomorrowStr.toISOString().split('T')[0];
      }
    });

    // Retrieve featured rides
    this.rideService.getRides().subscribe(allRides => {
      this.featuredRides = allRides.filter(r => r.availableSeats > 1 && r.departureDate >= this.minDate).slice(0, 2);
    });
  }

  onSearch() {
    if (!this.searchFrom || !this.searchTo || !this.searchDate) return;

    const query: SearchQuery = {
      from: this.searchFrom,
      to: this.searchTo,
      date: this.searchDate,
      passengers: Number(this.searchSeats)
    };

    if (isPlatformBrowser(this.platformId)) {
      let list = this.recentSearches.filter(
        rs => !(rs.from.toLowerCase() === query.from.toLowerCase() && rs.to.toLowerCase() === query.to.toLowerCase())
      );
      list.unshift(query);
      list = list.slice(0, 4);
      this.recentSearches = list;
      localStorage.setItem('recent_searches', JSON.stringify(list));
    }

    // Update store state
    this.rideStore.setSearchQuery(query);
    this.rideStore.search();
    
    // Route to Search Results page
    this.router.navigate(['/search']);
  }

  selectPopularRoute(from: string, to: string) {
    this.searchFrom = from;
    this.searchTo = to;
    this.searchDate = new Date().toISOString().split('T')[0]; // today
    this.searchSeats = 1;
    this.onSearch();
  }

  selectRecentSearch(search: SearchQuery) {
    this.searchFrom = search.from;
    this.searchTo = search.to;
    this.searchDate = search.date;
    this.searchSeats = search.passengers;
    this.onSearch();
  }
}

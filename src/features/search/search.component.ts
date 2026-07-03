import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RideStore } from '../../core/store/ride.store';
import { RideCardComponent } from '../../shared/components/ride-card.component';
import { LocationAutocompleteComponent } from '../../shared/components/location-autocomplete.component';
import { SearchQuery, RideFilters } from '../../core/models/ride.models';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RideCardComponent, LocationAutocompleteComponent],
  template: `
    <div class="search-page slide-in">
      
      <!-- Top Sticky Mini-Search Header -->
      <section class="mini-search-bar" (click)="toggleSearchForm = !toggleSearchForm">
        <div class="mini-search-details" *ngIf="rideStore.searchQuery() as q; else noQuery">
          <span class="material-icons-outlined search-icon text-primary">explore</span>
          <div class="search-path">
            <span class="path-title">{{ q.from }} &rarr; {{ q.to }}</span>
            <span class="path-meta">{{ q.date | date:'EEE, dd MMM' }} &bull; {{ q.passengers }} seat{{ q.passengers > 1 ? 's' : '' }}</span>
          </div>
        </div>
        <ng-template #noQuery>
          <div class="mini-search-details">
            <span class="material-icons-outlined search-icon text-primary">search</span>
            <div class="search-path">
              <span class="path-title">Where are you going?</span>
              <span class="path-meta">Tap to search ride offers</span>
            </div>
          </div>
        </ng-template>
        <button class="filter-toggle-btn">
          <span class="material-icons-outlined">tune</span>
        </button>
      </section>

      <!-- Search Edit Expandable Panel -->
      <div class="search-edit-panel" *ngIf="toggleSearchForm">
        <div class="glass-panel">
          <div class="edit-inputs">
            <div class="edit-input-row-autocomplete">
              <app-location-autocomplete
                [placeholder]="'Leaving from'"
                [(value)]="editFrom"
                [icon]="'trip_origin'"
                [iconClass]="'text-primary'">
              </app-location-autocomplete>
            </div>
            <div class="edit-divider"></div>
            <div class="edit-input-row-autocomplete">
              <app-location-autocomplete
                [placeholder]="'Going to'"
                [(value)]="editTo"
                [icon]="'place'"
                [iconClass]="'text-secondary'">
              </app-location-autocomplete>
            </div>
            <div class="edit-divider"></div>
            <div class="edit-input-row">
              <span class="material-icons-outlined">today</span>
              <input type="date" [(ngModel)]="editDate" style="border:none; outline:none; font-weight:600; width:100%; color:hsl(var(--text-primary)); background:none;" />
            </div>
            <div class="edit-divider"></div>
            <div class="edit-input-row">
              <span class="material-icons-outlined">group</span>
              <select [(ngModel)]="editPassengers" style="border:none; outline:none; font-weight:600; width:100%; color:hsl(var(--text-primary)); background:none; cursor:pointer;">
                <option *ngFor="let num of [1, 2, 3, 4, 5, 6]" [value]="num">{{ num }} seat{{ num > 1 ? 's' : '' }}</option>
              </select>
            </div>
          </div>
          <button class="ripple-btn apply-search-btn" (click)="applyEditSearch()">
            Update Search
          </button>
        </div>
      </div>

      <!-- Quick Action Controls (Sort Trigger & Filters Count) -->
      <section class="quick-controls">
        <div class="sort-selector">
          <span class="material-icons-outlined sort-icon">sort</span>
          <select [ngModel]="rideStore.filters().sortBy" (ngModelChange)="onSortChange($event)">
            <option value="price_asc">Lowest Price</option>
            <option value="time_asc">Earliest Departure</option>
            <option value="rating_desc">Highest Rating</option>
          </select>
        </div>
        <button class="ripple-btn btn-secondary filter-pill" (click)="openFilterSheet = true">
          <span class="material-icons-outlined">filter_alt</span>
          Filters
          <span class="active-filters-count" *ngIf="getActiveFiltersCount() > 0">
            {{ getActiveFiltersCount() }}
          </span>
        </button>
      </section>

      <!-- Main Results Display -->
      <div class="results-container">
        <!-- Loader Skeletons -->
        <div class="skeletons-list" *ngIf="rideStore.loading()">
          <div class="glass-panel skeleton-card" *ngFor="let s of [1, 2, 3]">
            <div class="skeleton-timeline">
              <div class="skeleton-line skeleton"></div>
              <div class="skeleton-line skeleton" style="width: 60%"></div>
            </div>
            <div class="skeleton-divider"></div>
            <div class="skeleton-footer">
              <div class="skeleton-avatar skeleton circle"></div>
              <div class="skeleton-text skeleton" style="width: 40%"></div>
              <div class="skeleton-price skeleton" style="width: 20%; margin-left: auto;"></div>
            </div>
          </div>
        </div>

        <!-- Real Ride Results -->
        <div class="real-results" *ngIf="!rideStore.loading()">
          <div class="rides-list" *ngIf="rideStore.hasResults(); else emptyState">
            <app-ride-card 
              *ngFor="let ride of rideStore.rides()" 
              [ride]="ride">
            </app-ride-card>
          </div>
          
          <ng-template #emptyState>
            <div class="empty-state-card">
              <div class="empty-logo">
                <span class="material-icons-outlined">search_off</span>
              </div>
              <h3>No Rides Found</h3>
              <p>We couldn't find any carpools matching your parameters. Try adjusting your dates or expanding your filters!</p>
              <button class="ripple-btn btn-secondary reset-btn" (click)="resetAllFilters()">
                Reset Filters
              </button>
            </div>
          </ng-template>
        </div>
      </div>

      <!-- Filters Drawer Bottom Sheet Overlay -->
      <div class="filters-overlay" [class.open]="openFilterSheet" (click)="openFilterSheet = false">
        <div class="filter-bottom-sheet" (click)="$event.stopPropagation()">
          <header class="sheet-header">
            <h3>Filters</h3>
            <button class="close-sheet-btn" (click)="openFilterSheet = false">
              <span class="material-icons-outlined">close</span>
            </button>
          </header>

          <div class="sheet-content">
            <!-- Filter by price -->
            <div class="filter-group">
              <label class="filter-label">Max Price per Seat (₹{{ tempFilters.maxPrice }})</label>
              <input 
                type="range" 
                min="200" 
                max="2500" 
                step="50" 
                [(ngModel)]="tempFilters.maxPrice"
                class="price-slider" />
              <div class="price-bounds">
                <span>₹200</span>
                <span>₹2,500</span>
              </div>
            </div>

            <!-- Filter by departure times slots -->
            <div class="filter-group">
              <label class="filter-label">Departure Time</label>
              <div class="slots-grid">
                <button 
                  type="button" 
                  class="slot-btn" 
                  [class.active]="hasTimeRange('morning')" 
                  (click)="toggleTimeRange('morning')">
                  <span class="material-icons-outlined slot-icon">wb_sunny</span>
                  <span class="slot-name">Morning</span>
                  <span class="slot-sub">06:00 - 12:00</span>
                </button>
                <button 
                  type="button" 
                  class="slot-btn" 
                  [class.active]="hasTimeRange('afternoon')" 
                  (click)="toggleTimeRange('afternoon')">
                  <span class="material-icons-outlined slot-icon">light_mode</span>
                  <span class="slot-name">Afternoon</span>
                  <span class="slot-sub">12:00 - 18:00</span>
                </button>
                <button 
                  type="button" 
                  class="slot-btn" 
                  [class.active]="hasTimeRange('evening')" 
                  (click)="toggleTimeRange('evening')">
                  <span class="material-icons-outlined slot-icon">nights_stay</span>
                  <span class="slot-name">Evening</span>
                  <span class="slot-sub">18:00 - 24:00</span>
                </button>
                <button 
                  type="button" 
                  class="slot-btn" 
                  [class.active]="hasTimeRange('night')" 
                  (click)="toggleTimeRange('night')">
                  <span class="material-icons-outlined slot-icon">bedtime</span>
                  <span class="slot-name">Night</span>
                  <span class="slot-sub">00:00 - 06:00</span>
                </button>
              </div>
            </div>

            <!-- Filter by driver rating -->
            <div class="filter-group">
              <label class="filter-label">Minimum Driver Rating</label>
              <div class="rating-options">
                <button 
                  type="button" 
                  class="rating-btn" 
                  *ngFor="let rate of [0, 4.0, 4.5]" 
                  [class.active]="tempFilters.minRating === rate" 
                  (click)="tempFilters.minRating = rate">
                  {{ rate === 0 ? 'Any' : rate + ' ★ & above' }}
                </button>
              </div>
            </div>

            <!-- Verified drivers switch -->
            <div class="filter-group flex-switch">
              <div class="switch-meta">
                <span class="switch-title">Verified Drivers Only</span>
                <span class="switch-sub">Show rides offered by license-verified drivers only</span>
              </div>
              <label class="ios-switch">
                <input type="checkbox" [(ngModel)]="tempFilters.verifiedOnly" />
                <span class="slider-switch"></span>
              </label>
            </div>
          </div>

          <footer class="sheet-footer">
            <button class="ripple-btn btn-secondary clear-sheet-btn" (click)="resetFilters()">
              Clear All
            </button>
            <button class="ripple-btn apply-sheet-btn" (click)="applyFilters()">
              Apply Filters
            </button>
          </footer>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .search-page {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 90px;
      min-height: 100vh;
    }

    // Mini search bar
    .mini-search-bar {
      background-color: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: var(--transition-spring);

      &:hover {
        border-color: rgba(10, 132, 255, 0.25);
        box-shadow: var(--shadow-md);
      }
    }

    .mini-search-details {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .search-icon {
      font-size: 24px;
    }

    .search-path {
      display: flex;
      flex-direction: column;
    }

    .path-title {
      font-size: 0.95rem;
      font-weight: 850;
      color: hsl(var(--text-primary));
    }

    .path-meta {
      font-size: 0.75rem;
      color: hsl(var(--text-secondary));
      font-weight: 500;
    }

    .filter-toggle-btn {
      background: none;
      border: none;
      color: hsl(var(--text-secondary));
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 4px;
      span { font-size: 20px; }
    }

    // Edit expandable search
    .search-edit-panel {
      z-index: 99;
      animation: expand 0.3s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
    }

    @keyframes expand {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .edit-inputs {
      display: flex;
      flex-direction: column;
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      background-color: hsl(var(--bg-secondary));
      overflow: hidden;
      margin-bottom: 12px;
    }

    .edit-input-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;

      span {
        font-size: 20px;
        color: hsl(var(--text-tertiary));
      }
    }

    .edit-input-row-autocomplete {
      padding: 8px 14px;
    }

    .edit-divider {
      height: 1px;
      background-color: hsl(var(--border-light));
    }

    .apply-search-btn {
      width: 100%;
      padding: 10px;
      font-size: 0.85rem;
    }

    // Quick action controls
    .quick-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .sort-selector {
      display: flex;
      align-items: center;
      gap: 6px;
      background-color: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
      padding: 8px 12px;
      border-radius: var(--border-radius-sm);
      flex: 1;
      
      .sort-icon {
        font-size: 18px;
        color: hsl(var(--text-secondary));
      }

      select {
        border: none;
        background: none;
        outline: none;
        font-size: 0.82rem;
        font-weight: 700;
        color: hsl(var(--text-primary));
        width: 100%;
        cursor: pointer;
      }
    }

    .filter-pill {
      font-size: 0.82rem;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-radius: var(--border-radius-sm);
      position: relative;
    }

    .active-filters-count {
      background-color: var(--color-primary);
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 800;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      top: -6px;
      right: -4px;
      box-shadow: 0 2px 6px rgba(10, 132, 255, 0.3);
    }

    // Results container
    .results-container {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .rides-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    // Skeleton items
    .skeletons-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-card {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 18px;
    }

    .skeleton-timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-line {
      height: 14px;
      width: 80%;
      border-radius: 4px;
      background-color: hsl(var(--bg-tertiary));
    }

    .skeleton-divider {
      height: 1px;
      background-color: hsl(var(--border-light));
    }

    .skeleton-footer {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .skeleton-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background-color: hsl(var(--bg-tertiary));
    }

    .skeleton-text {
      height: 14px;
      background-color: hsl(var(--bg-tertiary));
      border-radius: 4px;
    }

    .skeleton-price {
      height: 20px;
      background-color: hsl(var(--bg-tertiary));
      border-radius: 4px;
    }

    // Empty state
    .empty-state-card {
      text-align: center;
      padding: 48px 24px;
      background-color: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-md);
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;

      h3 { font-size: 1.2rem; }
      p { font-size: 0.82rem; color: hsl(var(--text-secondary)); max-width: 280px; line-height: 1.45; }
    }

    .empty-logo {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background-color: hsl(var(--bg-secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      
      span {
        font-size: 32px;
        color: hsl(var(--text-tertiary));
      }
    }

    .reset-btn {
      padding: 10px 20px;
      font-size: 0.8rem;
    }

    // Filter Sheet Drawer Overlay
    .filters-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.4);
      z-index: 2000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;

      &.open {
        opacity: 1;
        pointer-events: auto;
        
        .filter-bottom-sheet {
          transform: translateY(0);
        }
      }
    }

    .filter-bottom-sheet {
      width: 100%;
      max-width: 500px;
      background-color: hsl(var(--bg-primary));
      border-top-left-radius: var(--border-radius-md);
      border-top-right-radius: var(--border-radius-md);
      display: flex;
      flex-direction: column;
      max-height: 85vh;
      transform: translateY(100%);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: var(--shadow-lg);
    }

    .sheet-header {
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid hsl(var(--border-light));

      h3 { font-size: 1.1rem; font-weight: 800; }
    }

    .close-sheet-btn {
      background: none;
      border: none;
      color: hsl(var(--text-secondary));
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      
      span { font-size: 22px; }
    }

    .sheet-content {
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .filter-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: hsl(var(--text-primary));
    }

    // Price range slider
    .price-slider {
      width: 100%;
      height: 6px;
      background: hsl(var(--border-light));
      border-radius: 3px;
      outline: none;
      cursor: pointer;
      accent-color: var(--color-primary);
    }

    .price-bounds {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      font-weight: 600;
      color: hsl(var(--text-tertiary));
    }

    // Time ranges grid
    .slots-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .slot-btn {
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      padding: 10px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
      transition: var(--transition-spring);

      .slot-icon {
        font-size: 18px;
        color: hsl(var(--text-secondary));
      }

      .slot-name {
        font-size: 0.82rem;
        font-weight: 750;
        color: hsl(var(--text-primary));
      }

      .slot-sub {
        font-size: 0.65rem;
        color: hsl(var(--text-secondary));
      }

      &.active {
        border-color: var(--color-primary);
        background-color: rgba(10, 132, 255, 0.05);

        .slot-icon { color: var(--color-primary); }
        .slot-name { color: var(--color-primary); }
        .slot-sub { color: var(--color-primary); }
      }
    }

    // Ratings options
    .rating-options {
      display: flex;
      gap: 8px;
    }

    .rating-btn {
      flex: 1;
      background-color: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      padding: 10px 12px;
      border-radius: var(--border-radius-sm);
      font-size: 0.8rem;
      font-weight: 750;
      color: hsl(var(--text-primary));
      cursor: pointer;
      transition: var(--transition-spring);

      &.active {
        background-color: var(--color-primary);
        border-color: var(--color-primary);
        color: #ffffff;
      }
    }

    // Switch flex
    .flex-switch {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .switch-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .switch-title {
      font-size: 0.82rem;
      font-weight: 750;
      color: hsl(var(--text-primary));
    }

    .switch-sub {
      font-size: 0.7rem;
      color: hsl(var(--text-secondary));
    }

    // iOS custom switch style
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

    // Sheet footer
    .sheet-footer {
      padding: 16px 20px;
      border-top: 1px solid hsl(var(--border-light));
      display: flex;
      gap: 12px;
      padding-bottom: 24px;
    }

    .clear-sheet-btn {
      flex: 1;
      padding: 12px;
    }

    .apply-sheet-btn {
      flex: 2;
      padding: 12px;
    }
  `]
})
export class SearchComponent implements OnInit {
  rideStore = inject(RideStore);
  router = inject(Router);

  toggleSearchForm = false;
  openFilterSheet = false;

  // Edit query fields
  editFrom = '';
  editTo = '';
  editDate = '';
  editPassengers = 1;

  // Local temporary filters
  tempFilters: RideFilters = {
    maxPrice: 2500,
    minRating: 0,
    verifiedOnly: false,
    departureTimeRanges: [],
    sortBy: 'price_asc'
  };

  ngOnInit() {
    // Populate form with current query
    const q = this.rideStore.searchQuery();
    if (q) {
      this.editFrom = q.from;
      this.editTo = q.to;
      this.editDate = q.date;
      this.editPassengers = q.passengers || 1;
    }

    // Sync temp filters from store
    const storeFilters = this.rideStore.filters();
    this.tempFilters = {
      ...this.tempFilters,
      ...storeFilters,
      departureTimeRanges: storeFilters.departureTimeRanges ? [...storeFilters.departureTimeRanges] : []
    };
  }

  applyEditSearch() {
    if (!this.editFrom || !this.editTo || !this.editDate) return;
    
    const query: SearchQuery = {
      from: this.editFrom,
      to: this.editTo,
      date: this.editDate,
      passengers: Number(this.editPassengers)
    };

    this.rideStore.setSearchQuery(query);
    this.rideStore.search();
    this.toggleSearchForm = false;
  }

  onSortChange(val: any) {
    this.rideStore.setFilters({ sortBy: val });
    this.tempFilters.sortBy = val;
    this.rideStore.search();
  }

  // Active filters calculation
  getActiveFiltersCount(): number {
    let count = 0;
    const current = this.rideStore.filters();
    if (current.maxPrice && current.maxPrice < 2500) count++;
    if (current.minRating && current.minRating > 0) count++;
    if (current.verifiedOnly) count++;
    if (current.departureTimeRanges && current.departureTimeRanges.length > 0) {
      count += current.departureTimeRanges.length;
    }
    return count;
  }

  // Time ranges management
  hasTimeRange(range: 'morning' | 'afternoon' | 'evening' | 'night'): boolean {
    return this.tempFilters.departureTimeRanges?.includes(range) || false;
  }

  toggleTimeRange(range: 'morning' | 'afternoon' | 'evening' | 'night') {
    if (!this.tempFilters.departureTimeRanges) {
      this.tempFilters.departureTimeRanges = [];
    }

    const idx = this.tempFilters.departureTimeRanges.indexOf(range);
    if (idx !== -1) {
      this.tempFilters.departureTimeRanges.splice(idx, 1);
    } else {
      this.tempFilters.departureTimeRanges.push(range);
    }
  }

  // Clear filters
  resetFilters() {
    this.tempFilters = {
      maxPrice: 2500,
      minRating: 0,
      verifiedOnly: false,
      departureTimeRanges: [],
      sortBy: 'price_asc'
    };
  }

  applyFilters() {
    this.rideStore.setFilters({
      maxPrice: this.tempFilters.maxPrice === 2500 ? undefined : this.tempFilters.maxPrice,
      minRating: this.tempFilters.minRating === 0 ? undefined : this.tempFilters.minRating,
      verifiedOnly: this.tempFilters.verifiedOnly || undefined,
      departureTimeRanges: this.tempFilters.departureTimeRanges?.length === 0 ? undefined : [...this.tempFilters.departureTimeRanges!]
    });
    this.rideStore.search();
    this.openFilterSheet = false;
  }

  resetAllFilters() {
    this.rideStore.resetFilters();
    this.resetFilters();
    this.rideStore.search();
  }
}

import { Injectable, signal, computed, inject } from '@angular/core';
import { Ride, SearchQuery, RideFilters } from '../models/ride.models';
import { RideService } from '../services/ride.service';

@Injectable({
  providedIn: 'root'
})
export class RideStore {
  private rideService = inject(RideService);

  rides = signal<Ride[]>([]);
  offeredRides = signal<Ride[]>([]);
  searchQuery = signal<SearchQuery | null>(null);
  filters = signal<RideFilters>({
    sortBy: 'price_asc'
  });
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  activeRide = signal<Ride | null>(null);

  hasResults = computed(() => this.rides().length > 0);

  setSearchQuery(query: SearchQuery) {
    this.searchQuery.set(query);
  }

  setFilters(newFilters: Partial<RideFilters>) {
    this.filters.update(f => ({ ...f, ...newFilters }));
  }

  resetFilters() {
    this.filters.set({
      sortBy: 'price_asc'
    });
  }

  loadOfferedRides(driverId: string) {
    this.loading.set(true);
    this.error.set(null);
    this.rideService.getDriverRides(driverId).subscribe({
      next: (rides) => {
        this.offeredRides.set(rides);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load offered rides');
        this.loading.set(false);
      }
    });
  }

  search() {
    const query = this.searchQuery();
    if (!query) return;

    this.loading.set(true);
    this.error.set(null);
    this.rideService.searchRides(query, this.filters()).subscribe({
      next: (results) => {
        this.rides.set(results);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to search rides');
        this.loading.set(false);
      }
    });
  }

  loadRideDetails(rideId: string) {
    this.loading.set(true);
    this.error.set(null);
    this.rideService.getRideById(rideId).subscribe({
      next: (ride) => {
        if (ride) this.activeRide.set(ride);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load ride details');
        this.loading.set(false);
      }
    });
  }

  publishRide(rideData: Partial<Ride>, onSuccess: () => void) {
    this.loading.set(true);
    this.error.set(null);
    this.rideService.createRide(rideData).subscribe({
      next: (ride) => {
        this.offeredRides.update(list => [ride, ...list]);
        this.loading.set(false);
        onSuccess();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to publish ride');
        this.loading.set(false);
      }
    });
  }

  cancelOfferedRide(rideId: string) {
    this.loading.set(true);
    this.error.set(null);
    this.rideService.cancelRide(rideId).subscribe({
      next: () => {
        this.offeredRides.update(list => list.filter(r => r.id !== rideId));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to cancel offered ride');
        this.loading.set(false);
      }
    });
  }
}

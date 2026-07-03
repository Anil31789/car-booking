import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Ride, SearchQuery, RideFilters } from '../models/ride.models';

@Injectable({
  providedIn: 'root'
})
export class RideService {
  private http = inject(HttpClient);

  getRides(): Observable<Ride[]> {
    return this.http.get<Ride[]>('/api/rides');
  }

  getRideById(id: string): Observable<Ride | undefined> {
    return this.http.get<Ride | undefined>(`/api/rides/${id}`);
  }

  searchRides(query: SearchQuery, filters: RideFilters): Observable<Ride[]> {
    return this.http.post<Ride[]>('/api/rides/search', { query, filters });
  }

  createRide(rideData: Partial<Ride>): Observable<Ride> {
    return this.http.post<Ride>('/api/rides', rideData);
  }

  getDriverRides(driverId: string): Observable<Ride[]> {
    return this.http.get<Ride[]>(`/api/rides/driver/${driverId}`);
  }

  cancelRide(id: string): Observable<boolean> {
    return this.http.post<boolean>(`/api/rides/${id}/cancel`, {});
  }

  updateRideSeats(id: string, availableSeats: number): Observable<boolean> {
    return this.http.post<boolean>(`/api/rides/${id}/seats`, { availableSeats });
  }
}

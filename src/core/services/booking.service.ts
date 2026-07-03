import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking } from '../models/booking.models';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);

  getUserBookings(passengerId: string): Observable<Booking[]> {
    return this.http.get<Booking[]>(`/api/bookings/user/${passengerId}`);
  }

  bookRide(bookingData: Partial<Booking>): Observable<Booking> {
    return this.http.post<Booking>('/api/bookings', bookingData);
  }

  cancelBooking(id: string): Observable<boolean> {
    return this.http.post<boolean>(`/api/bookings/${id}/cancel`, {});
  }

  getDriverBookings(): Observable<any[]> {
    return this.http.get<any[]>('/api/bookings/driver');
  }

  acceptBooking(id: string): Observable<boolean> {
    return this.http.post<boolean>(`/api/bookings/${id}/accept`, {});
  }

  rejectBooking(id: string): Observable<boolean> {
    return this.http.post<boolean>(`/api/bookings/${id}/reject`, {});
  }

  markBookingAsPaid(id: string): Observable<boolean> {
    return this.http.post<boolean>(`/api/bookings/${id}/mark-paid`, {});
  }
}

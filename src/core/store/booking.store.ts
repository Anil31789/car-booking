import { Injectable, signal, computed, inject } from '@angular/core';
import { Booking } from '../models/booking.models';
import { BookingService } from '../services/booking.service';

@Injectable({
  providedIn: 'root'
})
export class BookingStore {
  private bookingService = inject(BookingService);

  bookings = signal<Booking[]>([]);
  driverBookings = signal<any[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  currentBooking = signal<Booking | null>(null);

  upcomingBookings = computed(() => this.bookings().filter(b => b.status === 'upcoming' || (b.status as string) === 'pending'));
  completedBookings = computed(() => this.bookings().filter(b => b.status === 'completed'));
  cancelledBookings = computed(() => this.bookings().filter(b => b.status === 'cancelled'));

  loadBookings(passengerId: string) {
    this.loading.set(true);
    this.error.set(null);
    this.bookingService.getUserBookings(passengerId).subscribe({
      next: (list) => {
        this.bookings.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load bookings');
        this.loading.set(false);
      }
    });
  }

  createBooking(bookingData: Partial<Booking>, onSuccess: (b: Booking) => void) {
    this.loading.set(true);
    this.error.set(null);
    this.bookingService.bookRide(bookingData).subscribe({
      next: (booking) => {
        this.bookings.update(list => [booking, ...list]);
        this.currentBooking.set(booking);
        this.loading.set(false);
        onSuccess(booking);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to request booking');
        this.loading.set(false);
      }
    });
  }

  cancelBooking(bookingId: string) {
    this.loading.set(true);
    this.error.set(null);
    this.bookingService.cancelBooking(bookingId).subscribe({
      next: () => {
        this.bookings.update(list => 
          list.map(b => b.id === bookingId ? { ...b, status: 'cancelled' as const, paymentStatus: 'Refunded' as const, cancelledBy: 'passenger' } : b)
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to cancel booking');
        this.loading.set(false);
      }
    });
  }

  loadDriverBookings() {
    this.loading.set(true);
    this.error.set(null);
    this.bookingService.getDriverBookings().subscribe({
      next: (list) => {
        this.driverBookings.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load incoming requests');
        this.loading.set(false);
      }
    });
  }

  acceptBookingRequest(bookingId: string, onSuccess?: () => void) {
    this.error.set(null);
    this.bookingService.acceptBooking(bookingId).subscribe({
      next: () => {
        this.driverBookings.update(list =>
          list.map(b => b.id === bookingId ? { ...b, status: 'upcoming' } : b)
        );
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to accept booking request');
      }
    });
  }

  rejectBookingRequest(bookingId: string, onSuccess?: () => void) {
    this.error.set(null);
    this.bookingService.rejectBooking(bookingId).subscribe({
      next: () => {
        this.driverBookings.update(list =>
          list.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b)
        );
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to reject booking request');
      }
    });
  }

  markBookingAsPaid(bookingId: string) {
    this.loading.set(true);
    this.error.set(null);
    this.bookingService.markBookingAsPaid(bookingId).subscribe({
      next: () => {
        this.bookings.update(list =>
          list.map(b => b.id === bookingId ? { ...b, paymentStatus: 'Paid' as const } : b)
        );
        this.driverBookings.update(list =>
          list.map(b => b.id === bookingId ? { ...b, paymentStatus: 'Paid' } : b)
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to mark payment as paid');
        this.loading.set(false);
      }
    });
  }
}

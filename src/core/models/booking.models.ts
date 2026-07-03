import { Ride } from './ride.models';

export interface Booking {
  id: string;
  rideId: string;
  ride?: Ride; // Hydrated ride info
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  seatsBooked: number;
  totalPrice: number;
  status: 'pending' | 'upcoming' | 'completed' | 'cancelled';
  bookingDate: string;
  paymentMethod: 'UPI' | 'Card' | 'Wallet' | 'Cash';
  paymentStatus: 'Paid' | 'Refunded' | 'Pending';
  selectedSeats?: number[]; // list of booked seat indexes
}

export interface BookingSummary {
  seats: number;
  seatPrice: number;
  bookingFee: number;
  totalPrice: number;
}

import { Review } from './user.models';

export interface Stop {
  name: string;
  arrivalTime: string;
}

export interface Vehicle {
  id: string;
  model: string;
  numberPlate: string;
  type: 'Sedan' | 'Hatchback' | 'SUV' | 'EV' | 'Luxury';
  color: string;
}

export interface ConfirmedPassenger {
  name: string;
  photoUrl: string | null;
  seatsBooked: number;
  imageError?: boolean;
}

export interface Ride {
  id: string;
  driverId: string;
  driverName: string;
  driverPhoto: string;
  driverRating: number;
  driverRatingCount?: number;
  driverJoined: string;
  driverTrips: number;
  driverCancellations?: number;
  driverPhone: string;
  isDriverVerified: boolean;
  isLicenseVerified?: boolean;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
  startLocation: string;
  destination: string;
  stops: Stop[];
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  availableSeats: number;
  totalSeats: number;
  pricePerSeat: number;
  vehicle: Vehicle;
  aboutRide?: string;
  imageError?: boolean; // dynamic fallback helper
  occupiedSeats?: number[]; // list of occupied seat indexes
  confirmedPassengers?: ConfirmedPassenger[];
  status?: 'active' | 'cancelled' | 'completed';
  cancellationReason?: string;
  cancellationComment?: string;
  cancelledAt?: string;
  completedAt?: string;
  reviews?: Review[];
}

export interface SearchQuery {
  from: string;
  to: string;
  date: string;
  passengers: number;
}

export interface RideFilters {
  maxPrice?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  departureTimeRanges?: ('morning' | 'afternoon' | 'evening' | 'night')[];
  sortBy: 'price_asc' | 'time_asc' | 'rating_desc';
}

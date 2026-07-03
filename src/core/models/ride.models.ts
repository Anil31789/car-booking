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

export interface Ride {
  id: string;
  driverId: string;
  driverName: string;
  driverPhoto: string;
  driverRating: number;
  driverJoined: string;
  driverTrips: number;
  driverPhone: string;
  isDriverVerified: boolean;
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

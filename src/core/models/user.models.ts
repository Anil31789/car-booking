import { Vehicle } from './ride.models';

export interface Review {
  id: string;
  reviewerName: string;
  reviewerPhoto: string;
  rating: number;
  comment: string;
  createdAt: string;
  imageError?: boolean;
}

export interface DriverDetails {
  rating: number;
  reviewsCount: number;
  licenseNumber: string;
  isLicenseVerified: boolean;
  joinedDate: string;
  tripsCount: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoUrl: string;
  isMobileVerified: boolean;
  isEmailVerified: boolean;
  licensePlaceholder?: string; // Verification code
  createdAt: string;
  driverDetails?: DriverDetails;
  registeredVehicles?: Vehicle[];
}

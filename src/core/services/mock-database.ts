import { User, Review } from '../models/user.models';
import { Ride, Vehicle, Stop } from '../models/ride.models';
import { Booking } from '../models/booking.models';

export class MockDatabase {
  private static STORAGE_KEY = 'carpool_db';

  private static driversList: User[] = [];
  private static ridesList: Ride[] = [];
  private static bookingsList: Booking[] = [];
  private static reviewsMap: { [driverId: string]: Review[] } = {};
  private static currentUser: User | null = null;

  public static initialize(): void {
    if (typeof window === 'undefined') return;

    const storedData = localStorage.getItem(this.STORAGE_KEY);
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        this.driversList = parsed.drivers || [];
        this.ridesList = parsed.rides || [];
        this.bookingsList = parsed.bookings || [];
        this.reviewsMap = parsed.reviews || {};
        this.currentUser = parsed.currentUser || null;
        return;
      } catch (e) {
        console.error('Failed to parse mock database, re-generating...', e);
      }
    }

    this.generateMockData();
    this.save();
  }

  private static save(): void {
    if (typeof window === 'undefined') return;
    const data = {
      drivers: this.driversList,
      rides: this.ridesList,
      bookings: this.bookingsList,
      reviews: this.reviewsMap,
      currentUser: this.currentUser
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // Getters & Setters
  public static getDrivers(): User[] {
    return this.driversList;
  }

  public static getRides(): Ride[] {
    return this.ridesList;
  }

  public static getBookings(): Booking[] {
    return this.bookingsList;
  }

  public static getReviews(driverId: string): Review[] {
    return this.reviewsMap[driverId] || [];
  }

  public static getCurrentUser(): User | null {
    return this.currentUser;
  }

  public static setCurrentUser(user: User | null): void {
    this.currentUser = user;
    this.save();
  }

  // Database Modifiers
  public static addRide(ride: Ride): void {
    this.ridesList.unshift(ride);
    this.save();
  }

  public static updateRide(updatedRide: Ride): void {
    const idx = this.ridesList.findIndex(r => r.id === updatedRide.id);
    if (idx !== -1) {
      this.ridesList[idx] = updatedRide;
      this.save();
    }
  }

  public static addBooking(booking: Booking): void {
    this.bookingsList.unshift(booking);
    // Decrease seats available in the corresponding ride
    const ride = this.ridesList.find(r => r.id === booking.rideId);
    if (ride) {
      ride.availableSeats = Math.max(0, ride.availableSeats - booking.seatsBooked);
      this.updateRide(ride);
    }
    this.save();
  }

  public static cancelBooking(bookingId: string): void {
    const booking = this.bookingsList.find(b => b.id === bookingId);
    if (booking) {
      booking.status = 'cancelled';
      booking.paymentStatus = 'Refunded';
      // Restore seats in ride
      const ride = this.ridesList.find(r => r.id === booking.rideId);
      if (ride) {
        ride.availableSeats = Math.min(ride.totalSeats, ride.availableSeats + booking.seatsBooked);
        this.updateRide(ride);
      }
      this.save();
    }
  }

  public static addReview(driverId: string, review: Review): void {
    if (!this.reviewsMap[driverId]) {
      this.reviewsMap[driverId] = [];
    }
    this.reviewsMap[driverId].unshift(review);

    // Recalculate driver average rating and review count
    const reviews = this.reviewsMap[driverId];
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = Number((totalRating / reviews.length).toFixed(1));

    // Update driver in driversList
    const driver = this.driversList.find(d => d.id === driverId);
    if (driver && driver.driverDetails) {
      driver.driverDetails.rating = avgRating;
      driver.driverDetails.reviewsCount = reviews.length;
    }

    // Update driver rating in ridesList for consistency
    this.ridesList.forEach(ride => {
      if (ride.driverId === driverId) {
        ride.driverRating = avgRating;
      }
    });

    this.save();
  }

  private static generateMockData(): void {
    const indianNames = [
      'Amit Sharma', 'Rahul Verma', 'Priya Patel', 'Siddharth Rao', 'Neha Gupta',
      'Vikram Singh', 'Ananya Nair', 'Rohan Mehta', 'Sneha Reddy', 'Aditya Joshi',
      'Karan Malhotra', 'Deepak Kumar', 'Pooja Choudhary', 'Arjun Saxena', 'Ritu Mishra',
      'Sanjay Dutt', 'Divya Iyer', 'Abhishek Banerjee', 'Shalini Sen', 'Manish Pandey'
    ];

    const carModels = [
      { model: 'Hyundai i20', type: 'Hatchback', color: 'Polar White' },
      { model: 'Maruti Swift', type: 'Hatchback', color: 'Midnight Blue' },
      { model: 'Honda City', type: 'Sedan', color: 'Golden Brown' },
      { model: 'Hyundai Verna', type: 'Sedan', color: 'Phantom Black' },
      { model: 'Tata Nexon', type: 'SUV', color: 'Foliage Green' },
      { model: 'Mahindra XUV700', type: 'SUV', color: 'Everest White' },
      { model: 'Toyota Fortuner', type: 'SUV', color: 'Attitude Black' },
      { model: 'Tata Nexon EV', type: 'EV', color: 'Signature Teal' },
      { model: 'MG ZS EV', type: 'EV', color: 'Aurora Silver' },
      { model: 'BMW 3 Series', type: 'Luxury', color: 'Portimao Blue' }
    ];

    const reviewComments = [
      'Very professional driver. Drove safely throughout the highway.',
      'Extremely clean vehicle! Offered water bottles and had great playlist.',
      'Punctual and helpful with heavy bags. Highly recommended ride.',
      'Good conversationalist. The 3-hour journey Mumbai to Pune felt like 30 minutes!',
      'Smooth driving, respected speed limits. Will definitely book again.',
      'A bit delayed due to traffic near toll plaza, but otherwise a very comfortable ride.',
      'Safe driving. Masked and sanitized car.',
      'Very pleasant journey. Helpful with dynamic stops.',
      'Excellent driving skills, especially in night hours. The SUV was luxurious.',
      'Friendly nature. Very neat and tidy Sedan.'
    ];

    // 1. Generate 20 Drivers
    for (let i = 0; i < 20; i++) {
      const name = indianNames[i];
      const rating = Number((4.0 + Math.random() * 1.0).toFixed(1));
      const reviewsCount = 5 + Math.floor(Math.random() * 15);
      const driverCar = carModels[i % carModels.length];
      
      const driver: User = {
        id: `drv_${i + 1}`,
        name: name,
        email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
        phone: `+91 980000000${i}`,
        photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        isMobileVerified: true,
        isEmailVerified: true,
        licensePlaceholder: `DL-${700000 + i}MH`,
        createdAt: '2024-01-15',
        driverDetails: {
          rating: rating,
          reviewsCount: reviewsCount,
          licenseNumber: `DL-XXXXXX${4000 + i}`,
          isLicenseVerified: i % 4 !== 0, // 75% verified
          joinedDate: `Feb 2024`,
          tripsCount: 20 + Math.floor(Math.random() * 80)
        },
        registeredVehicles: [
          {
            id: `veh_drv_${i + 1}_1`,
            model: driverCar.model,
            numberPlate: `MH-12-${i % 2 === 0 ? 'AB' : 'XY'}-${2000 + i}`,
            type: driverCar.type as any,
            color: driverCar.color
          }
        ]
      };
      this.driversList.push(driver);

      // Generate Reviews for this driver
      const reviews: Review[] = [];
      for (let r = 0; r < reviewsCount; r++) {
        const reviewerIndex = (i + r) % indianNames.length;
        const comment = reviewComments[(i + r) % reviewComments.length];
        const reviewDate = new Date();
        reviewDate.setDate(reviewDate.getDate() - (r * 3 + 1));
        
        reviews.push({
          id: `rev_${driver.id}_${r + 1}`,
          reviewerName: indianNames[reviewerIndex],
          reviewerPhoto: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(indianNames[reviewerIndex])}`,
          rating: Math.floor(4 + Math.random() * 2), // 4 or 5 stars mostly
          comment: comment,
          createdAt: reviewDate.toISOString().split('T')[0]
        });
      }
      this.reviewsMap[driver.id] = reviews;
    }

    // 2. Generate 50 Rides
    const routesConfig = [
      { from: 'Mumbai', to: 'Pune', duration: 3, distance: 150, basePrice: 350, stops: ['Navi Mumbai', 'Lonavala'] },
      { from: 'Nagpur', to: 'Pune', duration: 13, distance: 710, basePrice: 1100, stops: ['Amravati', 'Jalna', 'Ahmednagar'] },
      { from: 'Nagpur', to: 'Mumbai', duration: 14, distance: 800, basePrice: 1300, stops: ['Amravati', 'Aurangabad', 'Nashik'] },
      { from: 'Hyderabad', to: 'Bangalore', duration: 10, distance: 570, basePrice: 950, stops: ['Kurnool', 'Anantapur'] },
      { from: 'Mumbai', to: 'Nashik', duration: 4, distance: 170, basePrice: 400, stops: ['Thane', 'Kalyan'] },
      { from: 'Pune', to: 'Mumbai', duration: 3, distance: 150, basePrice: 350, stops: ['Lonavala', 'Navi Mumbai'] },
      { from: 'Pune', to: 'Nagpur', duration: 13, distance: 710, basePrice: 1100, stops: ['Ahmednagar', 'Jalna', 'Amravati'] }
    ];

    const today = new Date();
    
    for (let i = 0; i < 50; i++) {
      const route = routesConfig[i % routesConfig.length];
      const driver = this.driversList[i % this.driversList.length];
      const vehicleRef = carModels[i % carModels.length];
      
      const vehicle: Vehicle = {
        id: `veh_${i + 1}`,
        model: vehicleRef.model,
        numberPlate: `MH-12-AB-${2000 + i}`,
        type: vehicleRef.type as any,
        color: vehicleRef.color
      };

      const departure = new Date(today);
      // Spread rides from today to 6 days in future, plus a few past rides for history
      const dayOffset = (i % 8) - 1; // -1 to 6 days
      departure.setDate(today.getDate() + dayOffset);
      
      const hour = 6 + (i * 3) % 16; // 6:00 to 22:00
      const minutes = (i % 2 === 0) ? '00' : '30';
      const depTimeStr = `${hour < 10 ? '0' + hour : hour}:${minutes}`;
      
      const arrHour = (hour + route.duration) % 24;
      const arrTimeStr = `${arrHour < 10 ? '0' + arrHour : arrHour}:${minutes}`;
      
      const totalSeats = vehicle.type === 'SUV' || vehicle.type === 'Luxury' ? 6 : 4;
      const availableSeats = 1 + Math.floor(Math.random() * (totalSeats - 1));

      // Build Stops
      const stops: Stop[] = route.stops.map((stopName, idx) => {
        const stopHour = (hour + Math.floor((idx + 1) * (route.duration / (route.stops.length + 1)))) % 24;
        return {
          name: stopName,
          arrivalTime: `${stopHour < 10 ? '0' + stopHour : stopHour}:${minutes}`
        };
      });

      this.ridesList.push({
        id: `ride_${i + 1}`,
        driverId: driver.id,
        driverName: driver.name,
        driverPhoto: driver.photoUrl,
        driverRating: driver.driverDetails?.rating || 5.0,
        driverJoined: driver.driverDetails?.joinedDate || 'Today',
        driverTrips: driver.driverDetails?.tripsCount || 0,
        driverPhone: driver.phone,
        isDriverVerified: driver.driverDetails?.isLicenseVerified || false,
        startLocation: route.from,
        destination: route.to,
        stops: stops,
        departureDate: departure.toISOString().split('T')[0],
        departureTime: depTimeStr,
        arrivalTime: arrTimeStr,
        availableSeats: availableSeats,
        totalSeats: totalSeats,
        pricePerSeat: Math.round(route.basePrice * (0.9 + Math.random() * 0.2)),
        vehicle: vehicle,
        aboutRide: `Hey! I am driving down to ${route.to} for business purposes. Safe driving is my priority. Luggage space is available in the boot. Please book your seats in advance!`
      });
    }

    // 3. Setup Default Logged In User
    this.currentUser = {
      id: 'usr_me',
      name: 'Rohan Deshmukh',
      email: 'rohan.deshmukh@gmail.com',
      phone: '+91 9988776655',
      photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan',
      isMobileVerified: true,
      isEmailVerified: true,
      licensePlaceholder: 'DL-812398MH',
      createdAt: '2025-01-01',
      registeredVehicles: [
        {
          id: 'veh_me_1',
          model: 'Honda City',
          numberPlate: 'MH-12-HC-1029',
          type: 'Sedan',
          color: 'Golden Brown'
        },
        {
          id: 'veh_me_2',
          model: 'Tata Nexon',
          numberPlate: 'MH-12-TN-4890',
          type: 'SUV',
          color: 'Foliage Green'
        }
      ]
    };

    // 4. Create some initial bookings for current user
    // A completed ride (yesterday)
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const pastRide = this.ridesList.find(r => r.departureDate === yesterday.toISOString().split('T')[0]);
    if (pastRide) {
      this.bookingsList.push({
        id: 'bk_1',
        rideId: pastRide.id,
        ride: pastRide,
        passengerId: this.currentUser.id,
        passengerName: this.currentUser.name,
        passengerPhone: this.currentUser.phone,
        seatsBooked: 2,
        totalPrice: pastRide.pricePerSeat * 2,
        status: 'completed',
        bookingDate: yesterday.toISOString().split('T')[0],
        paymentMethod: 'UPI',
        paymentStatus: 'Paid'
      });
    }

    // An upcoming ride (tomorrow)
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const upcomingRide = this.ridesList.find(r => r.departureDate === tomorrow.toISOString().split('T')[0]);
    if (upcomingRide) {
      this.bookingsList.push({
        id: 'bk_2',
        rideId: upcomingRide.id,
        ride: upcomingRide,
        passengerId: this.currentUser.id,
        passengerName: this.currentUser.name,
        passengerPhone: this.currentUser.phone,
        seatsBooked: 1,
        totalPrice: upcomingRide.pricePerSeat,
        status: 'upcoming',
        bookingDate: today.toISOString().split('T')[0],
        paymentMethod: 'Wallet',
        paymentStatus: 'Paid'
      });
    }
  }
}

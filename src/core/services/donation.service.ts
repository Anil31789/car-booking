import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

export interface DonationOrder {
  orderId: string;
  amount: number;
  currency: string;
  key: string;
}

@Injectable({
  providedIn: 'root'
})
export class DonationService {
  constructor() {}

  /**
   * Stub to simulate Razorpay Order creation on the backend.
   * Ready for future HTTP integration.
   */
  createDonationOrder(amount: number): Observable<DonationOrder> {
    const mockOrder: DonationOrder = {
      orderId: `order_don_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      amount: amount * 100, // Razorpay works in paise
      currency: 'INR',
      key: 'rzp_test_placeholder_key_2026' // Future Razorpay Key ID
    };
    
    // Simulate API delay
    return of(mockOrder).pipe(delay(600));
  }

  /**
   * Stub to verify Razorpay signature on the backend.
   * Ready for future payment verification.
   */
  verifyDonationPayment(
    razorpayPaymentId: string,
    razorpayOrderId: string,
    razorpaySignature: string
  ): Observable<{ success: boolean; message: string }> {
    const mockResponse = {
      success: true,
      message: 'Donation verification successful! Thank you for supporting HighwayPool.'
    };
    
    return of(mockResponse).pipe(delay(500));
  }
}

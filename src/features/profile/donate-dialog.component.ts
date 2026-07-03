import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DonationService } from '../../core/services/donation.service';

@Component({
  selector: 'app-donate-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="donate-dialog-container glass-panel">
      <!-- Header -->
      <header class="dialog-header">
        <h3>Support HighwayPool</h3>
        <button class="close-btn" (click)="close()">
          <span class="material-icons-outlined">close</span>
        </button>
      </header>

      <!-- Content -->
      <div class="dialog-content">
        <!-- Text intro -->
        <p class="donate-intro">HighwayPool is operated as a free community service. If you like our platform and want to help cover server and hosting costs, please consider supporting us!</p>

        <!-- Voluntary Disclaimer Box -->
        <div class="disclaimer-box">
          <span class="material-icons-outlined disclaimer-icon">info</span>
          <p><strong>Voluntary Support Policy:</strong> Donations are entirely voluntary and do not grant premium features, booking priority, or special privileges within the app.</p>
        </div>

        <div class="payment-step-container" *ngIf="!showQR">
          <!-- Suggested amounts -->
          <label class="group-label">Select Support Amount</label>
          <div class="suggested-amounts">
            <button 
              type="button" 
              class="amt-btn" 
              [class.active]="selectedAmount === 51" 
              (click)="selectAmount(51)">
              ₹51
            </button>
            <button 
              type="button" 
              class="amt-btn" 
              [class.active]="selectedAmount === 101" 
              (click)="selectAmount(101)">
              ₹101
            </button>
            <button 
              type="button" 
              class="amt-btn" 
              [class.active]="selectedAmount === 501" 
              (click)="selectAmount(501)">
              ₹501
            </button>
          </div>

          <!-- Custom amount input -->
          <div class="custom-input-group">
            <label>Or Enter Custom Amount (₹)</label>
            <div class="input-wrapper">
              <span class="currency-prefix">₹</span>
              <input 
                type="number" 
                placeholder="Other Amount" 
                [(ngModel)]="customAmount" 
                (ngModelChange)="onCustomAmountChange()"
                min="10"
                max="50000"
                class="search-input" />
            </div>
            <span class="error-text" *ngIf="customAmount !== null && customAmount < 10">Minimum donation is ₹10.</span>
          </div>

          <!-- Proceed Button -->
          <button 
            class="ripple-btn proceed-btn" 
            [disabled]="getFinalAmount() < 10 || loading"
            (click)="proceedToDonate()">
            <span class="spinner" *ngIf="loading"></span>
            {{ loading ? 'Initializing payment...' : 'Proceed to Support (₹' + getFinalAmount() + ')' }}
          </button>
        </div>

        <!-- UPI details & QR Step (MVP direct UPI checkouts) -->
        <div class="upi-step-container slide-in" *ngIf="showQR">
          <div class="qr-card">
            <!-- Mock UPI QR code using a premium graphic placeholder -->
            <div class="mock-qr-code">
              <span class="material-icons-outlined qr-placeholder-icon">qr_code_2</span>
              <span class="qr-text">Scan with any UPI App</span>
            </div>
            
            <div class="upi-details">
              <span class="upi-id-lbl">Official UPI ID</span>
              <div class="upi-id-row">
                <code class="upi-id-text">donate&#64;highwaypool</code>
                <button class="copy-btn" (click)="copyUPI()" [title]="copied ? 'Copied!' : 'Copy ID'">
                  <span class="material-icons-outlined">{{ copied ? 'check' : 'content_copy' }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="payment-instructions">
            <h5>How to Complete:</h5>
            <ol>
              <li>Scan the QR code above or copy our UPI ID.</li>
              <li>Open your preferred UPI app (BHIM, GPay, PhonePe, Paytm).</li>
              <li>Complete the payment of <strong>₹{{ getFinalAmount() }}</strong> directly.</li>
            </ol>
          </div>

          <div class="step-actions">
            <button class="ripple-btn back-btn-step" (click)="showQR = false">Go Back</button>
            <button class="ripple-btn confirm-btn-step" (click)="completeDonation()">I've Paid</button>
          </div>
        </div>

        <!-- Thank you card -->
        <div class="thank-you-card slide-in" *ngIf="donationComplete">
          <span class="material-icons-outlined heart-icon animate-beat">favorite</span>
          <h4>Thank You for Your Support!</h4>
          <p>Your contribution of <strong>₹{{ getFinalAmount() }}</strong> directly helps keep our carpool servers alive and free for everyone.</p>
          <button class="ripple-btn close-btn-bottom" (click)="close()">Done</button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .donate-dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      max-width: 480px;
      margin: 0 auto;
      overflow: hidden;
      border-radius: var(--border-radius-lg);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      box-shadow: var(--shadow-lg);
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid hsl(var(--border-light));
      
      h3 {
        margin: 0;
        font-size: 1.25rem;
      }
      
      .close-btn {
        background: none;
        border: none;
        color: hsl(var(--text-secondary));
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        border-radius: 50%;
        transition: var(--transition-smooth);
        
        &:hover {
          background: hsl(var(--bg-tertiary));
          color: hsl(var(--text-primary));
        }
      }
    }

    .dialog-content {
      padding: 20px;
      overflow-y: auto;
      flex: 1;

      .donate-intro {
        font-size: 0.88rem;
        color: hsl(var(--text-secondary));
        margin-bottom: 14px;
        line-height: 1.4;
      }
    }

    .disclaimer-box {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      background: rgba(10, 132, 255, 0.06);
      border: 1px solid rgba(10, 132, 255, 0.15);
      border-radius: var(--border-radius-sm);
      margin-bottom: 18px;
      font-size: 0.8rem;
      line-height: 1.45;
      color: hsl(var(--text-secondary));

      .disclaimer-icon {
        color: var(--color-primary);
        font-size: 1.15rem;
        flex-shrink: 0;
      }

      p {
        margin: 0;
      }
    }

    .group-label {
      font-size: 0.76rem;
      font-weight: 600;
      color: hsl(var(--text-tertiary));
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: block;
    }

    .suggested-amounts {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;

      .amt-btn {
        flex: 1;
        padding: 10px;
        border: 1px solid hsl(var(--border-medium));
        background: hsl(var(--bg-primary));
        color: hsl(var(--text-primary));
        font-weight: 700;
        font-size: 0.95rem;
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        transition: var(--transition-smooth);

        &:hover {
          border-color: var(--color-primary);
          background: rgba(10, 132, 255, 0.04);
        }

        &.active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
          box-shadow: 0 4px 12px rgba(10, 132, 255, 0.25);
        }
      }
    }

    .custom-input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 20px;

      label {
        font-size: 0.78rem;
        font-weight: 600;
        color: hsl(var(--text-secondary));
      }

      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;

        .currency-prefix {
          position: absolute;
          left: 14px;
          color: hsl(var(--text-primary));
          font-weight: 600;
          font-size: 1rem;
        }

        .search-input {
          width: 100%;
          padding: 12px 12px 12px 30px;
          border-radius: var(--border-radius-sm);
          border: 1px solid hsl(var(--border-medium));
          background: hsl(var(--bg-primary));
          color: hsl(var(--text-primary));
          font-size: 0.92rem;
          font-weight: 600;
          outline: none;
          transition: var(--transition-smooth);

          &:focus {
            border-color: var(--color-primary);
            box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.12);
          }
        }
      }

      .error-text {
        font-size: 0.75rem;
        color: var(--color-danger);
        font-weight: 500;
      }
    }

    .proceed-btn {
      width: 100%;
      padding: 12px;
      border: none;
      background: var(--color-primary);
      color: white;
      font-size: 0.92rem;
      font-weight: 600;
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: var(--transition-smooth);

      &:hover:not([disabled]) {
        background: #0070dd;
        box-shadow: 0 4px 12px rgba(10, 132, 255, 0.2);
      }

      &[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .upi-step-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: center;
    }

    .qr-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: hsl(var(--bg-secondary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-md);
      padding: 20px;
      width: 100%;
      max-width: 320px;
      box-shadow: var(--shadow-sm);

      .mock-qr-code {
        width: 160px;
        height: 160px;
        border-radius: var(--border-radius-sm);
        border: 2px solid hsl(var(--border-medium));
        background: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
        color: #14171a;

        .qr-placeholder-icon {
          font-size: 6.5rem;
          color: #333;
        }

        .qr-text {
          font-size: 0.65rem;
          font-weight: 700;
          color: #666;
          margin-top: -6px;
        }
      }

      .upi-details {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        width: 100%;

        .upi-id-lbl {
          font-size: 0.68rem;
          color: hsl(var(--text-tertiary));
          font-weight: 500;
          text-transform: uppercase;
        }

        .upi-id-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: hsl(var(--bg-tertiary));
          border-radius: var(--border-radius-sm);
          width: 100%;
          justify-content: center;

          .upi-id-text {
            font-size: 0.88rem;
            font-weight: 700;
            color: hsl(var(--text-primary));
          }

          .copy-btn {
            background: none;
            border: none;
            color: var(--color-primary);
            cursor: pointer;
            padding: 2px;
            display: flex;
            align-items: center;
            
            span { font-size: 1.1rem; }
          }
        }
      }
    }

    .payment-instructions {
      width: 100%;
      background: rgba(10, 132, 255, 0.04);
      border-radius: var(--border-radius-sm);
      padding: 12px;
      font-size: 0.82rem;

      h5 {
        font-size: 0.85rem;
        margin: 0 0 6px 0;
        color: hsl(var(--text-primary));
      }

      ol {
        padding-left: 18px;
        color: hsl(var(--text-secondary));
        
        li {
          margin-bottom: 4px;
        }
      }
    }

    .step-actions {
      display: flex;
      gap: 12px;
      width: 100%;

      .back-btn-step {
        flex: 1;
        padding: 10px;
        border: 1px solid hsl(var(--border-medium));
        background: transparent;
        color: hsl(var(--text-secondary));
        font-weight: 600;
        border-radius: var(--border-radius-sm);
        cursor: pointer;
      }

      .confirm-btn-step {
        flex: 2;
        padding: 10px;
        border: none;
        background: var(--color-secondary);
        color: white;
        font-weight: 600;
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(52, 199, 89, 0.2);
        
        &:hover {
          background: #2cb04e;
        }
      }
    }

    .thank-you-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 24px 16px;

      .heart-icon {
        font-size: 4rem;
        color: var(--color-danger);
        margin-bottom: 12px;
      }

      h4 {
        font-size: 1.15rem;
        margin-bottom: 8px;
      }

      p {
        font-size: 0.88rem;
        color: hsl(var(--text-secondary));
        margin-bottom: 24px;
        line-height: 1.45;
      }

      .close-btn-bottom {
        padding: 8px 30px;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: var(--border-radius-sm);
        font-weight: 600;
        cursor: pointer;
        font-size: 0.88rem;
        transition: var(--transition-smooth);

        &:hover {
          background: #0070dd;
        }
      }
    }
  `]
})
export class DonateDialogComponent {
  private donationService = inject(DonationService);
  private dialogRef = inject(MatDialogRef<DonateDialogComponent>);

  selectedAmount = 101;
  customAmount: number | null = null;
  loading = false;
  showQR = false;
  copied = false;
  donationComplete = false;

  selectAmount(amount: number) {
    this.selectedAmount = amount;
    this.customAmount = null;
  }

  onCustomAmountChange() {
    this.selectedAmount = 0;
  }

  getFinalAmount(): number {
    return this.selectedAmount > 0 ? this.selectedAmount : (this.customAmount || 0);
  }

  proceedToDonate() {
    const amount = this.getFinalAmount();
    if (amount < 10) return;

    this.loading = true;
    
    // Simulate Razorpay ready initiation service call
    this.donationService.createDonationOrder(amount).subscribe({
      next: (order) => {
        this.loading = false;
        // Direct UPI payment layout for MVP checkout
        this.showQR = true;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  copyUPI() {
    navigator.clipboard.writeText('donate@highwaypool').then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    });
  }

  completeDonation() {
    // Verify signature or just mock payment completion for MVP
    this.showQR = false;
    this.donationComplete = true;
  }

  close() {
    this.dialogRef.close();
  }
}

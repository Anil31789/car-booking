import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export type LegalType = 'about' | 'terms' | 'privacy' | 'guidelines';

@Component({
  selector: 'app-legal-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="legal-dialog-container glass-panel">
      <!-- Header -->
      <header class="dialog-header">
        <h3>{{ getTitle() }}</h3>
        <button class="close-btn" (click)="close()">
          <span class="material-icons-outlined">close</span>
        </button>
      </header>

      <!-- Scrollable Content -->
      <div class="dialog-content">
        <!-- ABOUT HIGHWAYPOOL -->
        <div *ngIf="data.type === 'about'" class="copy-section">
          <div class="mission-banner">
            <span class="material-icons-outlined banner-icon">eco</span>
            <h4>Our Mission</h4>
            <p>Reducing travel costs, saving fuel, and protecting our environment through friendly, city-to-city carpooling.</p>
          </div>
          
          <p><strong>HighwayPool</strong> is a community-driven platform designed to connect long-distance travellers. By facilitating ride sharing across highways, we make inter-city travel accessible, social, and eco-friendly.</p>
          
          <h5>Why Carpool with Us?</h5>
          <ul>
            <li><strong>Reduce Costs:</strong> Split highway tolls and fuel expenses directly with fellow travellers.</li>
            <li><strong>Save Fuel:</strong> Fewer single-occupant cars on the highway means less congestion and a significant reduction in collective carbon emissions.</li>
            <li><strong>Build Community:</strong> Share conversations, stories, and journeys with verified members of the HighwayPool network.</li>
          </ul>
        </div>

        <!-- TERMS & CONDITIONS -->
        <div *ngIf="data.type === 'terms'" class="copy-section">
          <p class="last-updated">Last Updated: July 2026</p>
          
          <div class="alert-box warning">
            <span class="material-icons-outlined alert-icon">info</span>
            <p><strong>Important Platform Notice:</strong> HighwayPool is strictly a technology platform connecting drivers and passengers. We are not a transport operator, common carrier, or travel agency.</p>
          </div>

          <h5>1. Nature of the Service</h5>
          <p>HighwayPool provides a digital marketplace for peer-to-peer ride matching. Drivers list planned trips, and passengers request seats. Drivers are independent platform users acting in their personal capacity and are not employees, contractors, partners, or agents of HighwayPool.</p>

          <h5>2. Direct Passenger-to-Driver Payments</h5>
          <p>HighwayPool does not process or collect fares. All payments are settled directly between the passenger and the driver at the end of the trip via Cash or UPI. HighwayPool is not a party to any financial transaction and is not responsible for payment disputes, refunds, or transaction failures.</p>

          <h5>3. User Responsibilities & Verification</h5>
          <p>Users are solely responsible for their own safety. Before boarding a vehicle, passengers must verify the driver’s identity, license status, and vehicle number plate. Drivers must similarly verify passenger details. HighwayPool is not liable for inaccuracies in user profiles, vehicle descriptions, or license listings.</p>

          <h5>4. Strict Liability Exemptions</h5>
          <p>HighwayPool is not responsible or liable for any loss, damage, injury, delay, or dispute arising out of a ride-sharing arrangement. This includes, but is not limited to: vehicle accidents, mechanical breakdown, personal disputes, lost or stolen luggage, boarding delays, or route changes.</p>

          <h5>5. Compliance with Laws & Safety</h5>
          <p>All users must comply with local transportation regulations, speed limits, and safety standards. Drivers must maintain a valid license and active vehicle insurance.</p>

          <h5>6. Prohibited Items & Conduct</h5>
          <p>The transport of illegal goods, prohibited substances, weapons, hazardous materials, or contraband of any kind is strictly forbidden. Violation of this terms will result in immediate and permanent account suspension and referral to law enforcement authorities.</p>
        </div>

        <!-- PRIVACY POLICY -->
        <div *ngIf="data.type === 'privacy'" class="copy-section">
          <p class="last-updated">Last Updated: July 2026</p>

          <h5>1. Data Collection</h5>
          <p>We collect essential information to verify identity and maintain safety within the network. This includes: name, email address, mobile number, profile photo, driver's license details (for drivers), vehicle license plates, trip details, and booking logs.</p>

          <h5>2. Security & Storage</h5>
          <p>Your personal data is encrypted and securely stored in our cloud databases. Access is restricted using secure JSON Web Tokens (JWT) and industry-standard security practices. We never sell your data to third-party marketing companies.</p>

          <h5>3. Data Retention</h5>
          <p>We retain your profile data, ride listings, and booking history only as long as your account is active. Transaction logs and safety-critical documentation (e.g. driver licenses) may be retained for longer periods to meet legal, security, audit, and regulatory compliance obligations.</p>

          <h5>4. Account Deletion & Rights</h5>
          <p>You have full control over your personal data. You can edit your profile information at any time. To completely delete your account and erase your personal history:
          <ul>
            <li>You may request complete account deletion through your profile settings or by contacting Support.</li>
            <li>Upon deletion, your profile records, driver's credentials, vehicle details, and listings are permanently removed from our active databases within 14 days, subject to regulatory safety retention requirements.</li>
          </ul>
        </div>

        <!-- COMMUNITY GUIDELINES -->
        <div *ngIf="data.type === 'guidelines'" class="copy-section">
          <h5>1. Respect for All Members</h5>
          <p>We enforce a zero-tolerance policy against harassment, abusive language, or discrimination based on race, gender, religion, age, or background. Treat everyone with respect and kindness.</p>

          <h5>2. Commitment & Punctuality</h5>
          <p>Be on time! Committing to a ride is a promise to the group. Passengers should arrive at the boarding spot 10 minutes early. Drivers must not leave passengers waiting without direct communication.</p>

          <h5>3. Zero Fake Bookings</h5>
          <p>Only book a seat if you genuinely intend to travel. Fake bookings block available capacity for other travellers. Repeated cancellations or no-shows will lead to restriction or ban of your account.</p>

          <h5>4. Safe Highway Driving</h5>
          <p>Drivers must drive responsibly, follow speed limits, avoid mobile phone usage while driving, and obey all national highway traffic rules. Passengers have the right to request a safe speed at any time.</p>

          <h5>5. Professional Conduct</h5>
          <p>Maintain clean, polite conversations. Ensure the vehicle is clean, well-ventilated, and comfortable for all travellers. Discuss details like music volume, AC preferences, and stops beforehand.</p>
        </div>
      </div>

      <!-- Footer Buttons -->
      <footer class="dialog-footer">
        <button class="ripple-btn close-btn-bottom" (click)="close()">Got it</button>
      </footer>
    </div>
  `,
  styles: [`
    .legal-dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 85vh;
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
      font-size: 0.9rem;
      line-height: 1.5;
      color: hsl(var(--text-secondary));
      flex: 1;

      h4 {
        font-size: 1rem;
        margin-bottom: 8px;
        color: hsl(var(--text-primary));
      }

      h5 {
        font-size: 0.92rem;
        margin: 16px 0 6px 0;
        color: hsl(var(--text-primary));
      }

      p {
        margin-bottom: 12px;
      }

      ul, ol {
        margin-bottom: 12px;
        padding-left: 20px;
        
        li {
          margin-bottom: 6px;
        }
      }

      .last-updated {
        font-size: 0.76rem;
        color: hsl(var(--text-tertiary));
        margin-bottom: 16px;
      }
    }

    .mission-banner {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 16px;
      background: rgba(10, 132, 255, 0.06);
      border: 1px dashed rgba(10, 132, 255, 0.2);
      border-radius: var(--border-radius-sm);
      margin-bottom: 16px;

      .banner-icon {
        font-size: 2.2rem;
        color: var(--color-primary);
        margin-bottom: 8px;
      }

      h4 {
        margin: 0 0 6px 0;
        color: var(--color-primary);
      }

      p {
        margin: 0;
        font-size: 0.85rem;
        color: hsl(var(--text-secondary));
      }
    }

    .alert-box {
      display: flex;
      gap: 12px;
      padding: 12px;
      border-radius: var(--border-radius-sm);
      margin-bottom: 16px;
      font-size: 0.82rem;
      line-height: 1.4;

      .alert-icon {
        font-size: 1.25rem;
        flex-shrink: 0;
      }

      p {
        margin: 0;
      }

      &.warning {
        background: rgba(255, 69, 58, 0.06);
        border: 1px solid rgba(255, 69, 58, 0.15);
        color: hsl(var(--text-primary));
        
        .alert-icon {
          color: var(--color-danger);
        }
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      padding: 12px 20px;
      border-top: 1px solid hsl(var(--border-light));
      background: hsl(var(--bg-secondary));

      .close-btn-bottom {
        padding: 8px 18px;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: var(--border-radius-sm);
        font-weight: 600;
        cursor: pointer;
        font-size: 0.85rem;
        transition: var(--transition-smooth);

        &:hover {
          background: #0070dd;
          box-shadow: 0 4px 12px rgba(10, 132, 255, 0.2);
        }
      }
    }
  `]
})
export class LegalDialogComponent {
  readonly data = inject<{ type: LegalType }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<LegalDialogComponent>);

  getTitle(): string {
    switch (this.data.type) {
      case 'about': return 'About HighwayPool';
      case 'terms': return 'Terms & Conditions';
      case 'privacy': return 'Privacy Policy';
      case 'guidelines': return 'Community Guidelines';
      default: return 'Information';
    }
  }

  close() {
    this.dialogRef.close();
  }
}

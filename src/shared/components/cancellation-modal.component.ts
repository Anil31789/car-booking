import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-cancellation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cancellation-modal-backdrop fade-in" *ngIf="isOpen" (click)="onClose()">
      <div class="cancellation-modal-sheet slide-up glass-panel" (click)="$event.stopPropagation()">
        
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="material-icons-outlined warning-icon">warning_amber</span>
            <h4>{{ title }}</h4>
          </div>
          <button type="button" class="close-modal-btn" (click)="onClose()" title="Close">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>

        <p class="modal-subtitle">{{ subtitle }}</p>

        <!-- Predefined Reason Options -->
        <div class="reasons-list">
          <label 
            *ngFor="let opt of options"
            class="reason-option-card"
            [class.selected]="selectedReason === opt">
            <input 
              type="radio" 
              name="cancelReason" 
              [value]="opt" 
              [(ngModel)]="selectedReason" 
              class="radio-input" />
            <span class="custom-radio">
              <span class="radio-dot" *ngIf="selectedReason === opt"></span>
            </span>
            <span class="reason-text">{{ opt }}</span>
          </label>
        </div>

        <!-- Optional Additional Comment -->
        <div class="comment-group">
          <label class="comment-label">Additional comment (optional)</label>
          <textarea
            [(ngModel)]="additionalComment"
            placeholder="Add any helpful details about why you need to cancel..."
            rows="3"
            class="comment-textarea"></textarea>
        </div>

        <!-- Modal Actions -->
        <div class="modal-actions">
          <button 
            type="button" 
            class="ripple-btn btn-secondary cancel-back-btn" 
            [disabled]="loading"
            (click)="onClose()">
            Keep {{ role === 'driver' ? 'Ride' : 'Booking' }}
          </button>
          
          <button 
            type="button" 
            class="ripple-btn confirm-cancel-btn" 
            [disabled]="!selectedReason || loading"
            (click)="onConfirm()">
            <span class="spinner-small" *ngIf="loading"></span>
            <span>{{ loading ? 'Cancelling...' : 'Confirm Cancellation' }}</span>
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .cancellation-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 2500;
      display: flex;
      justify-content: center;
      align-items: flex-end; /* Bottom sheet on mobile */

      @media (min-width: 501px) {
        align-items: center; /* Centered modal on desktop */
      }
    }

    .cancellation-modal-sheet {
      width: 100%;
      max-width: 480px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background-color: hsl(var(--bg-secondary));
      border: 1px solid var(--glass-border);
      box-shadow: var(--shadow-lg);

      /* Responsive bottom sheet radius */
      border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;

      @media (min-width: 501px) {
        border-radius: var(--border-radius-lg);
        margin: 20px;
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title-group {
      display: flex;
      align-items: center;
      gap: 10px;

      h4 {
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: -0.3px;
        margin: 0;
        color: hsl(var(--text-primary));
      }

      .warning-icon {
        font-size: 24px;
        color: var(--color-danger, #ff453a);
      }
    }

    .close-modal-btn {
      background: none;
      border: none;
      color: hsl(var(--text-tertiary));
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 4px;
      border-radius: 50%;
      transition: var(--transition-smooth);

      &:hover {
        color: hsl(var(--text-primary));
        background-color: hsl(var(--bg-tertiary));
      }
    }

    .modal-subtitle {
      font-size: 0.85rem;
      color: hsl(var(--text-secondary));
      margin: 0;
      line-height: 1.4;
    }

    .reasons-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .reason-option-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      background-color: hsl(var(--bg-primary));
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      transition: var(--transition-smooth);
      user-select: none;

      &:hover {
        border-color: hsl(var(--border-hover));
        background-color: hsl(var(--bg-tertiary));
      }

      &.selected {
        border-color: var(--color-primary);
        background-color: rgba(var(--color-primary-rgb), 0.08);
      }

      .radio-input {
        display: none;
      }

      .custom-radio {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid hsl(var(--border-light));
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: var(--transition-smooth);
      }

      &.selected .custom-radio {
        border-color: var(--color-primary);
      }

      .radio-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--color-primary);
      }

      .reason-text {
        font-size: 0.88rem;
        font-weight: 600;
        color: hsl(var(--text-primary));
      }
    }

    .comment-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .comment-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: hsl(var(--text-secondary));
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .comment-textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid hsl(var(--border-light));
      background-color: hsl(var(--bg-primary));
      color: hsl(var(--text-primary));
      border-radius: var(--border-radius-sm);
      padding: 10px 12px;
      font-family: inherit;
      font-size: 0.85rem;
      line-height: 1.4;
      resize: vertical;
      outline: none;
      transition: var(--transition-smooth);

      &:focus {
        border-color: var(--color-primary);
      }

      &::placeholder {
        color: hsl(var(--text-tertiary));
      }
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 4px;
    }

    .cancel-back-btn {
      padding: 10px 18px;
      font-size: 0.84rem;
      background-color: transparent;
      border: 1px solid hsl(var(--border-light));
      color: hsl(var(--text-secondary));

      &:hover:not(:disabled) {
        background-color: hsl(var(--bg-tertiary));
        color: hsl(var(--text-primary));
      }
    }

    .confirm-cancel-btn {
      padding: 10px 20px;
      font-size: 0.84rem;
      font-weight: 750;
      background-color: var(--color-danger, #ff453a);
      color: #ffffff;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;

      &:hover:not(:disabled) {
        background-color: #e0382e;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `]
})
export class CancellationModalComponent {
  @Input() isOpen = false;
  @Input() role: 'driver' | 'passenger' = 'passenger';
  @Input() title = 'Cancel Booking';
  @Input() subtitle = 'Please select a reason for cancellation:';
  @Input() loading = false;

  @Output() confirm = new EventEmitter<{ reason: string; comment?: string }>();
  @Output() close = new EventEmitter<void>();

  selectedReason = '';
  additionalComment = '';

  passengerOptions = [
    'Change of plans',
    'Found another ride',
    'Unable to travel',
    'Driver/ride issue',
    'Other'
  ];

  driverOptions = [
    'Personal plans changed',
    'Vehicle unavailable',
    'Unable to travel',
    'Route/time changed',
    'Other'
  ];

  get options(): string[] {
    return this.role === 'driver' ? this.driverOptions : this.passengerOptions;
  }

  onConfirm() {
    if (!this.selectedReason || this.loading) return;
    this.confirm.emit({
      reason: this.selectedReason,
      comment: this.additionalComment.trim() || undefined
    });
  }

  onClose() {
    this.selectedReason = '';
    this.additionalComment = '';
    this.close.emit();
  }
}

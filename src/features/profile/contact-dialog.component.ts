import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-contact-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="contact-dialog-container glass-panel">
      <!-- Header -->
      <header class="dialog-header">
        <h3>Contact & Support</h3>
        <button class="close-btn" (click)="close()">
          <span class="material-icons-outlined">close</span>
        </button>
      </header>

      <!-- Content/Form -->
      <div class="dialog-content">
        <p class="dialog-desc">Have a question, feedback, or need assistance? Send us a message and we'll get back to you shortly.</p>

        <!-- Direct Contact Details -->
        <div class="direct-contact-box">
          <div class="contact-item">
            <span class="material-icons-outlined item-icon">email</span>
            <div class="item-meta">
              <span class="item-lbl">Support Email</span>
              <a href="mailto:support&#64;highwaypool.com" class="item-val">support&#64;highwaypool.com</a>
            </div>
          </div>
          <div class="contact-item">
            <span class="material-icons-outlined item-icon">phone</span>
            <div class="item-meta">
              <span class="item-lbl">Call Center Support</span>
              <span class="item-val">+91 9988776655</span>
            </div>
          </div>
        </div>

        <div class="divider-thin"></div>

        <!-- Feedback Form -->
        <form (ngSubmit)="onSubmit(feedbackForm)" #feedbackForm="ngForm" class="feedback-form" *ngIf="!submitted">
          <div class="custom-input-group">
            <label>Your Email Address</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined prefix-icon">mail</span>
              <input 
                type="email" 
                placeholder="email@example.com" 
                [(ngModel)]="email" 
                name="email"
                required
                email
                #emailInput="ngModel"
                class="search-input" />
            </div>
            <span class="error-text" *ngIf="emailInput.invalid && emailInput.touched">Please enter a valid email.</span>
          </div>

          <div class="custom-input-group">
            <label>Subject</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined prefix-icon">subject</span>
              <input 
                type="text" 
                placeholder="What is this about?" 
                [(ngModel)]="subject" 
                name="subject"
                required
                #subjectInput="ngModel"
                class="search-input" />
            </div>
            <span class="error-text" *ngIf="subjectInput.invalid && subjectInput.touched">Subject is required.</span>
          </div>

          <div class="custom-input-group">
            <label>Message</label>
            <div class="textarea-wrapper">
              <textarea 
                placeholder="Describe your issue or feedback in detail..." 
                [(ngModel)]="message" 
                name="message"
                required
                rows="4"
                #msgInput="ngModel"
                class="feedback-textarea"></textarea>
            </div>
            <span class="error-text" *ngIf="msgInput.invalid && msgInput.touched">Message is required.</span>
          </div>

          <button 
            type="submit" 
            class="ripple-btn submit-btn" 
            [disabled]="feedbackForm.invalid || loading">
            <span class="spinner" *ngIf="loading"></span>
            {{ loading ? 'Sending message...' : 'Send Message' }}
          </button>
        </form>

        <!-- Success view -->
        <div class="success-box slide-in" *ngIf="submitted">
          <span class="material-icons-outlined success-icon">check_circle</span>
          <h4>Message Sent!</h4>
          <p>Feedback received! We will get back to you within 24 hours.</p>
          <button class="ripple-btn close-btn-bottom" (click)="close()">Close Dialog</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .contact-dialog-container {
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

      .dialog-desc {
        font-size: 0.88rem;
        color: hsl(var(--text-secondary));
        margin-bottom: 16px;
        line-height: 1.4;
      }
    }

    .direct-contact-box {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;

      .contact-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: hsl(var(--bg-secondary));
        border-radius: var(--border-radius-sm);
        border: 1px solid hsl(var(--border-light));

        .item-icon {
          font-size: 1.4rem;
          color: var(--color-primary);
        }

        .item-meta {
          display: flex;
          flex-direction: column;
          
          .item-lbl {
            font-size: 0.72rem;
            color: hsl(var(--text-tertiary));
            font-weight: 500;
          }

          .item-val {
            font-size: 0.88rem;
            color: hsl(var(--text-primary));
            font-weight: 600;
            text-decoration: none;
            
            &[href] {
              color: var(--color-primary);
              &:hover { text-decoration: underline; }
            }
          }
        }
      }
    }

    .divider-thin {
      height: 1px;
      background: hsl(var(--border-light));
      margin: 16px 0;
    }

    .feedback-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .custom-input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.78rem;
        font-weight: 600;
        color: hsl(var(--text-secondary));
      }

      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;

        .prefix-icon {
          position: absolute;
          left: 12px;
          color: hsl(var(--text-tertiary));
          font-size: 1.25rem;
        }

        .search-input {
          width: 100%;
          padding: 12px 12px 12px 38px;
          border-radius: var(--border-radius-sm);
          border: 1px solid hsl(var(--border-medium));
          background: hsl(var(--bg-primary));
          color: hsl(var(--text-primary));
          font-size: 0.88rem;
          outline: none;
          transition: var(--transition-smooth);

          &:focus {
            border-color: var(--color-primary);
            box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.12);
          }
        }
      }

      .textarea-wrapper {
        .feedback-textarea {
          width: 100%;
          padding: 12px;
          border-radius: var(--border-radius-sm);
          border: 1px solid hsl(var(--border-medium));
          background: hsl(var(--bg-primary));
          color: hsl(var(--text-primary));
          font-size: 0.88rem;
          outline: none;
          resize: none;
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

    .submit-btn {
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

    .success-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 24px 16px;

      .success-icon {
        font-size: 3rem;
        color: var(--color-secondary);
        margin-bottom: 12px;
      }

      h4 {
        font-size: 1.15rem;
        margin-bottom: 8px;
      }

      p {
        font-size: 0.88rem;
        color: hsl(var(--text-secondary));
        margin-bottom: 20px;
        line-height: 1.4;
      }

      .close-btn-bottom {
        padding: 8px 24px;
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
export class ContactDialogComponent {
  private dialogRef = inject(MatDialogRef<ContactDialogComponent>);

  email = '';
  subject = '';
  message = '';
  loading = false;
  submitted = false;

  onSubmit(form: NgForm) {
    if (form.invalid) return;
    this.loading = true;
    
    // Simulate API request
    setTimeout(() => {
      this.loading = false;
      this.submitted = true;
    }, 1000);
  }

  close() {
    this.dialogRef.close();
  }
}

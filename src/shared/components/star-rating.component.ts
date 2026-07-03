import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="star-container">
      <span 
        *ngFor="let star of stars" 
        class="material-icons-outlined star-icon"
        [class.filled]="star === 'filled'"
        [class.half]="star === 'half'">
        {{ star === 'filled' ? 'star' : (star === 'half' ? 'star_half' : 'star_outline') }}
      </span>
      <span class="rating-text" *ngIf="showText">{{ rating.toFixed(1) }}</span>
    </div>
  `,
  styles: [`
    .star-container {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }

    .star-icon {
      font-size: 16px;
      color: hsl(var(--text-tertiary));
      transition: var(--transition-smooth);

      &.filled {
        color: #ffb300; // Gold star
      }

      &.half {
        color: #ffb300;
      }
    }

    .rating-text {
      font-size: 0.75rem;
      font-weight: 700;
      color: hsl(var(--text-secondary));
      margin-left: 4px;
    }
  `]
})
export class StarRatingComponent {
  private _rating = 5.0;

  @Input()
  get rating(): number {
    return this._rating;
  }
  set rating(value: any) {
    this._rating = Number(value) || 0;
  }

  @Input() showText = true;

  get stars(): ('filled' | 'half' | 'empty')[] {
    const r = this.rating;
    const list: ('filled' | 'half' | 'empty')[] = [];
    const floor = Math.floor(r);
    const diff = r - floor;

    for (let i = 1; i <= 5; i++) {
      if (i <= floor) {
        list.push('filled');
      } else if (i === floor + 1 && diff >= 0.3 && diff <= 0.7) {
        list.push('half');
      } else if (i === floor + 1 && diff > 0.7) {
        list.push('filled');
      } else {
        list.push('empty');
      }
    }
    return list;
  }
}

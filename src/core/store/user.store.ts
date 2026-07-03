import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Review } from '../models/user.models';

@Injectable({
  providedIn: 'root'
})
export class UserStore {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);

  darkMode = signal<boolean>(false);
  reviews = signal<Review[]>([]);
  loading = signal<boolean>(false);

  constructor() {
    // Read initial theme preference from LocalStorage inside browser
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('theme_dark');
      this.darkMode.set(stored === 'true');
    }

    // Effect toggles HTML element dark-mode class
    effect(() => {
      const dark = this.darkMode();
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('theme_dark', String(dark));
        if (dark) {
          document.documentElement.classList.add('dark-mode');
        } else {
          document.documentElement.classList.remove('dark-mode');
        }
      }
    });
  }

  toggleDarkMode() {
    this.darkMode.update(d => !d);
  }

  loadReviews(driverId: string) {
    this.loading.set(true);
    this.http.get<Review[]>(`/api/users/${driverId}/reviews`).subscribe({
      next: (list) => {
        this.reviews.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  submitReview(driverId: string, rating: number, comment: string, reviewerName: string, reviewerPhoto: string, bookingId: string, onSuccess?: () => void) {
    this.loading.set(true);
    const payload = { rating, comment, reviewerName, reviewerPhoto, bookingId };
    this.http.post<Review>(`/api/users/${driverId}/reviews`, payload).subscribe({
      next: (newReview) => {
        this.reviews.update(list => [newReview, ...list]);
        this.loading.set(false);
        if (onSuccess) onSuccess();
      },
      error: () => this.loading.set(false)
    });
  }
}

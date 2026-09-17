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
  reviewsError = signal<string | null>(null);
  submitError = signal<string | null>(null);
  photoLoading = signal<boolean>(false);
  photoError = signal<string | null>(null);

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

  uploadProfilePhoto(dataUrl: string, authStore: any): Promise<boolean> {
    this.photoLoading.set(true);
    this.photoError.set(null);
    return new Promise((resolve) => {
      this.http.post<{ success: boolean; photoUrl: string; message: string }>('/api/users/me/photo', { photo: dataUrl }).subscribe({
        next: (res) => {
          this.photoLoading.set(false);
          const currentUser = authStore.currentUser();
          if (currentUser) {
            authStore.setCurrentUser({
              ...currentUser,
              photoUrl: res.photoUrl
            });
          }
          resolve(true);
        },
        error: (err) => {
          this.photoLoading.set(false);
          this.photoError.set(err.error?.error || 'Failed to upload profile photo');
          resolve(false);
        }
      });
    });
  }

  removeProfilePhoto(authStore: any): Promise<boolean> {
    this.photoLoading.set(true);
    this.photoError.set(null);
    return new Promise((resolve) => {
      this.http.delete<{ success: boolean; photoUrl: null; message: string }>('/api/users/me/photo').subscribe({
        next: (res) => {
          this.photoLoading.set(false);
          const currentUser = authStore.currentUser();
          if (currentUser) {
            authStore.setCurrentUser({
              ...currentUser,
              photoUrl: ''
            });
          }
          resolve(true);
        },
        error: (err) => {
          this.photoLoading.set(false);
          this.photoError.set(err.error?.error || 'Failed to remove profile photo');
          resolve(false);
        }
      });
    });
  }

  loadReviews(driverId: string) {
    this.loading.set(true);
    this.reviewsError.set(null);
    this.http.get<Review[]>(`/api/users/${driverId}/reviews`).subscribe({
      next: (list) => {
        this.reviews.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.reviewsError.set(err.error?.error || 'Failed to load reviews');
        this.loading.set(false);
      }
    });
  }

  submitReview(driverId: string, rating: number, comment: string, reviewerName: string, reviewerPhoto: string, bookingId: string, onSuccess?: () => void) {
    this.loading.set(true);
    this.submitError.set(null);
    const payload = { rating, comment, reviewerName, reviewerPhoto, bookingId };
    this.http.post<Review>(`/api/users/${driverId}/reviews`, payload).subscribe({
      next: (newReview) => {
        this.reviews.update(list => [newReview, ...list]);
        this.loading.set(false);
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const errorMsg = err.error?.error || 'Failed to submit review';
        this.submitError.set(errorMsg);
        this.loading.set(false);
        if (errorMsg.includes('already submitted')) {
          this.loadReviews(driverId);
        }
      }
    });
  }
}

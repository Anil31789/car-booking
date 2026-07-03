import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthStore } from './auth.store';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  bookingId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationStore {
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  private platformId = inject(PLATFORM_ID);
  private pollIntervalId: any = null;

  notifications = signal<AppNotification[]>([]);
  loading = signal<boolean>(false);

  unreadCount = computed(() => this.notifications().filter(n => !n.isRead).length);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.startPolling();
    }
  }

  startPolling() {
    this.stopPolling();
    this.loadNotifications();
    this.pollIntervalId = setInterval(() => {
      if (this.authStore.isLoggedIn()) {
        this.loadNotifications();
      }
    }, 10000); // Poll every 10 seconds
  }

  stopPolling() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  loadNotifications() {
    if (!this.authStore.isLoggedIn()) {
      this.notifications.set([]);
      return;
    }
    this.http.get<AppNotification[]>('/api/notifications').subscribe({
      next: (list) => {
        this.notifications.set(list);
      },
      error: (err) => console.error('Load notifications failed:', err)
    });
  }

  markAsRead(id: string) {
    this.http.post(`/api/notifications/${id}/read`, {}).subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
      }
    });
  }

  markAllAsRead() {
    this.http.post('/api/notifications/read-all', {}).subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(n => ({ ...n, isRead: true }))
        );
      }
    });
  }
}

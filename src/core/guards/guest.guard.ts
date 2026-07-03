import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformServer } from '@angular/common';
import { AuthStore } from '../store/auth.store';

export const guestGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  if (isPlatformServer(platformId)) {
    return true; // Bypass on server to allow pre-rendering welcome/login pages
  }

  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isLoggedIn()) {
    return true;
  }

  // Already logged in, redirect to home
  router.navigate(['/']);
  return false;
};

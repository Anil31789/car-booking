import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { guestGuard } from '../core/guards/guest.guard';

export const routes: Routes = [
  // Guest onboarding routes
  {
    path: 'welcome',
    loadComponent: () => import('../features/auth/welcome/welcome.component').then(m => m.WelcomeComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('../features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'signup',
    loadComponent: () => import('../features/auth/signup/signup.component').then(m => m.SignupComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'verify-email',
    loadComponent: () => import('../features/auth/signup/verify-email.component').then(m => m.VerifyEmailComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'otp',
    loadComponent: () => import('../features/auth/otp/otp.component').then(m => m.OtpComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('../features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'reset-password',
    loadComponent: () => import('../features/auth/forgot-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [guestGuard]
  },

  // Logged-in application layout shell
  {
    path: '',
    loadComponent: () => import('../layouts/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('../features/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'search',
        loadComponent: () => import('../features/search/search.component').then(m => m.SearchComponent)
      },
      {
        path: 'ride/:id',
        loadComponent: () => import('../features/ride-details/ride-details.component').then(m => m.RideDetailsComponent)
      },
      {
        path: 'booking/:id',
        loadComponent: () => import('../features/booking/booking.component').then(m => m.BookingComponent)
      },
      {
        path: 'bookings',
        loadComponent: () => import('../features/bookings/bookings.component').then(m => m.BookingsComponent)
      },
      {
        path: 'driver',
        loadComponent: () => import('../features/driver/driver.component').then(m => m.DriverComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('../features/profile/profile.component').then(m => m.ProfileComponent)
      }
    ]
  },

  // Fallback redirect
  {
    path: '**',
    redirectTo: ''
  }
];

import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Auth } from '../services/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: Auth, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const token = this.authService.getToken();

    // Check if token exists
    if (!token) {
      this.router.navigate(['/login']);
      return false;
    }

    // Check if token is valid (not expired)
    if (this.isTokenExpired(token)) {
      localStorage.removeItem('token');
      this.router.navigate(['/login']);
      return false;
    }

    return true;
  }

  private isTokenExpired(token: string): boolean {
    try {
      // Decode JWT token (without verification, just checking expiration)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= expirationTime;
    } catch (e) {
      // If token cannot be decoded, consider it invalid
      return true;
    }
  }
}


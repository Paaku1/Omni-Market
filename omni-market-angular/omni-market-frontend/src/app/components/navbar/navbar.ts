import { Component } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: false,
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  constructor(public authService: Auth, private router: Router) {}

  onToggleRole() {
    this.authService.toggleRole();
    this.router.navigate(['/dashboard']);
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

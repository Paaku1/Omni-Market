import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-auth-callback',
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center min-vh-100 bg-black text-white">
      <div class="spinner-border text-gold mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
      <h3 class="text-gold tracking-wider fw-bold">Verifying Authentication...</h3>
      <p class="text-muted small mt-2">Connecting to Omni Market Live Arena...</p>
    </div>
  `,
  styles: [`
    .bg-black { background-color: #0b0c10 !important; }
    .text-gold { color: #ffca2c; }
    .tracking-wider { letter-spacing: 1px; }
  `]
})
export class AuthCallback implements OnInit {
  constructor(
    private readonly authService: Auth, 
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  async ngOnInit() {
    // Get active session
    const { data, error } = await this.authService.supabase.auth.getSession();

    if (data.session) {
      localStorage.setItem('token', data.session.access_token);
      
      const user = data.session.user;
      let existingRole = user.user_metadata?.['role'] || user.app_metadata?.['role'];
      const roleParam = this.route.snapshot.queryParamMap.get('role');
      
      if (!existingRole) {
        // First-time signup via Google OAuth: save the chosen portal role
        const targetRole = (roleParam === 'seller' || roleParam === 'bidder') ? roleParam : 'bidder';
        try {
          await this.authService.supabase.auth.updateUser({
            data: { role: targetRole }
          });
          this.authService.setCurrentRole(targetRole);
          existingRole = targetRole;
          console.log('[AuthCallback] Saved new OAuth user role:', targetRole);
        } catch (updateErr) {
          console.error("Failed to update user profile metadata", updateErr);
          existingRole = 'bidder';
        }
      } else {
        // Existing user: preserve their registered role, DO NOT overwrite it
        this.authService.setCurrentRole(existingRole);
        console.log('[AuthCallback] Preserved existing user role:', existingRole);
      }

      // Verify portal match (e.g. if they logged in from seller portal but are bidder)
      if (roleParam && roleParam !== existingRole) {
        console.error(`[AuthCallback] Portal role mismatch! Accessing: ${roleParam}, User is: ${existingRole}`);
        await this.authService.logout();
        
        const errorMsg = roleParam === 'seller' 
          ? 'Access Denied: This account is registered as a Bidder. Please use the Bidder Portal.' 
          : 'Access Denied: This account is registered as a Seller. Please use the Seller Portal.';
        
        const redirectUrl = roleParam === 'seller' ? '/seller/login' : '/login';
        this.router.navigate([redirectUrl], { queryParams: { error: errorMsg } });
        return;
      }
      
      this.router.navigate(['/dashboard']);
    } else {
      console.error('No session found after OAuth redirect', error);
      this.router.navigate(['/login']);
    }
  }
}

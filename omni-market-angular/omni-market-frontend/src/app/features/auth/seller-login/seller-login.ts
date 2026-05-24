import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Card } from '../../../shared/card/card';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-seller-login',
  templateUrl: './seller-login.html',
  standalone: true,
  imports: [ReactiveFormsModule, Card, RouterLink, NgIf],
  styleUrls: ['./seller-login.scss'],
})
export class SellerLogin implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: Auth,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.initForm();

    // Check query params for any error messages (e.g. from Google OAuth role mismatch callback)
    this.route.queryParams.subscribe(params => {
      if (params['error']) {
        this.errorMessage = params['error'];
      }
    });

    // Handle OAuth redirect (Google sign-in): navigate once Supabase confirms session
    this.authService.supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        // Double check user role is seller before allowing dashboard entry
        const user = session.user;
        const role = user.user_metadata?.['role'] || user.app_metadata?.['role'];
        if (role === 'seller') {
          this.router.navigate(['/dashboard']);
        }
      }
    });
  }

  async onGoogleLogin() {
    try {
      this.errorMessage = '';
      // We initiate Google Login specifically passing 'seller' as the target role
      await this.authService.loginWithGoogle('seller');
    } catch (err) {
      this.errorMessage = 'Google login failed. Please try again.';
      console.error(err);
    }
  }

  initForm() {
    this.loginForm = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    // Log in specifically requesting 'seller' role verification
    this.authService.login(this.loginForm.value, 'seller').subscribe({
      next: async () => {
        // Wait briefly for roles to fully propagate
        await new Promise(resolve => setTimeout(resolve, 600));
        this.isLoading = false;
        console.log('[SellerLogin] Successful. Current role:', this.authService.getCurrentRole());
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = err.message || 'Invalid email or password. Please try again.';
        console.error('[SellerLogin] Error', err);
      },
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Card } from '../../../shared/card/card';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  imports: [ReactiveFormsModule, Card, RouterLink, NgIf],
  styleUrls: ['./login.scss'],
})
export class Login implements OnInit {
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
        // Double check user role is bidder before allowing dashboard entry
        const user = session.user;
        const role = user.user_metadata?.['role'] || user.app_metadata?.['role'];
        if (role === 'bidder') {
          this.router.navigate(['/dashboard']);
        }
      }
    });
  }

  async onGoogleLogin() {
    try {
      this.errorMessage = '';
      await this.authService.loginWithGoogle('bidder');
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

    // Log in specifically requesting 'bidder' role verification
    this.authService.login(this.loginForm.value, 'bidder').subscribe({
      next: async () => {
        // Wait briefly for roles to fully propagate
        await new Promise(resolve => setTimeout(resolve, 600));
        this.isLoading = false;
        console.log('[Login] Navigating to dashboard. Role:', this.authService.getCurrentRole());
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = err.message || 'Invalid email or password. Please try again.';
        console.error('[Login] Failed', err);
      },
    });
  }
}

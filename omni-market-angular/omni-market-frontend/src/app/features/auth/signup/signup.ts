import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Card } from '../../../shared/card/card';
import { NgIf } from '@angular/common'; // ✅ import NgIf explicitly

@Component({
  selector: 'app-signup',
  templateUrl: './signup.html',
  standalone: true,
  imports: [ReactiveFormsModule, Card, RouterModule, NgIf], // ✅ add NgIf here
})
export class Signup implements OnInit {
  signupForm!: FormGroup;
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: Auth,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.signupForm = this.fb.group({
      fullName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.pattern('^[a-zA-Z ]*$')
      ]],
      email: ['', [
        Validators.required,
        Validators.email
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern('^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).*$')
      ]],
      role: ['bidder', [
        Validators.required
      ]]
    });
  }

  // ✅ Helper for cleaner template access
  get f() {
    return this.signupForm.controls;
  }

  async onSignUp() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched(); // ✅ shows all errors if user clicks submit directly
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register(this.signupForm.value).subscribe({
      next: () => {
        this.isLoading = false;
        alert('Success! Check your email.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.message || err.error?.message || 'An unexpected error occurred.';
        console.error('Registration failed:', err);
      }
    });
  }

  // ✅ loginWithGoogle() returns void, not a Promise — no .then()
  async onGoogleSignUp() {
    try {
      const chosenRole = this.signupForm.get('role')?.value || 'bidder';
      await this.authService.loginWithGoogle(chosenRole);
    } catch (err) {
      this.errorMessage = 'Google sign-up failed. Please try again.';
    }
  }
}

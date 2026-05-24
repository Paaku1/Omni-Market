import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BiddingDashboard } from './components/bidding-dashboard/bidding-dashboard';
import { Login } from './features/auth/login/login';
import { SellerLogin } from './features/auth/seller-login/seller-login';
import { AuthGuard } from './core/guards/auth.guard';
import { AuthCallback } from './features/auth/auth-callback/auth-callback';
import { Signup } from './features/auth/signup/signup';
import { BidDetails } from './features/bid-details/bid-details';
import { Profile } from './features/profile/profile';
import { Welcome } from './components/welcome/welcome';

const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'seller/login', component: SellerLogin },
  { path: 'signup', component: Signup }, // Add this
  { path: 'dashboard', component: BiddingDashboard, canActivate: [AuthGuard] },
  { path: 'auth/callback', component: AuthCallback },
  { path: 'bid/:id', component: BidDetails, canActivate: [AuthGuard] },
  { path: 'profile', component: Profile, canActivate: [AuthGuard] },
  { path: '', component: Welcome }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

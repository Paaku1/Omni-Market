import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { CommonModule } from '@angular/common';
import { BiddingService } from '../../core/services/bidding-service';
import { AuctionItem } from '../../interfaces/auction-item';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class Profile implements OnInit {
  profileForm!: FormGroup;
  isLoading: boolean = false;
  isSaving: boolean = false;
  saveSuccess: boolean = false;
  errorMessage: string = '';

  // Role detection
  role: string = 'bidder';
  userEmail: string = '';
  joinDate: string = '';

  // Avatar
  avatarPresets: string[] = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Jack',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Scooter',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
    'https://api.dicebear.com/7.x/identicon/svg?seed=BiddingHero'
  ];

  selectedAvatar: string = '';
  selectedFileName: string = '';
  isUploadingAvatar: boolean = false;

  // Seller-specific stats
  sellerItems: AuctionItem[] = [];
  activeListings: number = 0;
  totalRevenue: number = 0;
  closedListings: number = 0;

  // Bidder-specific stats
  activeBidCount: number = 0;
  auctionsParticipated: number = 0;

  constructor(
    private fb: FormBuilder,
    public authService: Auth,
    private biddingService: BiddingService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.profileForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]]
    });

    // Subscribe to user + role
    this.authService.user$.subscribe(user => {
      if (user) {
        const metadata = user.user_metadata || {};
        this.profileForm.patchValue({ fullName: metadata.full_name || '' });
        this.selectedAvatar = metadata.avatar_url || this.avatarPresets[0];
        this.userEmail = user.email || '';

        // Format join date
        const created = user.created_at || user.createdAt;
        if (created) {
          this.joinDate = new Date(created).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'long', day: 'numeric'
          });
        }

        this.cdr.detectChanges();
      }
    });

    this.authService.currentRole$.subscribe(role => {
      this.role = role;
      this.loadRoleStats();
      this.cdr.detectChanges();
    });
  }

  private loadRoleStats() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    this.biddingService.getActiveAuctions().subscribe({
      next: (items: AuctionItem[]) => {
        if (this.role === 'seller') {
          this.sellerItems = items.filter(i =>
            i.sellerId?.toLowerCase() === userId.toLowerCase()
          );
          this.activeListings = this.sellerItems.filter(i => !i.isClosed).length;
          this.closedListings = this.sellerItems.filter(i => i.isClosed).length;
          this.totalRevenue = this.sellerItems.reduce((sum, i) =>
            sum + (i.currentBid || i.startingPrice), 0
          );
        } else {
          // Bidder stats: auctions where currentBid exists and we've participated
          // (approximate from live data - bidder history needs bid-level data)
          this.auctionsParticipated = items.filter(i => i.currentBid).length;
          this.activeBidCount = items.filter(i => !i.isClosed && i.currentBid).length;
        }
        this.cdr.detectChanges();
      },
      error: err => console.error('Could not load stats', err)
    });
  }

  selectPresetAvatar(url: string) {
    this.selectedAvatar = url;
    this.cdr.detectChanges();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedFileName = file.name;
    this.isUploadingAvatar = true;
    this.cdr.detectChanges();

    const fileExt = file.name.split('.').pop();
    const fileName = `avatar_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    this.authService.supabase.storage
      .from('product-images')
      .upload(filePath, file)
      .then(({ data, error }) => {
        if (error) {
          console.error('Avatar upload error', error);
          this.errorMessage = 'Failed to upload avatar. Please try again.';
          this.isUploadingAvatar = false;
          this.cdr.detectChanges();
        } else {
          const { data: { publicUrl } } = this.authService.supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);
          this.selectedAvatar = publicUrl;
          this.isUploadingAvatar = false;
          this.errorMessage = '';
          this.cdr.detectChanges();
        }
      });
  }

  async onSaveProfile() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.saveSuccess = false;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      await this.authService.updateProfile(
        this.profileForm.value.fullName,
        this.selectedAvatar
      );
      this.isSaving = false;
      this.saveSuccess = true;
      this.cdr.detectChanges();

      setTimeout(() => {
        this.saveSuccess = false;
        this.cdr.detectChanges();
      }, 4000);
    } catch (err: any) {
      this.isSaving = false;
      this.errorMessage = err.message || 'Failed to update profile.';
      this.cdr.detectChanges();
    }
  }

  get isSeller(): boolean { return this.role === 'seller'; }
  get isBidder(): boolean { return this.role === 'bidder'; }

  get roleLabel(): string {
    return this.isSeller ? 'Seller' : 'Bidder';
  }

  get roleIcon(): string {
    return this.isSeller ? '🏪' : '⚡';
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}

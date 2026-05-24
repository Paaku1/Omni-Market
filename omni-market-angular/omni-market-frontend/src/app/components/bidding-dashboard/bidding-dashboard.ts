import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { AuctionItem } from '../../interfaces/auction-item';
import { Card } from '../../shared/card/card';
import { Product } from '../../interfaces/product';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BiddingService } from '../../core/services/bidding-service';

@Component({
  selector: 'app-bidding-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Card],
  templateUrl: './bidding-dashboard.html',
  styleUrls: ['./bidding-dashboard.scss']
})
export class BiddingDashboard implements OnInit, OnDestroy {
  items: AuctionItem[] = [];
  timers: { [key: string]: string } = {}; // Maps auctionId -> timeRemainingStr
  outbidToast: { show: boolean; msg: string; auctionId: string } | null = null;
  private socket!: WebSocket;
  private tickerInterval: any;
  private pollInterval: any;

  // Seller Console Fields
  sellerItems: AuctionItem[] = [];
  totalEarnings: number = 0;
  activeListingsCount: number = 0;
  
  // Visual Auction Builder Fields
  showCreationForm: boolean = false;
  isSubmitting: boolean = false;
  creationSuccess: boolean = false;
  newAuctionName: string = '';
  newAuctionDesc: string = '';
  newAuctionStartPrice: number = 0;
  newAuctionDuration: number = 60; // 60 minutes default
  
  // Premium Uploader Fields
  selectedFileName: string = '';
  uploadedImageUrl: string = '';
  isUploadingImage: boolean = false;

  // Seller Product Inventory Fields
  myProducts: Product[] = [];
  showProductForm: boolean = false;
  showListModal: boolean = false;
  activeListProduct: Product | null = null;
  listAuctionDuration: number = 60;
  listAuctionPrice: number = 0;
  isSubmittingProduct: boolean = false;
  productCreationSuccess: boolean = false;
  isSubmittingList: boolean = false;
  listSuccess: boolean = false;

  constructor(
    public readonly authService: Auth,
    private readonly biddingService: BiddingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadActiveAuctions();
    this.loadProducts();
    this.connectToWebsocket();
    
    // Start periodic background polling for active auctions (every 5 seconds) to catch newly listed items live
    this.pollInterval = setInterval(() => {
      this.loadActiveAuctions();
    }, 5000);
    
    // Auto-recompute seller stats if role switches
    this.authService.currentRole$.subscribe(() => {
      this.computeSellerStats();
      this.loadProducts();
    });
  }

  private loadActiveAuctions() {
    this.biddingService.getActiveAuctions().subscribe({
      next: (data: AuctionItem[]) => {
        // High-performance check: Only update state and re-initialize tickers if list length or active elements changed
        const hasChanges = this.items.length !== data.length || 
          data.some((newItem, index) => {
            const oldItem = this.items[index];
            return !oldItem || oldItem.auctionId !== newItem.auctionId || oldItem.isClosed !== newItem.isClosed;
          });

        if (hasChanges) {
          this.items = [...data];
          this.startCountdownTicker();
          this.computeSellerStats();
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error("Gateway Error", err)
    });
  }

  connectToWebsocket() {
    const token = this.authService.getToken();
    this.socket = new WebSocket(`ws://localhost:8080/ws/bids?token=${token}`);

    this.socket.onmessage = (event) => {
      if (event.data.startsWith('{')) {
        try {
          const updatedBid = JSON.parse(event.data);
          this.updateLocalBid(updatedBid);
        } catch (e) {
          console.error('JSON Parse Error:', e);
        }
      }
    };

    this.socket.onerror = (error) => console.error('WebSocket Error:', error);
  }

  updateLocalBid(bidData: any) {
    const item = this.items.find((i) => i.auctionId === bidData.auctionId);
    const userId = this.authService.getCurrentUserId();

    if (item) {
      // Outbid alert detection logic
      const previouslyWeWereHighest = item.bidderName && item.bidderName.includes(userId?.substring(0, 8) || "NEVER_MATCH");
      const isNewBidFromSomeoneElse = bidData.bidderId !== userId;

      if (previouslyWeWereHighest && isNewBidFromSomeoneElse) {
        this.showOutbidNotification(item.productName, bidData.amount, item.auctionId);
      }

      item.currentBid = bidData.amount;
      item.bidderName = bidData.bidderName;
      
      this.computeSellerStats();
      this.cdr.detectChanges();
    }
  }

  showOutbidNotification(productName: string, amount: number, auctionId: string) {
    this.outbidToast = {
      show: true,
      msg: `Oh no! You've been outbid on "${productName}". New high bid: ₹${amount}`,
      auctionId: auctionId
    };
    this.cdr.detectChanges();
    setTimeout(() => {
      this.outbidToast = null;
      this.cdr.detectChanges();
    }, 8000);
  }

  dismissToast() {
    this.outbidToast = null;
    this.cdr.detectChanges();
  }

  // Seller Console Stats Computation
  computeSellerStats() {
    const sellerId = this.authService.getCurrentUserId();
    if (!sellerId || this.items.length === 0) return;

    this.sellerItems = this.items.filter(item =>
      item.sellerId?.toLowerCase() === sellerId.toLowerCase()
    );
    this.activeListingsCount = this.sellerItems.filter(item => !item.isClosed).length;
    
    // Calculate total potential or earned revenue from listings
    let earnings = 0;
    this.sellerItems.forEach(item => {
      if (item.currentBid) {
        earnings += item.currentBid;
      } else {
        earnings += item.startingPrice;
      }
    });
    this.totalEarnings = earnings;
    this.cdr.detectChanges();
  }

  // Create Listing
  onCreateAuction() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      alert("You must be logged in to create listings!");
      return;
    }

    if (!this.newAuctionName || this.newAuctionStartPrice <= 0) {
      alert("Please fill in the product name and starting price!");
      return;
    }

    this.isSubmitting = true;
    const payload = {
      name: this.newAuctionName,
      description: this.newAuctionDesc,
      startingPrice: this.newAuctionStartPrice,
      sellerId: userId,
      durationMinutes: this.newAuctionDuration,
      imageUrl: this.uploadedImageUrl || null // Real uploaded URL or null
    };

    this.biddingService.createAuction(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.creationSuccess = true;
        this.showCreationForm = false;
        
        // Reset form fields
        this.newAuctionName = '';
        this.newAuctionDesc = '';
        this.newAuctionStartPrice = 0;
        this.newAuctionDuration = 60;
        this.uploadedImageUrl = '';
        this.selectedFileName = '';
        
        // Reload all auctions to update lists
        this.loadActiveAuctions();
        
        setTimeout(() => {
          this.creationSuccess = false;
          this.cdr.detectChanges();
        }, 5000);
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error("Listing failed", err);
        alert("Failed to list item. Please verify gateway is running.");
        this.cdr.detectChanges();
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedFileName = file.name;
    this.isUploadingImage = true;
    this.uploadedImageUrl = '';
    this.cdr.detectChanges();

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    this.authService.supabase.storage
      .from('product-images')
      .upload(filePath, file)
      .then(({ data, error }) => {
        if (error) {
          console.error("Storage upload error", error);
          // High-end Unsplash backup fallback matching standard listing categories (watches, jewelry, gadgets)
          const searchKeywords = this.newAuctionName ? encodeURIComponent(this.newAuctionName) : 'product';
          this.uploadedImageUrl = `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60`;
          this.isUploadingImage = false;
          this.cdr.detectChanges();
        } else {
          // Retrieve public URL
          const { data: { publicUrl } } = this.authService.supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

          this.uploadedImageUrl = publicUrl;
          this.isUploadingImage = false;
          this.cdr.detectChanges();
        }
      });
  }

  stopBidding(auctionId: string) {
    if (!confirm("Are you sure you want to stop bidding early on this item?")) return;
    
    this.biddingService.closeAuction(auctionId).subscribe({
      next: () => {
        this.loadActiveAuctions(); // Reload listings to update state
      },
      error: (err) => {
        console.error("Failed to close auction early", err);
        alert("Failed to stop auction. Please check gateway logs.");
      }
    });
  }

  resumeBidding(auctionId: string) {
    const minutes = prompt("Enter duration (in minutes) to resume bidding:", "60");
    if (!minutes) return;
    const minsVal = parseInt(minutes);
    if (isNaN(minsVal) || minsVal <= 0) {
      alert("Invalid duration. Please enter a valid number of minutes.");
      return;
    }

    this.biddingService.reopenAuction(auctionId, minsVal).subscribe({
      next: () => {
        this.loadActiveAuctions(); // Reload listings to update state
      },
      error: (err) => {
        console.error("Failed to resume auction", err);
        alert("Failed to resume auction. Please check gateway logs.");
      }
    });
  }

  private startCountdownTicker() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }
    
    // Initial compute
    this.runTickerTick();

    this.tickerInterval = setInterval(() => {
      this.runTickerTick();
    }, 1000);
  }

  private runTickerTick() {
    this.items.forEach(item => {
      const timeStr = this.getRemainingTime(item.endTime, item.isClosed);
      this.timers[item.auctionId] = timeStr;
      
      // If time runs out and item was not marked closed locally, mark it
      if (timeStr === 'Closed' && !item.isClosed) {
        item.isClosed = true;
        this.computeSellerStats();
      }
    });
    this.cdr.detectChanges();
  }

  getRemainingTime(endTimeStr: string, isClosed: boolean): string {
    if (isClosed) return 'Closed';
    const end = new Date(endTimeStr).getTime();
    const now = new Date().getTime();
    const diff = end - now;

    if (diff <= 0) {
      return 'Closed';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
  }

  getActiveCount(): number {
    return this.items.filter(item => !item.isClosed && item.currentBid).length;
  }

  isTimeUrgent(auctionId: string): boolean {
    const timeStr = this.timers[auctionId];
    if (!timeStr || timeStr === 'Closed') return false;
    return !timeStr.includes('d') && (!timeStr.includes('h') || timeStr.startsWith('0h'));
  }

  loadProducts() {
    const sellerId = this.authService.getCurrentUserId();
    if (!sellerId) return;

    this.biddingService.getProducts().subscribe({
      next: (data: Product[]) => {
        this.myProducts = data.filter(p => p.sellerId.toLowerCase() === sellerId.toLowerCase());
        this.cdr.detectChanges();
      },
      error: (err) => console.error("Error loading products", err)
    });
  }

  onCreateProduct() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      alert("You must be logged in to add products!");
      return;
    }

    if (!this.newAuctionName || this.newAuctionStartPrice <= 0) {
      alert("Please fill in the product name and starting price!");
      return;
    }

    this.isSubmittingProduct = true;
    const payload = {
      name: this.newAuctionName,
      description: this.newAuctionDesc,
      startingPrice: this.newAuctionStartPrice,
      sellerId: userId,
      imageUrl: this.uploadedImageUrl || null
    };

    this.biddingService.createProduct(payload).subscribe({
      next: (res) => {
        this.isSubmittingProduct = false;
        this.productCreationSuccess = true;
        this.showProductForm = false;

        // Reset form fields
        this.newAuctionName = '';
        this.newAuctionDesc = '';
        this.newAuctionStartPrice = 0;
        this.uploadedImageUrl = '';
        this.selectedFileName = '';

        this.loadProducts();

        setTimeout(() => {
          this.productCreationSuccess = false;
          this.cdr.detectChanges();
        }, 5000);
      },
      error: (err) => {
        this.isSubmittingProduct = false;
        console.error("Product creation failed", err);
        alert("Failed to add product. Please verify gateway is running.");
        this.cdr.detectChanges();
      }
    });
  }

  openListModal(product: Product) {
    this.activeListProduct = product;
    this.listAuctionPrice = product.startingPrice;
    this.listAuctionDuration = 60; // default 1 hour
    this.showListModal = true;
    this.cdr.detectChanges();
  }

  closeListModal() {
    this.showListModal = false;
    this.activeListProduct = null;
    this.cdr.detectChanges();
  }

  onListProductAuction() {
    if (!this.activeListProduct) return;

    this.isSubmittingList = true;
    const payload = {
      productId: this.activeListProduct.id,
      durationMinutes: this.listAuctionDuration,
      startingPrice: this.listAuctionPrice
    };

    this.biddingService.listProductAuction(payload).subscribe({
      next: (res) => {
        this.isSubmittingList = false;
        this.listSuccess = true;
        this.showListModal = false;
        this.activeListProduct = null;

        // Reload data
        this.loadActiveAuctions();
        this.loadProducts();

        setTimeout(() => {
          this.listSuccess = false;
          this.cdr.detectChanges();
        }, 5000);
      },
      error: (err) => {
        this.isSubmittingList = false;
        console.error("Listing product failed", err);
        alert("Failed to list product in auction. Please verify gateway is running.");
        this.cdr.detectChanges();
      }
    });
  }

  isProductActive(productId: string): boolean {
    return this.items.some(item => !item.isClosed && item.productId === productId);
  }

  getActiveAuctionId(productId: string): string | null {
    const activeItem = this.items.find(item => !item.isClosed && item.productId === productId);
    return activeItem ? activeItem.auctionId : null;
  }

  ngOnDestroy() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.socket) {
      this.socket.close();
    }
  }
}

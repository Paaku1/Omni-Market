import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../core/services/auth';
import { BiddingService } from '../../core/services/bidding-service';

@Component({
  selector: 'app-bid-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bid-details.html',
  styleUrls: ['./bid-details.scss'],
})
export class BidDetails implements OnInit, OnDestroy {
  itemId: string | null = null;
  bidAmount: number = 0;
  currentPrice: number = 0;
  highBidder: string = 'None';
  priceJustChanged = false;
  errorMessage: string = '';
  bidHistory: any[] = [];
  
  // Rich Metadata Fields
  productName: string = 'Loading Auction...';
  description: string = '';
  endTime: string | null = null;
  isClosed: boolean = false;
  startingPrice: number = 0;
  sellerId: string = '';
  imageUrl: string | null = null;
  timeRemainingString: string = 'Ticking...';
  
  // Premium Outbid Alert
  outbidAlert: { show: boolean; msg: string } | null = null;
  
  private socket!: WebSocket;
  private tickerInterval: any;

  constructor(
    private readonly authService: Auth,
    private readonly route: ActivatedRoute,
    private readonly biddingService: BiddingService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.itemId = this.route.snapshot.paramMap.get('id');
    this.loadAuctionDetails();
    this.connectToWebsocket();
  }

  private loadAuctionDetails() {
    if (this.itemId) {
      this.biddingService.getAuctionDetails(this.itemId).subscribe({
        next: (data) => {
          if (data) {
            this.productName = data.productName;
            this.description = data.description || 'No description available for this product.';
            this.endTime = data.endTime;
            this.isClosed = data.isClosed;
            this.startingPrice = data.startingPrice;
            this.sellerId = data.sellerId || '';
            this.imageUrl = data.imageUrl || null;
            
            // Set starting price or current highest bid
            if (data.bidHistory && data.bidHistory.length > 0) {
              this.currentPrice = data.bidHistory[0].amount;
              this.bidHistory = [...data.bidHistory];
              this.highBidder = data.bidHistory[0].bidderName || ("User-" + data.bidHistory[0].bidderId.substring(0, 8));
            } else {
              this.currentPrice = data.startingPrice;
              this.bidHistory = [];
              this.highBidder = 'No bids yet';
            }
            
            this.startCountdownTicker();
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          console.error('Failed to load auction details', err);
          this.errorMessage = 'Failed to load initial auction details. System might be down.';
          this.cdr.detectChanges();
        }
      });
    }
  }

  connectToWebsocket() {
    const token = this.authService.getToken();
    this.socket = new WebSocket(`ws://localhost:8080/ws/bids?token=${token}`);

    this.socket.onmessage = (event) => {
      if (event.data.startsWith('{')) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_BID' && data.auctionId === this.itemId) {
            const userId = this.authService.getCurrentUserId();
            const isNewBidFromSomeoneElse = data.bidderId !== userId;
            
            // Determine if the current user previously bid in this session
            const userHasParticipated = this.bidHistory.some(bid => bid.bidderId === userId);

            if (isNewBidFromSomeoneElse && userHasParticipated) {
              this.triggerOutbidNotification(data.amount);
            }

            const activeUserMetadata = (this.authService.user$ as any)?.source?.value?.user_metadata || {};
            const activeUserFullName = activeUserMetadata?.full_name || '';

            const bidderName = data.bidderId === userId ? 
              (activeUserFullName || "You") : 
              ("User-" + data.bidderId.substring(0, 8));

            this.currentPrice = data.amount;
            this.highBidder = bidderName;
            this.priceJustChanged = true;
            this.errorMessage = ''; // Clear errors on successful bid update
            
            // Prepend new bid to history in real-time
            this.bidHistory.unshift({
              amount: data.amount,
              createdAt: new Date().toISOString(),
              bidderId: data.bidderId,
              bidderName: bidderName
            });

            this.cdr.detectChanges(); // Trigger Angular change detection manually
            
            setTimeout(() => {
              this.priceJustChanged = false;
              this.cdr.detectChanges();
            }, 1000);
          }
        } catch (e) {
          console.error('JSON Parse Error:', e);
        }
      } else {
        // Handle plain text errors from Spring Boot (e.g., "Invalid JSON...")
        console.warn('Server Message:', event.data);
        this.errorMessage = event.data;
        this.cdr.detectChanges(); // Force rendering the error
      }
    };

    this.socket.onerror = (err) => {
      this.errorMessage = 'WebSocket connection failed. The engine might be down.';
      this.cdr.detectChanges();
    };
  }

  placeBid() {
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      alert("You must be logged in to place a bid.");
      return;
    }

    if (this.isCurrentUserSeller()) {
      alert("You cannot bid on your own item!");
      return;
    }

    if (this.bidAmount <= this.currentPrice) {
      alert("Bid must be higher than the current price!");
      return;
    }

    const payload = {
      auctionId: this.itemId,
      amount: this.bidAmount,
      bidderId: userId
    };

    // Sending as JSON string for Bidding WebSocket Handler
    this.socket.send(JSON.stringify(payload));
    this.bidAmount = 0;
  }

  isCurrentUserSeller(): boolean {
    const userId = this.authService.getCurrentUserId();
    return !!userId && !!this.sellerId && userId.toLowerCase() === this.sellerId.toLowerCase();
  }

  addIncrement(amount: number) {
    const baseline = this.currentPrice || this.startingPrice;
    this.bidAmount = baseline + amount;
    this.cdr.detectChanges();
  }

  triggerOutbidNotification(amount: number) {
    this.outbidAlert = {
      show: true,
      msg: `Warning! You've been outbid. New high bid is ₹${amount}.`
    };
    this.cdr.detectChanges();
    
    setTimeout(() => {
      this.outbidAlert = null;
      this.cdr.detectChanges();
    }, 8000);
  }

  dismissAlert() {
    this.outbidAlert = null;
    this.cdr.detectChanges();
  }

  private startCountdownTicker() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }

    this.updateCountdownTick();

    this.tickerInterval = setInterval(() => {
      this.updateCountdownTick();
    }, 1000);
  }

  private updateCountdownTick() {
    if (!this.endTime) return;
    
    if (this.isClosed) {
      this.timeRemainingString = 'Closed';
      if (this.tickerInterval) clearInterval(this.tickerInterval);
      return;
    }

    const end = new Date(this.endTime).getTime();
    const now = new Date().getTime();
    const diff = end - now;

    if (diff <= 0) {
      this.timeRemainingString = 'Closed';
      this.isClosed = true;
      this.cdr.detectChanges();
      if (this.tickerInterval) clearInterval(this.tickerInterval);
      return;
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

    this.timeRemainingString = parts.join(' ');
    this.cdr.detectChanges();
  }

  isTimeUrgent(): boolean {
    if (this.isClosed || this.timeRemainingString === 'Closed') return false;
    return !this.timeRemainingString.includes('d') && (!this.timeRemainingString.includes('h') || this.timeRemainingString.startsWith('0h'));
  }

  didCurrentUserWin(): boolean {
    if (!this.isClosed || this.bidHistory.length === 0) return false;
    const userId = this.authService.getCurrentUserId();
    return this.bidHistory[0].bidderId === userId;
  }

  ngOnDestroy() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }
    if (this.socket) {
      this.socket.close();
    }
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../../interfaces/product';
import { environment } from '../../../environments/environment';
import { Auction } from '../../interfaces/auction';

@Injectable({
  providedIn: 'root',
})
export class BiddingService {

  private readonly biddingUrl = `${environment.gatewayUrl}/bidding`
  constructor(
    private readonly http: HttpClient
  ) {}

  getActiveAuctions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.biddingUrl}/active-auctions`);
  }

  getAuctionDetails(auctionId: string): Observable<any> {
    return this.http.get<any>(`${this.biddingUrl}/details/${auctionId}`);
  }

  createAuction(payload: any): Observable<any> {
    return this.http.post<any>(`${this.biddingUrl}/create`, payload);
  }

  closeAuction(auctionId: string): Observable<any> {
    return this.http.post<any>(`${this.biddingUrl}/close/${auctionId}`, {});
  }

  reopenAuction(auctionId: string, minutes: number = 60): Observable<any> {
    return this.http.post<any>(`${this.biddingUrl}/reopen/${auctionId}?minutes=${minutes}`, {});
  }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.biddingUrl}/products`);
  }

  createProduct(payload: any): Observable<Product> {
    return this.http.post<Product>(`${this.biddingUrl}/add-product`, payload);
  }

  listProductAuction(payload: any): Observable<any> {
    return this.http.post<any>(`${this.biddingUrl}/list-product-auction`, payload);
  }
}

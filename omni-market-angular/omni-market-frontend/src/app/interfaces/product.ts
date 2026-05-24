export interface Product {
  id: string;
  name: string;
  description: string | null;
  startingPrice: number;
  sellerId: string;
  createdAt: string;
  imageUrl: string | null;
}

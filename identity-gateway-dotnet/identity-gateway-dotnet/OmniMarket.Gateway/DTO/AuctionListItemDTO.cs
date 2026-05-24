namespace OmniMarket.Gateway.DTO
{
    public class AuctionListItemDTO
    {
        public Guid AuctionId { get; set; }
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public decimal StartingPrice { get; set; }
        public DateTime EndTime { get; set; }
        public bool IsClosed { get; set; }
        public decimal? CurrentBid { get; set; }
        public string? BidderName { get; set; }
        public Guid SellerId { get; set; }
        public string? ImageUrl { get; set; }
    }
}

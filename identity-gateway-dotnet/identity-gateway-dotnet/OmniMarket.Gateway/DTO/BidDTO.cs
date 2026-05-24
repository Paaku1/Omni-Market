namespace OmniMarket.Gateway.DTO
{
    public class BidDTO
    {
        public decimal Amount { get; set; }
        public DateTime CreatedAt { get; set; }
        public Guid BidderId { get; set; }
        public string? BidderName { get; set; }
    }
}

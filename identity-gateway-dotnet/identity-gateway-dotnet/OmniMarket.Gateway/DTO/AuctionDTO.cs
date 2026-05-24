namespace OmniMarket.Gateway.DTO
{
    public class AuctionDTO
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public DateTime EndTime { get; set; }
        public bool IsClosed { get; set; }
    }
}

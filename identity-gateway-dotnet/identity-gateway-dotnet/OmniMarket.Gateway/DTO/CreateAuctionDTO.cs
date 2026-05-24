using System;

namespace OmniMarket.Gateway.DTO
{
    public class CreateAuctionDTO
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal StartingPrice { get; set; }
        public Guid SellerId { get; set; }
        public int DurationMinutes { get; set; }
        public string? ImageUrl { get; set; }
    }
}

using System;

namespace OmniMarket.Gateway.DTO
{
    public class ListProductAuctionDTO
    {
        public Guid ProductId { get; set; }
        public int DurationMinutes { get; set; }
        public decimal StartingPrice { get; set; } // 0 to use default starting price
    }
}

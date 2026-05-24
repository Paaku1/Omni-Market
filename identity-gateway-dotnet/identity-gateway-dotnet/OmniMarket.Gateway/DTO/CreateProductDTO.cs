using System;

namespace OmniMarket.Gateway.DTO
{
    public class CreateProductDTO
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal StartingPrice { get; set; }
        public Guid SellerId { get; set; }
        public string? ImageUrl { get; set; }
    }
}

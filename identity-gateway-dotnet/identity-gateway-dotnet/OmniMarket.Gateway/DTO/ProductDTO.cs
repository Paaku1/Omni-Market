namespace OmniMarket.Gateway.DTO
{
    public class ProductDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }
        public decimal StartingPrice { get; set; }
        public Guid SellerId { get; set; }
        public DateTime CreatedAt { get; set; } 
        public string? ImageUrl { get; set; } 
    }
}

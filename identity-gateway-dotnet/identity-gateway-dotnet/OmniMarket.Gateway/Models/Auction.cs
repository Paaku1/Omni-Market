using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace OmniMarket.Gateway.Models
{
    [Table("auctions")]
    public class Auction : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("product_id")]
        public Guid ProductId { get; set; }

        [Column("end_time")]
        public DateTime EndTime { get; set; }

        [Column("is_closed")]
        public bool IsClosed { get; set; }

        // Add this Navigation Property
        [Reference(typeof(Product), false)]
        [Column("products")]
        public Product? Product { get; set; }

        // Also add this for the Bids relationship in image_96c556.png
        [Reference(typeof(Bid), false)]
        [Column("bids")]
        public List<Bid> Bids { get; set; } = new();
    }
}
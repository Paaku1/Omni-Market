using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
namespace OmniMarket.Gateway.Models
{
    [Table("bids")]
    public class Bid : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("auction_id")]
        public Guid AuctionId { get; set; }

        [Column("bidder_id")]
        public Guid BidderId { get; set; }

        [Column("amount")]
        public decimal Amount { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [Reference(typeof(Profile), false)]
        [Column("profiles")]
        public Profile? BidderProfile { get; set; }
    }
}
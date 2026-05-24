namespace OmniMarket.Gateway.DTO
{
    public class AuctionDetailsDTO : AuctionListItemDTO
    {
        public string? Description { get; set; }
        public List<BidDTO> BidHistory { get; set; } = new();

    }
}

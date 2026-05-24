using Microsoft.AspNetCore.Mvc;
using OmniMarket.Gateway.DTO;
using OmniMarket.Gateway.Models;

namespace OmniMarket.Gateway.Controllers
{
    [Route("/api/bidding")]
    [ApiController] // Recommended for better error handling in APIs
    public class BiddingController(Supabase.Client _supabaseClient) : ControllerBase
    {
        [HttpGet("products")]
        public async Task<IActionResult> GetProducts()
        {
            var response = await _supabaseClient.From<Product>().Get();
            var productDtos = response.Models.Select(p => new ProductDTO
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                StartingPrice = p.StartingPrice,
                SellerId = p.SellerId,
                CreatedAt = p.CreatedAt,
                ImageUrl = p.ImageUrl
            }).ToList();
            return Ok(productDtos);
        }

        [HttpPost("add-product")]
        public async Task<IActionResult> AddProduct([FromBody] CreateProductDTO dto)
        {
            try
            {
                var newProduct = new Product
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    StartingPrice = dto.StartingPrice,
                    SellerId = dto.SellerId,
                    CreatedAt = DateTime.UtcNow,
                    ImageUrl = dto.ImageUrl
                };

                var productResponse = await _supabaseClient.From<Product>().Insert(newProduct);
                var insertedProduct = productResponse.Models.FirstOrDefault();

                if (insertedProduct == null)
                {
                    return BadRequest("Failed to create product in database.");
                }

                return Ok(new ProductDTO
                {
                    Id = insertedProduct.Id,
                    Name = insertedProduct.Name,
                    Description = insertedProduct.Description,
                    StartingPrice = insertedProduct.StartingPrice,
                    SellerId = insertedProduct.SellerId,
                    CreatedAt = insertedProduct.CreatedAt,
                    ImageUrl = insertedProduct.ImageUrl
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpPost("list-product-auction")]
        public async Task<IActionResult> ListProductAuction([FromBody] ListProductAuctionDTO dto)
        {
            try
            {
                // Verify the product exists
                var productResponse = await _supabaseClient
                    .From<Product>()
                    .Filter("id", Supabase.Postgrest.Constants.Operator.Equals, dto.ProductId.ToString())
                    .Get();
                var product = productResponse.Models.FirstOrDefault();
                if (product == null)
                {
                    return NotFound("Product not found.");
                }

                // If starting price is overridden, update it
                if (dto.StartingPrice > 0)
                {
                    product.StartingPrice = dto.StartingPrice;
                    await product.Update<Product>();
                }

                var newAuction = new Auction
                {
                    ProductId = dto.ProductId,
                    EndTime = DateTime.UtcNow.AddMinutes(dto.DurationMinutes),
                    IsClosed = false
                };

                var auctionResponse = await _supabaseClient.From<Auction>().Insert(newAuction);
                var insertedAuction = auctionResponse.Models.FirstOrDefault();

                if (insertedAuction == null)
                {
                    return BadRequest("Failed to launch auction in database.");
                }

                return Ok(new
                {
                    AuctionId = insertedAuction.Id,
                    ProductId = product.Id,
                    ProductName = product.Name,
                    StartingPrice = product.StartingPrice,
                    EndTime = insertedAuction.EndTime
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpGet("active-auctions")]
        public async Task<IActionResult> GetActiveAuctions()
        {
            try
            {
                var response = await _supabaseClient
                    .From<Auction>()
                    .Select("*, products(*), bids(*, profiles(*))")
                    .Get();

                Console.WriteLine($"[GetActiveAuctions] Raw Response Content: {response.Content}");
                Console.WriteLine($"[GetActiveAuctions] Raw Models Count: {response.Models.Count}");

                var list = response.Models.Select(a =>
                {
                    var highestBid = a.Bids?.OrderByDescending(b => b.Amount).FirstOrDefault();
                    return new AuctionListItemDTO
                    {
                        AuctionId = a.Id,
                        ProductId = a.ProductId,
                        ProductName = a.Product?.Name ?? "Unknown Item",
                        StartingPrice = a.Product?.StartingPrice ?? 0,
                        EndTime = a.EndTime,
                        IsClosed = a.IsClosed,
                        CurrentBid = highestBid?.Amount,
                        BidderName = highestBid?.BidderProfile?.FullName ?? (highestBid != null ? "User-" + highestBid.BidderId.ToString().Substring(0, 8) : "No bids yet"),
                        SellerId = a.Product?.SellerId ?? Guid.Empty,
                        ImageUrl = a.Product?.ImageUrl
                    };
                }).ToList();

                Console.WriteLine($"[GetActiveAuctions] Mapped Items Count: {list.Count}");
                return Ok(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GetActiveAuctions] Exception encountered: {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("details/{auctionId}")]
        public async Task<IActionResult> GetAuctionDetails(Guid auctionId)
        {
            // FIX: Convert auctionId to string to prevent "Unknown criterion type" error
            var response = await _supabaseClient
                .From<Auction>()
                .Filter("id", Supabase.Postgrest.Constants.Operator.Equals, auctionId.ToString())
                .Select("*, products(*), bids(*, profiles(*))")
                .Single();

            if (response == null) return NotFound();

            var details = new AuctionDetailsDTO
            {
                AuctionId = response.Id,
                ProductId = response.ProductId,
                ProductName = response.Product?.Name ?? "Unknown Item",
                Description = response.Product?.Description,
                StartingPrice = response.Product?.StartingPrice ?? 0,
                EndTime = response.EndTime,
                IsClosed = response.IsClosed,
                SellerId = response.Product?.SellerId ?? Guid.Empty,
                ImageUrl = response.Product?.ImageUrl,
                // Maps the relationship seen in image_96c556.png
                BidHistory = response.Bids?.Select(b => new BidDTO
                {
                    Amount = b.Amount,
                    CreatedAt = b.CreatedAt,
                    BidderId = b.BidderId,
                    BidderName = b.BidderProfile?.FullName ?? "User-" + b.BidderId.ToString().Substring(0, 8)
                }).OrderByDescending(x => x.Amount).ToList() ?? new List<BidDTO>()
            };

            return Ok(details);
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateAuction([FromBody] CreateAuctionDTO dto)
        {
            try
            {
                var newProduct = new Product
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    StartingPrice = dto.StartingPrice,
                    SellerId = dto.SellerId,
                    CreatedAt = DateTime.UtcNow,
                    ImageUrl = dto.ImageUrl
                };

                var productResponse = await _supabaseClient.From<Product>().Insert(newProduct);
                var insertedProduct = productResponse.Models.FirstOrDefault();

                if (insertedProduct == null)
                {
                    return BadRequest("Failed to create product in database.");
                }

                var newAuction = new Auction
                {
                    ProductId = insertedProduct.Id,
                    EndTime = DateTime.UtcNow.AddMinutes(dto.DurationMinutes),
                    IsClosed = false
                };

                var auctionResponse = await _supabaseClient.From<Auction>().Insert(newAuction);
                var insertedAuction = auctionResponse.Models.FirstOrDefault();

                if (insertedAuction == null)
                {
                    return BadRequest("Failed to launch auction in database.");
                }

                return Ok(new
                {
                    AuctionId = insertedAuction.Id,
                    ProductId = insertedProduct.Id,
                    ProductName = insertedProduct.Name,
                    StartingPrice = insertedProduct.StartingPrice,
                    EndTime = insertedAuction.EndTime
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpPost("close/{auctionId}")]
        public async Task<IActionResult> CloseAuction(Guid auctionId)
        {
            try
            {
                var response = await _supabaseClient
                    .From<Auction>()
                    .Filter("id", Supabase.Postgrest.Constants.Operator.Equals, auctionId.ToString())
                    .Get();

                var auction = response.Models.FirstOrDefault();
                if (auction == null) return NotFound("Auction not found.");

                auction.IsClosed = true;
                await auction.Update<Auction>();

                return Ok(new { Message = "Auction stopped successfully.", IsClosed = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error stopping auction: {ex.Message}");
            }
        }

        [HttpPost("reopen/{auctionId}")]
        public async Task<IActionResult> ReopenAuction(Guid auctionId, [FromQuery] int minutes = 60)
        {
            try
            {
                var response = await _supabaseClient
                    .From<Auction>()
                    .Filter("id", Supabase.Postgrest.Constants.Operator.Equals, auctionId.ToString())
                    .Get();

                var auction = response.Models.FirstOrDefault();
                if (auction == null) return NotFound("Auction not found.");

                auction.IsClosed = false;
                auction.EndTime = DateTime.UtcNow.AddMinutes(minutes);
                await auction.Update<Auction>();

                return Ok(new { Message = "Auction resumed successfully.", IsClosed = false, EndTime = auction.EndTime });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error resuming auction: {ex.Message}");
            }
        }
    }
}
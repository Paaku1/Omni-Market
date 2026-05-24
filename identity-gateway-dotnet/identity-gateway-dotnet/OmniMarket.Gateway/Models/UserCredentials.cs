using System.ComponentModel.DataAnnotations;

namespace OmniMarket.Gateway.Models
{
    public class UserCredentials
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;

        public string FullName { get; set; }
        public string Role { get; set; } = "bidder";
    }
}

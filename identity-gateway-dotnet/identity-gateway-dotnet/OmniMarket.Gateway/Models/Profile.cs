using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using System;

namespace OmniMarket.Gateway.Models
{
    [Table("profiles")]
    public class Profile : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("full_name")]
        public string? FullName { get; set; }

        [Column("avatar_url")]
        public string? AvatarUrl { get; set; }

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; }
    }
}

using Microsoft.AspNetCore.Mvc;
using OmniMarket.Gateway.Models;
using Supabase.Gotrue;
using System.Threading.Tasks;

namespace OmniMarket.Gateway.Controllers
{
    [Route("/api/auth")]
    public class AuthController(Supabase.Client _supabaseClient) : Controller
    {
        [HttpPost("signup")]
        public async Task<IActionResult> SignUp(
                [FromBody] UserCredentials request
            )
        {
            try
            {
                var signUpOptions = new Supabase.Gotrue.SignUpOptions
                {
                    Data = new Dictionary<string, object>
                    {
                        { "full_name", request.FullName },
                        { "role", request.Role }
                    }
                };
                var session = await _supabaseClient.Auth.SignUp(request.Email, request.Password, signUpOptions);

                if(session == null)
                {
                    return BadRequest("Could not find the user");
                }

                return Ok(new {Message = "User Created! Please check your email for confirmation"});
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(
            [FromBody] UserCredentials request)
        {
            try
            {
                var session = await _supabaseClient.Auth.SignIn(request.Email, request.Password);

                if (session == null) return Unauthorized("Invalid credentials.");

                return Ok(new
                {
                    Token = session.AccessToken,
                    RefreshToken = session.RefreshToken,
                    User = session.User
                });
            }
            catch(Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

    }
}

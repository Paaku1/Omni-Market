using DotNetEnv;
using Supabase;

var builder = WebApplication.CreateBuilder(args);

// 1. Load Supabase Settings
Env.Load();
var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL");
var supabaseKey = Environment.GetEnvironmentVariable("SUPABASE_KEY");

Console.WriteLine($"[Program] SUPABASE_URL: {supabaseUrl}");
Console.WriteLine($"[Program] SUPABASE_KEY Length: {supabaseKey?.Length ?? 0}");

// 2. Register Supabase Client as a "Singleton" (one instance for the whole app)
builder.Services.AddScoped(_ => new Supabase.Client(supabaseUrl, supabaseKey, new SupabaseOptions
{
    AutoConnectRealtime = true
}));
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});
// 3. Add YARP Gateway (The Traffic Controller)
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
    );
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseCors("AllowAll");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();

// 4. Use the Gateway
app.MapReverseProxy();
app.MapControllers();

app.Run();
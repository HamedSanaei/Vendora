using Application;
using Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.IdentityModel.Tokens;
using Persistence;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors();
builder.Services.AddApplication(builder.Configuration);
builder.Services.AddInfrastructure();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        string issuer = builder.Configuration["Jwt:Issuer"] ?? "Vendora";
        string audience = builder.Configuration["Jwt:Audience"] ?? "Vendora.Clients";
        string secret = builder.Configuration["Jwt:Key"] ?? "vendora-development-jwt-signing-key-change-before-production";

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = issuer,
            ValidAudience = audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret))
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
});

var app = builder.Build();

// One-shot database migration mode used by the deployment pipeline. It applies
// pending EF Core migrations (after the deployment script has taken a backup)
// and exits, so the web server never starts.
// The deployment pipeline sets VENDORA__RUN_MIGRATIONS. Read the environment
// variable directly so the mode is reliable regardless of configuration
// provider casing behavior across platforms.
string migrationMode = builder.Configuration["Vendora:RunMigrations"]
    ?? Environment.GetEnvironmentVariable("VENDORA__RUN_MIGRATIONS")
    ?? string.Empty;
if (!string.IsNullOrWhiteSpace(migrationMode))
{
    await RunMigrationsAsync(app.Services, migrationMode);
    return;
}

// Fail fast with clear errors when production configuration is unsafe.
if (app.Environment.IsProduction())
{
    ValidateProductionConfiguration(app.Configuration);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

string[] corsOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

app.UseCors(x =>
{
    if (corsOrigins.Length > 0)
    {
        x.WithOrigins(corsOrigins).AllowAnyMethod().AllowAnyHeader();
    }
    else
    {
        x.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    }
});
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Lightweight liveness and database connectivity probe. Never leaks internals.
app.MapGet("/healthz", async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    try
    {
        await dbContext.Database.ExecuteSqlRawAsync("SELECT 1", cancellationToken);
        return Results.Ok(new { status = "ok" });
    }
    catch
    {
        return Results.Json(new { status = "unavailable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.Run();

/// <summary>
/// Applies pending EF Core migrations in the one-shot deployment mode.
/// </summary>
static async Task RunMigrationsAsync(IServiceProvider services, string mode)
{
    using var scope = services.CreateScope();
    var factory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<AppDbContext>>();
    try
    {
        await using var dbContext = await factory.CreateDbContextAsync();
        var pending = (await dbContext.Database.GetPendingMigrationsAsync()).ToList();
        Console.WriteLine(pending.Count == 0
            ? "No pending migrations."
            : $"Pending migrations: {string.Join(", ", pending)}");

        if (mode.Equals("check", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine(pending.Count == 0 ? "Database is up to date." : "Database requires migration.");
            Environment.Exit(0);
        }

        await dbContext.Database.MigrateAsync();
        Console.WriteLine("Migrations applied successfully.");
        Environment.Exit(0);
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Database migration failed: {exception.Message}");
        Environment.Exit(1);
    }
}

/// <summary>
/// Validates that production secrets and policy configuration are present before the web host starts.
/// </summary>
static void ValidateProductionConfiguration(IConfiguration configuration)
{
    const string developmentJwtKey = "vendora-development-jwt-signing-key-change-before-production";
    string jwtKey = configuration["Jwt:Key"] ?? string.Empty;
    if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey == developmentJwtKey)
    {
        throw new InvalidOperationException("Jwt:Key must be configured with a strong random secret in Production.");
    }

    string inviteCode = configuration["Auth:AdminInviteCode"] ?? string.Empty;
    if (string.IsNullOrWhiteSpace(inviteCode) || inviteCode == "DEV-ADMIN-INVITE")
    {
        throw new InvalidOperationException("Auth:AdminInviteCode must be configured with a strong random secret in Production.");
    }

    string corsOrigins = configuration["Cors:AllowedOrigins"] ?? string.Empty;
    if (string.IsNullOrWhiteSpace(corsOrigins))
    {
        throw new InvalidOperationException("Cors:AllowedOrigins must be configured in Production.");
    }
}

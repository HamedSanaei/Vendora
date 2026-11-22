using Application.Accounting;
using Application.Egress;
using Domain.Entities;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Persistence;
using System.Text.Json;

namespace API;

/// <summary>Imports credentials from standard input for an authenticated server operator, outside the HTTP listener.</summary>
internal static class EgressImport
{
    private sealed record Input(string Name, string Url, string[] Services);

    /// <summary>Probes every assigned service, then atomically inserts an encrypted profile and saves successful routes.</summary>
    public static async Task<int> RunAsync(WebApplication app)
    {
        try
        {
            string? line = await Console.In.ReadLineAsync();
            if (line is null || line.Length > 4096) throw new AccountingException("EGRESS_INVALID_IMPORT", 400);
            var input = JsonSerializer.Deserialize<Input>(line, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            if (input is null || !Uri.TryCreate(input.Url, UriKind.Absolute, out var uri) || uri.AbsolutePath != "/"
                || uri.Query.Length != 0 || uri.Fragment.Length != 0 || uri.Port <= 0 || input.Services is not { Length: > 0 }
                || input.Services.Distinct().Count() != input.Services.Length)
                throw new AccountingException("EGRESS_INVALID_IMPORT", 400);
            string[] auth = uri.UserInfo.Split(':', 2);
            await using var scope = app.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var clock = scope.ServiceProvider.GetRequiredService<TimeProvider>();
            var network = scope.ServiceProvider.GetRequiredService<IEgressNetwork>();
            var protection = scope.ServiceProvider.GetRequiredService<IDataProtectionProvider>();
            if (input.Services.Any(x => !EgressCatalog.Services.ContainsKey(x) || !network.CanProxy(x)))
                throw new AccountingException("EGRESS_INVALID_IMPORT_SERVICE", 400);
            var profile = new EgressProxy { Id = Guid.NewGuid() };
            var draft = new ManageEgress.ProfileInput(null, null, input.Name, uri.Scheme, uri.IdnHost, uri.Port, 12, true,
                "Imported by server operator", auth.Length == 2 ? Uri.UnescapeDataString(auth[0]) : null,
                auth.Length == 2 ? Uri.UnescapeDataString(auth[1]) : null);
            await ManageEgress.ApplyAsync(profile, draft, network, protection, default);
            var checks = await Task.WhenAll(input.Services.Select(async service =>
            {
                var result = await network.ProbeAsync(service, profile, default);
                result.Id = service;
                return result;
            }));
            foreach (var check in checks) Console.WriteLine($"{check.Id}: {check.Code} ({check.Milliseconds} ms)");
            // 401/404/405 at a non-Google probe establish verified TLS connectivity to an
            // API root that intentionally has no anonymous GET method.
            static bool Passed(EgressCheck result) => result.Code == "Success"
                || result.Id != EgressCatalog.Google && result.Code is "UpstreamHttp:401" or "UpstreamHttp:404" or "UpstreamHttp:405";
            if (checks.All(x => !Passed(x)) || checks.Any(x => x.Id == EgressCatalog.Google && !Passed(x))) return 1;
            await using var transaction = await db.Database.BeginTransactionAsync();
            if (await db.EgressProxies.AnyAsync(x => x.Name == profile.Name))
                throw new AccountingException("EGRESS_IMPORT_PROFILE_EXISTS", 409);
            db.Add(profile);
            db.Add(ManageEgress.Audit(null, clock, "ImportProfile", ManageEgress.ProfileKey(profile.Id)));
            foreach (var check in checks.Where(Passed))
            {
                var route = await db.EgressRoutes.FindAsync(check.Id);
                if (route is null) { route = new() { Service = check.Id }; db.Add(route); }
                route.Enabled = true; route.ProxyId = profile.Id; route.Version = Guid.NewGuid();
                var previous = await db.EgressChecks.FindAsync(check.Id);
                if (previous is null) db.Add(check);
                else db.Entry(previous).CurrentValues.SetValues(check);
                db.Add(ManageEgress.Audit(null, clock, $"AssignProxy:{profile.Id}", check.Id));
            }
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            Console.WriteLine("Saved routes: " + string.Join(", ", checks.Where(Passed).Select(x => x.Id)));
            return checks.All(Passed) ? 0 : 2;
        }
        catch (AccountingException e) { Console.Error.WriteLine(e.Code); return 1; }
        catch (Exception) { Console.Error.WriteLine("EGRESS_IMPORT_FAILED"); return 1; }
    }
}

using Application.Accounting;
using Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Persistence;
using System.Net;
using System.Text.Json;

namespace Application.Egress;

/// <summary>Manages routing and writes only protected credentials and sanitized audit events.</summary>
public static class ManageEgress
{
    public const string CredentialPurpose = "Vendora.Egress.ProxyCredential.v1";
    public sealed record Credential(string User, string Password);
    public sealed record ProfileInput(Guid? Id, Guid? Version, string Name, string Scheme, string Host, int Port,
        int TimeoutSeconds, bool Enabled, string? Note, string? User, string? Password, bool ClearCredential = false);
    public sealed record ProfileView(Guid Id, Guid Version, string Name, string Scheme, string Host, int Port,
        int TimeoutSeconds, bool Enabled, string Note, bool HasCredential, EgressCheck? LastTest);
    public sealed record RouteView(string Service, Guid? Version, bool Enabled, Guid? ProxyId, bool CanProxy, EgressCheck? LastTest);
    public sealed record Settings(ProfileView[] Profiles, RouteView[] Routes, EgressAudit[] Audit);
    public sealed record Read : IRequest<Settings>;
    public sealed record Save(ProfileInput Input, Guid Actor) : IRequest<ProfileView>;
    public sealed record Delete(Guid Id, Guid Version, Guid Actor) : IRequest;
    public sealed record Assign(string Service, Guid? Version, bool Enabled, Guid? ProxyId, Guid Actor) : IRequest;
    public sealed record Test(string? Service, Guid? ProxyId) : IRequest<EgressCheck>;

    /// <summary>Returns the profile collection and routes without exposing login fields or ciphertext.</summary>
    public sealed class ReadHandler(AppDbContext db, IEgressNetwork network) : IRequestHandler<Read, Settings>
    {
        public async Task<Settings> Handle(Read request, CancellationToken ct)
        {
            var checks = await db.EgressChecks.AsNoTracking().ToDictionaryAsync(x => x.Id, ct);
            var profiles = await db.EgressProxies.AsNoTracking().OrderBy(x => x.Name).ToArrayAsync(ct);
            var routes = await db.EgressRoutes.AsNoTracking().ToDictionaryAsync(x => x.Service, ct);
            var audit = await db.EgressAudits.AsNoTracking().OrderByDescending(x => x.Id).Take(30).ToArrayAsync(ct);
            return new(profiles.Select(x => View(x, checks.GetValueOrDefault(ProfileKey(x.Id)))).ToArray(),
                EgressCatalog.Services.Keys.Select(service =>
                {
                    var row = routes.GetValueOrDefault(service);
                    return new RouteView(service, row?.Version, row?.Enabled == true, row?.ProxyId, network.CanProxy(service), checks.GetValueOrDefault(service));
                }).ToArray(), audit);
        }
    }

    /// <summary>Creates or edits a profile after validation. Blank password fields retain the credential.</summary>
    public sealed class SaveHandler(AppDbContext db, IEgressNetwork network, IDataProtectionProvider protection, TimeProvider time)
        : IRequestHandler<Save, ProfileView>
    {
        public async Task<ProfileView> Handle(Save request, CancellationToken ct)
        {
            var input = request.Input;
            var row = input.Id is Guid id ? await db.EgressProxies.FindAsync([id], ct) : new EgressProxy { Id = Guid.NewGuid() };
            if (row is null) throw new AccountingException("EGRESS_PROFILE_NOT_FOUND", 404);
            if (input.Id.HasValue && input.Version != row.Version) throw Conflict();
            await ApplyAsync(row, input, network, protection, ct);
            if (!input.Id.HasValue) db.Add(row);
            db.Add(Audit(request.Actor, time, input.Id.HasValue ? "UpdateProfile" : "CreateProfile", ProfileKey(row.Id)));
            await PersistAsync(db, ct);
            return View(row, null);
        }
    }

    /// <summary>Removes profiles only when no service refers to them.</summary>
    public sealed class DeleteHandler(AppDbContext db, TimeProvider time) : IRequestHandler<Delete>
    {
        public async Task Handle(Delete request, CancellationToken ct)
        {
            var row = await db.EgressProxies.FindAsync([request.Id], ct)
                ?? throw new AccountingException("EGRESS_PROFILE_NOT_FOUND", 404);
            if (row.Version != request.Version) throw Conflict();
            if (await db.EgressRoutes.AnyAsync(x => x.ProxyId == row.Id, ct))
                throw new AccountingException("EGRESS_PROFILE_ASSIGNED", 409);
            var check = await db.EgressChecks.FindAsync([ProfileKey(row.Id)], ct);
            if (check is not null) db.Remove(check);
            db.Remove(row);
            db.Add(Audit(request.Actor, time, "DeleteProfile", ProfileKey(row.Id)));
            await PersistAsync(db, ct);
        }
    }

    /// <summary>Sets a service to Direct or requires an enabled saved profile.</summary>
    public sealed class AssignHandler(AppDbContext db, IEgressNetwork network, TimeProvider time) : IRequestHandler<Assign>
    {
        public async Task Handle(Assign request, CancellationToken ct)
        {
            RequireService(request.Service);
            var row = await db.EgressRoutes.FindAsync([request.Service], ct);
            if (row?.Version != request.Version) throw Conflict();
            if (request.Enabled && (!network.CanProxy(request.Service) || request.ProxyId is not Guid id
                || !await db.EgressProxies.AnyAsync(x => x.Id == id && x.Enabled, ct)))
                throw new AccountingException("EGRESS_PROFILE_REQUIRED", 400);
            if (row is null) { row = new() { Service = request.Service }; db.Add(row); }
            row.Enabled = request.Enabled;
            row.ProxyId = request.Enabled ? request.ProxyId : null;
            row.Version = Guid.NewGuid();
            var check = await db.EgressChecks.FindAsync([request.Service], ct);
            if (check is not null) db.Remove(check);
            db.Add(Audit(request.Actor, time, request.Enabled ? $"AssignProxy:{request.ProxyId}" : "SetDirect", request.Service));
            await PersistAsync(db, ct);
        }
    }

    /// <summary>Tests a saved profile through Google or a service's actual current route with a fixed safe request.</summary>
    public sealed class TestHandler(AppDbContext db, IEgressNetwork network) : IRequestHandler<Test, EgressCheck>
    {
        public async Task<EgressCheck> Handle(Test request, CancellationToken ct)
        {
            if ((request.Service is null) == (request.ProxyId is null)) throw new AccountingException("EGRESS_INVALID_TEST", 400);
            string service = request.Service ?? EgressCatalog.Google;
            RequireService(service);
            EgressProxy? profile = null;
            bool required = request.ProxyId.HasValue;
            if (request.ProxyId is Guid id)
                profile = await db.EgressProxies.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct)
                    ?? throw new AccountingException("EGRESS_PROFILE_NOT_FOUND", 404);
            else
            {
                var route = await db.EgressRoutes.AsNoTracking().Include(x => x.Proxy).SingleOrDefaultAsync(x => x.Service == service, ct);
                required = route?.Enabled == true;
                if (required) profile = route!.Proxy ?? throw new AccountingException("EGRESS_PROFILE_REQUIRED", 409);
            }
            var result = await network.ProbeAsync(service, profile, ct);
            result.Id = request.ProxyId is Guid proxy ? ProfileKey(proxy) : service;
            var prior = await db.EgressChecks.FindAsync([result.Id], ct);
            if (prior is null) db.Add(result);
            else db.Entry(prior).CurrentValues.SetValues(result);
            await PersistAsync(db, ct);
            return result;
        }
    }

    /// <summary>Validates and applies a profile draft, including replacing or explicitly removing protected credentials.</summary>
    public static async Task ApplyAsync(EgressProxy row, ProfileInput input, IEgressNetwork network, IDataProtectionProvider protection, CancellationToken ct)
    {
        string name = input.Name?.Trim() ?? "", host = input.Host?.Trim().ToLowerInvariant() ?? "", note = input.Note?.Trim() ?? "";
        if (name.Length is < 1 or > 80 || name.Any(char.IsControl) || note.Length > 240 || note.Any(char.IsControl)
            || host.Length is < 1 or > 253 || !host.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or ':')
            || Uri.CheckHostName(host) == UriHostNameType.Unknown
            || input.Scheme is not ("http" or "https" or "socks5") || input.Port is < 1 or > 65535
            || input.TimeoutSeconds is < 2 or > 60 || input.User?.Length > 200 || input.Password?.Length > 200
            || input.User?.Any(char.IsControl) == true || input.Password?.Any(char.IsControl) == true
            || input.User?.Contains(':') == true
            || input.Scheme == "socks5" && (System.Text.Encoding.UTF8.GetByteCount(input.User ?? "") > 255
                || System.Text.Encoding.UTF8.GetByteCount(input.Password ?? "") > 255))
            throw new AccountingException("EGRESS_INVALID_PROFILE", 400);
        bool replace = !string.IsNullOrEmpty(input.User) || !string.IsNullOrEmpty(input.Password);
        if (replace && (input.ClearCredential || string.IsNullOrWhiteSpace(input.User) || string.IsNullOrEmpty(input.Password)))
            throw new AccountingException("EGRESS_INVALID_CREDENTIAL", 400);
        await network.ValidateProxyAsync(host, ct);
        bool endpointChanged = row.Host != host || row.Port != input.Port || row.Scheme != input.Scheme;
        if (endpointChanged && row.Credential is not null && !replace && !input.ClearCredential)
            throw new AccountingException("EGRESS_REENTER_CREDENTIAL", 400);
        if (replace)
            row.Credential = protection.CreateProtector(CredentialPurpose, row.Id.ToString())
                .Protect(JsonSerializer.Serialize(new Credential(input.User!, input.Password!)));
        if (input.ClearCredential) row.Credential = null;
        row.Name = name; row.Host = host; row.Port = input.Port; row.Scheme = input.Scheme;
        row.Enabled = input.Enabled; row.TimeoutSeconds = input.TimeoutSeconds; row.Note = note; row.Version = Guid.NewGuid();
    }

    /// <summary>Creates the public projection used by both reads and writes.</summary>
    private static ProfileView View(EgressProxy row, EgressCheck? check) => new(row.Id, row.Version, row.Name, row.Scheme,
        row.Host, row.Port, row.TimeoutSeconds, row.Enabled, row.Note, row.Credential is not null, check);

    /// <summary>Resolves only a known server integration.</summary>
    private static void RequireService(string service)
    {
        if (!EgressCatalog.Services.ContainsKey(service)) throw new AccountingException("EGRESS_UNKNOWN_SERVICE", 404);
    }

    /// <summary>Namespaces profile probe results separately from service results.</summary>
    public static string ProfileKey(Guid id) => $"profile:{id}";

    /// <summary>Audit rows contain only the actor, action, stable target and timestamp.</summary>
    public static EgressAudit Audit(Guid? actor, TimeProvider time, string action, string target) =>
        new() { Id = Guid.CreateVersion7(time.GetUtcNow()), Actor = actor, At = time.GetUtcNow(), Action = action, Target = target };

    /// <summary>Surfaces concurrent changes to the UI without leaking EF or SQLite exceptions.</summary>
    private static async Task PersistAsync(AppDbContext db, CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { throw Conflict(); }
    }

    /// <summary>A stale editor must reload before overriding another administrator's changes.</summary>
    private static AccountingException Conflict() => new("EGRESS_SETTINGS_CHANGED", 409);
}

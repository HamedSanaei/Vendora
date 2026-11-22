namespace Domain.Entities;

/// <summary>A stored outbound proxy. The credential fields contain protected data only.</summary>
public sealed class EgressProxy
{
    public Guid Id { get; set; }
    public Guid Version { get; set; }
    public string Name { get; set; } = "";
    public string Scheme { get; set; } = "http";
    public string Host { get; set; } = "";
    public int Port { get; set; }
    public string? Credential { get; set; }
    public int TimeoutSeconds { get; set; } = 10;
    public bool Enabled { get; set; }
    public string Note { get; set; } = "";
}

/// <summary>A service uses Direct when disabled; enabled routing requires its assigned profile.</summary>
public sealed class EgressRoute
{
    public string Service { get; set; } = "";
    public Guid Version { get; set; }
    public bool Enabled { get; set; }
    public Guid? ProxyId { get; set; }
    public EgressProxy? Proxy { get; set; }
}

/// <summary>The last safe probe result for a profile or service.</summary>
public sealed class EgressCheck
{
    public string Id { get; set; } = "";
    public DateTimeOffset At { get; set; }
    public string Path { get; set; } = "";
    public string Code { get; set; } = "";
    public long Milliseconds { get; set; }
}

/// <summary>Records changes without copying settings or credentials into the audit trail.</summary>
public sealed class EgressAudit
{
    public Guid Id { get; set; }
    public Guid? Actor { get; set; }
    public DateTimeOffset At { get; set; }
    public string Action { get; set; } = "";
    public string Target { get; set; } = "";
}

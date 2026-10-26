namespace Domain.Entities;

/// <summary>Non-secret messaging policy. Missing settings preserve legacy phone verification only.</summary>
public sealed class SmsSettings
{
    public int Id { get; set; } = 1;
    public long Version { get; set; } = 1;
    public bool Enabled { get; set; } = true;
    public string Provider { get; set; } = "ParsGreen";
    public bool PhoneLogin { get; set; }
    public bool PasswordRecovery { get; set; }
    public bool PhoneVerification { get; set; } = true;
    public int OtpType { get; set; } = 1;
    public int PatternId { get; set; } = 3;
    public int LowStockThreshold { get; set; } = 5;
    public string RulesJson { get; set; } = "[]";
    public string RecipientsJson { get; set; } = "[]";
    public DateTime? ActivatedAtUtc { get; set; }
}

/// <summary>A normalized, unique verified phone claim for an account; not an unverified profile assertion.</summary>
public sealed class VerifiedPhoneIdentity
{
    public Guid UserId { get; set; }
    public string Phone { get; set; } = "";
}

/// <summary>Cross-purpose durable resend budget, also used by legacy profile verification.</summary>
public sealed class SmsPhoneBudget
{
    public string Phone { get; set; } = "";
    public DateTime WindowStartUtc { get; set; }
    public DateTime NextSendAtUtc { get; set; }
    public int Count { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();
}

/// <summary>Purpose-bound OTP. Neither its code nor a recovery grant is stored in plaintext.</summary>
public sealed class SmsChallenge
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? UserId { get; set; }
    public string Phone { get; set; } = "";
    public string Purpose { get; set; } = "";
    public string? CodeHash { get; set; }
    public string? ProfileStamp { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public int Attempts { get; set; }
    public bool Consumed { get; set; }
    public string? RecoveryHash { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();
}

/// <summary>Durable outgoing notification and delivery audit. OTP bodies are never written here.</summary>
public sealed class SmsMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string EventKey { get; set; } = "";
    public string Event { get; set; } = "";
    public Guid? UserId { get; set; }
    public Guid? ActorId { get; set; }
    public string Phone { get; set; } = "";
    public string Body { get; set; } = "";
    public string Provider { get; set; } = "ParsGreen";
    public long SettingsVersion { get; set; }
    public string Status { get; set; } = "Queued";
    public string? ProviderId { get; set; }
    public string? ErrorCode { get; set; }
    public int Attempts { get; set; }
    public int DeliveryChecks { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime NextAttemptAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LeaseUntilUtc { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();
}

/// <summary>Baseline/cooldown for available-stock alerts; initialization never sends historical alerts.</summary>
public sealed class SmsStockWatch
{
    public Guid ProductId { get; set; }
    public long SettingsVersion { get; set; }
    public int PreviousAvailable { get; set; }
    public DateTime? LastAlertUtc { get; set; }
}

/// <summary>Private, customer-owned support conversation.</summary>
public sealed class SupportTicket
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? OrderId { get; set; }
    public string Subject { get; set; } = "";
    public string Status { get; set; } = "WaitingForSupport";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public long Version { get; set; } = 1;
    public List<SupportTicketMessage> Messages { get; set; } = [];
}

/// <summary>Immutable authored ticket text, never copied into an SMS notification.</summary>
public sealed class SupportTicketMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TicketId { get; set; }
    public Guid AuthorId { get; set; }
    public bool IsStaff { get; set; }
    public string Text { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

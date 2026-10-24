namespace Domain.Entities;

/// <summary>One bounded, expiring challenge per account; never stores a plaintext verification code.</summary>
public sealed class PhoneVerification
{
    public Guid UserId { get; set; }
    public string PhoneNumber { get; set; } = "";
    public string? CodeHash { get; set; }
    public string? ProfileStamp { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime NextSendAtUtc { get; set; }
    public DateTime WindowStartUtc { get; set; }
    public int SendCount { get; set; }
    public int Attempts { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();
}

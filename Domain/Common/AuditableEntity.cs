namespace Domain.Common;

/// <summary>
/// Base entity that tracks creation and update timestamps.
/// </summary>
public abstract class AuditableEntity : EntityBase
{
    /// <summary>
    /// Gets the UTC timestamp when the entity was created.
    /// </summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Gets the UTC timestamp when the entity was last updated.
    /// </summary>
    public DateTime? UpdatedAtUtc { get; set; }

    /// <summary>
    /// Marks the entity as updated at the current UTC time.
    /// </summary>
    public void Touch()
    {
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

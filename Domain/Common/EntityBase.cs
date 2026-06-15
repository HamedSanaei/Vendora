namespace Domain.Common;

/// <summary>
/// Base type for domain entities with a strongly typed identifier.
/// </summary>
public abstract class EntityBase
{
    /// <summary>
    /// Gets the entity identifier.
    /// </summary>
    public Guid Id { get; protected set; } = Guid.NewGuid();
}

namespace Domain.Entities;

/// <summary>Durable provenance for an explicitly seeded record; edits to its public name/code never erase its origin.</summary>
public sealed class SeedRecord
{
    public string EntityType { get; set; } = "";
    public Guid EntityId { get; set; }
}

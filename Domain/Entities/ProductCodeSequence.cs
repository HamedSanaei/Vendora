namespace Domain.Entities;

/// <summary>Durable catalog counter; deleting a product never makes its public code available again.</summary>
public sealed class ProductCodeSequence
{
    public int Id { get; set; } = 1;
    public int NextValue { get; set; } = 100;
}

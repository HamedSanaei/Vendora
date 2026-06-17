namespace Persistence.Common;

/// <summary>
/// Represents a persistence boundary for committing pending changes.
/// </summary>
public interface IUnitOfWork
{
    /// <summary>
    /// Saves pending persistence changes.
    /// </summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

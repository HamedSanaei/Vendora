using Domain.Entities;

namespace Application.Catalog;

/// <summary>One cycle-safe hierarchy policy for admin counts, public navigation and product filtering.</summary>
public sealed class CategoryHierarchy(IEnumerable<Category> categories)
{
    private readonly Dictionary<Guid, Category> _nodes = categories.ToDictionary(x => x.Id);

    /// <summary>A public node requires an active, unbroken path to a root; inactive parents hide the entire branch.</summary>
    public bool IsPublic(Guid id)
    {
        var seen = new HashSet<Guid>();
        while (_nodes.TryGetValue(id, out var node) && seen.Add(id))
        {
            if (!node.IsActive) return false;
            if (node.ParentCategoryId is not Guid parent) return true;
            id = parent;
        }
        return false;
    }

    /// <summary>Returns the selected nodes plus all descendants once, optionally excluding hidden branches.</summary>
    public HashSet<Guid> Descendants(IEnumerable<Guid> roots, bool publicOnly = false)
    {
        var result = new HashSet<Guid>();
        var children = _nodes.Values.ToLookup(x => x.ParentCategoryId);
        var queue = new Queue<Guid>(roots);
        while (queue.TryDequeue(out var id))
        {
            if (!_nodes.ContainsKey(id) || (publicOnly && !IsPublic(id)) || !result.Add(id)) continue;
            foreach (var child in children[id]) queue.Enqueue(child.Id);
        }
        return result;
    }

    /// <summary>Returns a root-to-leaf path without recursion or relying on query ordering.</summary>
    public IReadOnlyList<Category> Path(Guid id)
    {
        var path = new List<Category>();
        var seen = new HashSet<Guid>();
        while (_nodes.TryGetValue(id, out var node) && seen.Add(id))
        {
            path.Add(node);
            if (node.ParentCategoryId is not Guid parent) break;
            id = parent;
        }
        path.Reverse(); return path;
    }
}

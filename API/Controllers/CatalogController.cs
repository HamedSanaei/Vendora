using Application.Catalog;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Exposes read-only storefront catalog endpoints.
/// </summary>
[ApiController]
[Route("api/catalog")]
public sealed class CatalogController : ControllerBase
{
    private readonly ISender _mediator;

    /// <summary>
    /// Creates the catalog controller.
    /// </summary>
    public CatalogController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Returns active products for the storefront.</summary>
    [HttpGet("products")]
    public async Task<ActionResult> GetProducts(CancellationToken cancellationToken)
    {
        return Ok(await _mediator.Send(new CatalogQueries.Products.Query(), cancellationToken));
    }

    /// <summary>Filters by complete category subtrees without changing the legacy product list contract.</summary>
    [HttpGet("products/search")]
    public async Task<ActionResult> Search([FromQuery] string[]? category, [FromQuery] string? baseCategory,
        [FromQuery] string[]? brand, [FromQuery] string[]? color, [FromQuery] decimal? priceMin,
        [FromQuery] decimal? priceMax, [FromQuery] bool inStock = false, [FromQuery] string sort = "newest",
        [FromQuery] int page = 1, [FromQuery] int pageSize = 12, [FromQuery] string? search = null, CancellationToken cancellationToken = default)
        => Ok(await _mediator.Send(new CatalogSearch.Query(category, baseCategory, brand, color, priceMin, priceMax, inStock, sort, page, pageSize, search), cancellationToken));

    /// <summary>Reads a visible category landing page by current or historical slug.</summary>
    [HttpGet("categories/{slug}")]
    public async Task<ActionResult> Category(string slug, CancellationToken ct)
    {
        var result = await _mediator.Send(new CatalogSearch.CategoryQuery(slug), ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Returns one active product with its sanitized full article by GUID or slug.</summary>
    [HttpGet("products/{identifier}")]
    public async Task<ActionResult> GetProduct(string identifier, CancellationToken cancellationToken)
    {
        var products = await _mediator.Send(new CatalogQueries.Products.Query(identifier), cancellationToken);
        return products.Count == 0 ? NotFound() : Ok(products[0]);
    }

    /// <summary>Returns active categories as a recursive tree.</summary>
    [HttpGet("categories/tree")]
    public async Task<ActionResult> GetCategoriesTree(CancellationToken cancellationToken)
    {
        return Ok(await _mediator.Send(new CatalogQueries.CategoriesTree.Query(), cancellationToken));
    }

    /// <summary>Returns active brands.</summary>
    [HttpGet("brands")]
    public async Task<ActionResult> GetBrands(CancellationToken cancellationToken)
    {
        return Ok(await _mediator.Send(new CatalogQueries.Brands.Query(), cancellationToken));
    }

    /// <summary>Returns active product colors.</summary>
    [HttpGet("colors")]
    public async Task<ActionResult> GetColors(CancellationToken cancellationToken)
    {
        return Ok(await _mediator.Send(new CatalogQueries.Colors.Query(), cancellationToken));
    }
}

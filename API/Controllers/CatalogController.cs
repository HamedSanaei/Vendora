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

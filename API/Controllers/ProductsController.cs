using Application.Products;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Exposes public product endpoints.
/// </summary>
public class ProductsController : BaseApiController
{
    /// <summary>
    /// Returns the active product list.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetProducts(CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new List.Query(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Returns one product by slug.
    /// </summary>
    [HttpGet("{slug}")]
    public async Task<ActionResult> GetProduct(string slug, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new Details.Query(slug), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}

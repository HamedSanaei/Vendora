using Application.Carts;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Exposes shopping cart endpoints.
/// </summary>
public class CartsController : BaseApiController
{
    /// <summary>
    /// Returns the current cart for a user.
    /// </summary>
    [HttpGet("{userId:guid}")]
    public async Task<ActionResult> GetCart(Guid userId, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new Get.Query(userId), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Adds an item to a cart.
    /// </summary>
    [HttpPost("{userId:guid}/items")]
    public async Task<ActionResult> AddItem(Guid userId, [FromBody] AddCartItemRequest request, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new AddItem.Command(userId, request.ProductId, request.Quantity), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Removes a cart item.
    /// </summary>
    [HttpDelete("{userId:guid}/items/{productId:guid}")]
    public async Task<ActionResult> RemoveItem(Guid userId, Guid productId, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new RemoveItem.Command(userId, productId), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Clears a user's cart.
    /// </summary>
    [HttpDelete("{userId:guid}/items")]
    public async Task<ActionResult> Clear(Guid userId, CancellationToken cancellationToken)
    {
        await Mediator.Send(new Clear.Command(userId), cancellationToken);
        return NoContent();
    }
}

/// <summary>
/// Represents an add-to-cart request body.
/// </summary>
public sealed record AddCartItemRequest(Guid ProductId, int Quantity);

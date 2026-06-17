using Application.Orders;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Exposes order endpoints.
/// </summary>
public class OrdersController : BaseApiController
{
    /// <summary>
    /// Creates an order from a user's cart.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateOrderRequest request, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(
            new Create.Command(request.UserId, request.ShippingCost, request.DiscountAmount),
            cancellationToken);

        return CreatedAtAction(nameof(GetByOrderNumber), new { orderNumber = result.OrderNumber }, result);
    }

    /// <summary>
    /// Returns orders for a user.
    /// </summary>
    [HttpGet("user/{userId:guid}")]
    public async Task<ActionResult> GetByUser(Guid userId, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new List.Query(userId), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Returns one order by order number.
    /// </summary>
    [HttpGet("{orderNumber}")]
    public async Task<ActionResult> GetByOrderNumber(string orderNumber, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new Details.Query(orderNumber), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}

/// <summary>
/// Represents a create-order request body.
/// </summary>
public sealed record CreateOrderRequest(Guid UserId, decimal ShippingCost, decimal DiscountAmount);

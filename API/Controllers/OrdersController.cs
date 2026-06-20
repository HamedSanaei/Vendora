using System.Security.Claims;
using Application.Orders;
using Application.Orders.DTOs;
using Microsoft.AspNetCore.Authorization;
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
    [Authorize]
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateOrderRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "User token is invalid." });
        }

        OrderDto result;
        try
        {
            result = await Mediator.Send(
                new Create.Command(
                    userId,
                    request.ShippingCost,
                    request.DiscountAmount,
                    request.ShippingAddressId,
                    request.NewAddress is null ? null : new Create.AddressInput(
                        request.NewAddress.Title,
                        request.NewAddress.RecipientName,
                        request.NewAddress.PhoneNumber,
                        request.NewAddress.Province,
                        request.NewAddress.City,
                        request.NewAddress.StreetAddress,
                        request.NewAddress.Plaque,
                        request.NewAddress.Unit,
                        request.NewAddress.PostalCode,
                        request.NewAddress.SaveToAddressBook,
                        request.NewAddress.IsDefault),
                    (request.Items ?? []).Select(item => new Create.ItemInput(item.ProductId, item.Quantity)).ToList()),
                cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }

        return CreatedAtAction(nameof(GetByOrderNumber), new { orderNumber = result.OrderNumber }, result);
    }

    /// <summary>
    /// Returns orders for a user.
    /// </summary>
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult> GetMine(CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "User token is invalid." });
        }

        var result = await Mediator.Send(new List.Query(userId), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Returns one order by order number.
    /// </summary>
    [Authorize]
    [HttpGet("{orderNumber}")]
    public async Task<ActionResult> GetByOrderNumber(string orderNumber, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "User token is invalid." });
        }

        var result = await Mediator.Send(new Details.Query(orderNumber, userId), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        string? userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdValue, out userId);
    }
}

/// <summary>
/// Represents a create-order request body.
/// </summary>
public sealed record CreateOrderRequest(
    decimal ShippingCost,
    decimal DiscountAmount,
    Guid? ShippingAddressId,
    CreateOrderAddressRequest? NewAddress,
    IReadOnlyList<CreateOrderItemRequest> Items);

/// <summary>Represents an order item request body.</summary>
public sealed record CreateOrderItemRequest(Guid ProductId, int Quantity);

/// <summary>Represents a new shipping address request body used during checkout.</summary>
public sealed record CreateOrderAddressRequest(
    string? Title,
    string RecipientName,
    string PhoneNumber,
    string Province,
    string City,
    string StreetAddress,
    string? Plaque,
    string? Unit,
    string PostalCode,
    bool SaveToAddressBook,
    bool IsDefault);

using Application.Orders.DTOs;
using MediatR;
using Persistence.Orders;

namespace Application.Orders;

/// <summary>
/// Returns a single order by public order number.
/// </summary>
public static class Details
{
    /// <summary>
    /// Represents an order details query.
    /// </summary>
    public sealed record Query(string OrderNumber, Guid UserId) : IRequest<OrderDto?>;

    /// <summary>
    /// Handles order details queries.
    /// </summary>
    public sealed class Handler : IRequestHandler<Query, OrderDto?>
    {
        private readonly IOrderRepository _orderRepository;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(IOrderRepository orderRepository)
        {
            _orderRepository = orderRepository;
        }

        /// <inheritdoc />
        public async Task<OrderDto?> Handle(Query request, CancellationToken cancellationToken)
        {
            var order = await _orderRepository.GetByOrderNumberAsync(request.OrderNumber, cancellationToken);
            return order is null || order.UserId != request.UserId ? null : OrderMappings.Map(order);
        }
    }
}

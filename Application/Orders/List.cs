using Application.Orders.DTOs;
using MediatR;
using Persistence.Orders;

namespace Application.Orders;

/// <summary>
/// Returns orders for a user.
/// </summary>
public static class List
{
    /// <summary>
    /// Represents an orders query.
    /// </summary>
    public sealed record Query(Guid UserId) : IRequest<IReadOnlyList<OrderDto>>;

    /// <summary>
    /// Handles orders queries.
    /// </summary>
    public sealed class Handler : IRequestHandler<Query, IReadOnlyList<OrderDto>>
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
        public async Task<IReadOnlyList<OrderDto>> Handle(Query request, CancellationToken cancellationToken)
        {
            var orders = await _orderRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            return orders.Select(OrderMappings.Map).ToList();
        }
    }
}

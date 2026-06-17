using Application.Orders.DTOs;
using Domain.Entities;
using MediatR;
using Persistence.Carts;
using Persistence.Common;
using Persistence.Orders;
using Persistence.Products;

namespace Application.Orders;

/// <summary>
/// Creates an order from a cart.
/// </summary>
public static class Create
{
    /// <summary>
    /// Represents a create-order command.
    /// </summary>
    public sealed record Command(Guid UserId, decimal ShippingCost, decimal DiscountAmount) : IRequest<OrderDto>;

    /// <summary>
    /// Handles create-order commands.
    /// </summary>
    public sealed class Handler : IRequestHandler<Command, OrderDto>
    {
        private readonly ICartRepository _cartRepository;
        private readonly IOrderRepository _orderRepository;
        private readonly IProductReadRepository _productReadRepository;
        private readonly IUnitOfWork _unitOfWork;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(
            ICartRepository cartRepository,
            IOrderRepository orderRepository,
            IProductReadRepository productReadRepository,
            IUnitOfWork unitOfWork)
        {
            _cartRepository = cartRepository;
            _orderRepository = orderRepository;
            _productReadRepository = productReadRepository;
            _unitOfWork = unitOfWork;
        }

        /// <inheritdoc />
        public async Task<OrderDto> Handle(Command request, CancellationToken cancellationToken)
        {
            var cart = await _cartRepository.GetByUserIdAsync(request.UserId, cancellationToken)
                ?? throw new InvalidOperationException("Cart was not found.");

            if (cart.Items.Count == 0)
            {
                throw new InvalidOperationException("Cart is empty.");
            }

            var order = new Order
            {
                UserId = request.UserId,
                OrderNumber = $"ORD-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}"[..28],
                ShippingCost = request.ShippingCost,
                DiscountAmount = request.DiscountAmount
            };

            foreach (var cartItem in cart.Items)
            {
                var product = await _productReadRepository.GetActiveProductByIdAsync(cartItem.ProductId, cancellationToken)
                    ?? throw new InvalidOperationException($"Product {cartItem.ProductId} was not found.");

                if (product.StockQuantity < cartItem.Quantity)
                {
                    throw new InvalidOperationException($"Product {product.Title} does not have enough stock.");
                }

                product.StockQuantity -= cartItem.Quantity;

                order.Items.Add(new OrderItem
                {
                    ProductId = product.Id,
                    ProductTitle = product.Title,
                    UnitPrice = product.Price,
                    Quantity = cartItem.Quantity
                });
            }

            order.RecalculateTotals();

            await _orderRepository.AddAsync(order, cancellationToken);
            _cartRepository.ClearItems(cart);
            cart.Touch();
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return OrderMappings.Map(order);
        }
    }
}

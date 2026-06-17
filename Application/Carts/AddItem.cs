using Application.Carts.DTOs;
using Domain.Entities;
using MediatR;
using Persistence.Carts;
using Persistence.Common;
using Persistence.Products;

namespace Application.Carts;

/// <summary>
/// Adds an item to a user's cart.
/// </summary>
public static class AddItem
{
    /// <summary>
    /// Represents an add-to-cart command.
    /// </summary>
    public sealed record Command(Guid UserId, Guid ProductId, int Quantity) : IRequest<CartDto>;

    /// <summary>
    /// Handles add-to-cart commands.
    /// </summary>
    public sealed class Handler : IRequestHandler<Command, CartDto>
    {
        private readonly ICartRepository _cartRepository;
        private readonly IProductReadRepository _productReadRepository;
        private readonly IUnitOfWork _unitOfWork;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(ICartRepository cartRepository, IProductReadRepository productReadRepository, IUnitOfWork unitOfWork)
        {
            _cartRepository = cartRepository;
            _productReadRepository = productReadRepository;
            _unitOfWork = unitOfWork;
        }

        /// <inheritdoc />
        public async Task<CartDto> Handle(Command request, CancellationToken cancellationToken)
        {
            if (request.Quantity <= 0)
            {
                throw new InvalidOperationException("Quantity must be greater than zero.");
            }

            var product = await _productReadRepository.GetActiveProductByIdAsync(request.ProductId, cancellationToken)
                ?? throw new InvalidOperationException("Product was not found.");

            if (product.StockQuantity < request.Quantity)
            {
                throw new InvalidOperationException("Requested quantity is not available.");
            }

            var cart = await _cartRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (cart is null)
            {
                cart = new Cart { UserId = request.UserId };
                await _cartRepository.AddAsync(cart, cancellationToken);
            }

            var existingItem = cart.Items.FirstOrDefault(item => item.ProductId == request.ProductId);
            if (existingItem is null)
            {
                cart.Items.Add(new CartItem
                {
                    CartId = cart.Id,
                    ProductId = product.Id,
                    ProductTitle = product.Title,
                    UnitPrice = product.Price,
                    Quantity = request.Quantity
                });
            }
            else
            {
                int newQuantity = existingItem.Quantity + request.Quantity;
                if (product.StockQuantity < newQuantity)
                {
                    throw new InvalidOperationException("Requested quantity is not available.");
                }

                existingItem.Quantity = newQuantity;
                existingItem.UnitPrice = product.Price;
                existingItem.ProductTitle = product.Title;
            }

            cart.Touch();
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return CartMappings.Map(cart);
        }
    }
}

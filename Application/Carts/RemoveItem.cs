using Application.Carts.DTOs;
using MediatR;
using Persistence.Carts;
using Persistence.Common;

namespace Application.Carts;

/// <summary>
/// Removes an item from a user's cart.
/// </summary>
public static class RemoveItem
{
    /// <summary>
    /// Represents a remove-from-cart command.
    /// </summary>
    public sealed record Command(Guid UserId, Guid ProductId) : IRequest<CartDto?>;

    /// <summary>
    /// Handles remove-from-cart commands.
    /// </summary>
    public sealed class Handler : IRequestHandler<Command, CartDto?>
    {
        private readonly ICartRepository _cartRepository;
        private readonly IUnitOfWork _unitOfWork;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(ICartRepository cartRepository, IUnitOfWork unitOfWork)
        {
            _cartRepository = cartRepository;
            _unitOfWork = unitOfWork;
        }

        /// <inheritdoc />
        public async Task<CartDto?> Handle(Command request, CancellationToken cancellationToken)
        {
            var cart = await _cartRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (cart is null)
            {
                return null;
            }

            var item = cart.Items.FirstOrDefault(cartItem => cartItem.ProductId == request.ProductId);
            if (item is null)
            {
                return CartMappings.Map(cart);
            }

            cart.Items.Remove(item);
            cart.Touch();
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return CartMappings.Map(cart);
        }
    }
}

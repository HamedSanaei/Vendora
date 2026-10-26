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
        private readonly Persistence.AppDbContext _db;
        private readonly IUnitOfWork _unitOfWork;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(ICartRepository cartRepository, IUnitOfWork unitOfWork, Persistence.AppDbContext db)
        {
            _cartRepository = cartRepository; _db = db;
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
                return await CartMappings.MapAsync(cart, _db, cancellationToken);
            }

            cart.Items.Remove(item);
            cart.Touch();
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return await CartMappings.MapAsync(cart, _db, cancellationToken);
        }
    }
}

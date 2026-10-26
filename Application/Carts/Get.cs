using Application.Carts.DTOs;
using MediatR;
using Persistence.Carts;

namespace Application.Carts;

/// <summary>
/// Returns the current cart for a user.
/// </summary>
public static class Get
{
    /// <summary>
    /// Represents a cart query.
    /// </summary>
    public sealed record Query(Guid UserId) : IRequest<CartDto?>;

    /// <summary>
    /// Handles cart queries.
    /// </summary>
    public sealed class Handler : IRequestHandler<Query, CartDto?>
    {
        private readonly ICartRepository _cartRepository;
        private readonly Persistence.AppDbContext _db;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(ICartRepository cartRepository, Persistence.AppDbContext db)
        {
            _cartRepository = cartRepository; _db = db;
        }

        /// <inheritdoc />
        public async Task<CartDto?> Handle(Query request, CancellationToken cancellationToken)
        {
            var cart = await _cartRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            return cart is null ? null : await CartMappings.MapAsync(cart, _db, cancellationToken);
        }
    }
}

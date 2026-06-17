using MediatR;
using Persistence.Carts;
using Persistence.Common;

namespace Application.Carts;

/// <summary>
/// Clears all items from a cart.
/// </summary>
public static class Clear
{
    /// <summary>
    /// Represents a clear-cart command.
    /// </summary>
    public sealed record Command(Guid UserId) : IRequest<Unit>;

    /// <summary>
    /// Handles clear-cart commands.
    /// </summary>
    public sealed class Handler : IRequestHandler<Command, Unit>
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
        public async Task<Unit> Handle(Command request, CancellationToken cancellationToken)
        {
            var cart = await _cartRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (cart is null)
            {
                return Unit.Value;
            }

            _cartRepository.ClearItems(cart);
            cart.Touch();
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return Unit.Value;
        }
    }
}

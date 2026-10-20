using Application.Products.DTOs;
using Application.Interfaces;
using MediatR;
using Persistence.Products;

namespace Application.Products;

/// <summary>
/// Returns one product for admin editing.
/// </summary>
public static class DetailsAdmin
{
    /// <summary>Represents the details query.</summary>
    public sealed record Query(Guid Id) : IRequest<AdminProductDto?>;

    /// <summary>Handles admin product details queries.</summary>
    public sealed class Handler : IRequestHandler<Query, AdminProductDto?>
    {
        private readonly IProductAdminRepository _repository;
        private readonly IProductDescriptionService _descriptions;

        /// <summary>Creates the handler.</summary>
        public Handler(IProductAdminRepository repository, IProductDescriptionService descriptions)
        {
            _repository = repository;
            _descriptions = descriptions;
        }

        /// <inheritdoc />
        public async Task<AdminProductDto?> Handle(Query request, CancellationToken cancellationToken)
        {
            var product = await _repository.GetProductAsync(request.Id, trackChanges: false, cancellationToken);
            return product is null ? null : AdminProductMappings.MapProduct(product) with { Description = _descriptions.Sanitize(product.Description) };
        }
    }
}

using Application.Products.DTOs;
using MediatR;
using Persistence.Products;

namespace Application.Products;

/// <summary>
/// Lists products for admin catalog management.
/// </summary>
public static class ListAdmin
{
    /// <summary>
    /// Represents an admin product list query.
    /// </summary>
    public sealed record Query : IRequest<IReadOnlyList<AdminProductDto>>;

    /// <summary>
    /// Handles admin product list queries.
    /// </summary>
    public sealed class Handler : IRequestHandler<Query, IReadOnlyList<AdminProductDto>>
    {
        private readonly IProductAdminRepository _productAdminRepository;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(IProductAdminRepository productAdminRepository)
        {
            _productAdminRepository = productAdminRepository;
        }

        /// <inheritdoc />
        public async Task<IReadOnlyList<AdminProductDto>> Handle(Query request, CancellationToken cancellationToken)
        {
            var products = await _productAdminRepository.GetProductsAsync(cancellationToken);
            return products.Select(AdminProductMappings.MapProduct).ToList();
        }
    }
}

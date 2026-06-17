using Application.Products.DTOs;
using Domain.Entities;
using MediatR;
using Persistence.Products;

namespace Application.Products;

/// <summary>
/// Lists active products for the storefront.
/// </summary>
public static class List
{
    /// <summary>
    /// Represents a product list query.
    /// </summary>
    public sealed record Query : IRequest<IReadOnlyList<ProductListItemDto>>;

    /// <summary>
    /// Handles product list queries.
    /// </summary>
    public sealed class Handler : IRequestHandler<Query, IReadOnlyList<ProductListItemDto>>
    {
        private readonly IProductReadRepository _productReadRepository;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(IProductReadRepository productReadRepository)
        {
            _productReadRepository = productReadRepository;
        }

        /// <inheritdoc />
        public async Task<IReadOnlyList<ProductListItemDto>> Handle(Query request, CancellationToken cancellationToken)
        {
            var products = await _productReadRepository.GetActiveProductsAsync(cancellationToken);
            return products.Select(MapListItem).ToList();
        }

        internal static ProductListItemDto MapListItem(Product product)
        {
            return new ProductListItemDto(
                product.Id,
                product.Title,
                product.Slug,
                product.Price,
                product.StockQuantity,
                product.Category?.Name,
                product.Images
                    .OrderBy(image => image.SortOrder)
                    .Select(image => image.ImageUrl)
                    .FirstOrDefault());
        }
    }
}

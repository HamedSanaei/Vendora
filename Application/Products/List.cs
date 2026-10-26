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
        private readonly Persistence.AppDbContext _db;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(IProductReadRepository productReadRepository, Persistence.AppDbContext db)
        {
            _productReadRepository = productReadRepository; _db = db;
        }

        /// <inheritdoc />
        public async Task<IReadOnlyList<ProductListItemDto>> Handle(Query request, CancellationToken cancellationToken)
        {
            var products = await _productReadRepository.GetActiveProductsAsync(cancellationToken);
            var policy = await Application.Shipping.ShippingPricing.ReadAsync(_db, cancellationToken);
            return products.Select(p => MapListItem(p, policy)).ToList();
        }

        internal static ProductListItemDto MapListItem(Product product, ShippingPolicy policy)
        {
            return new ProductListItemDto(
                product.Id,
                product.Title,
                product.Slug,
                policy.SellingPrice(product.Price),
                product.StockQuantity,
                product.Category?.Name,
                product.Images
                    .OrderBy(image => image.SortOrder)
                    .Select(image => image.ImageUrl)
                    .FirstOrDefault(),
                product.ProductCode, product.Price, policy.IncludedInPrice ? policy.UnitAmount : 0, policy.Version, policy.IncludedInPrice);
        }
    }
}

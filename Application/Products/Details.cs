using Application.Products.DTOs;
using MediatR;
using Persistence.Products;

namespace Application.Products;

/// <summary>
/// Returns a product detail by slug.
/// </summary>
public static class Details
{
    /// <summary>
    /// Represents a product details query.
    /// </summary>
    public sealed record Query(string Slug) : IRequest<ProductDetailDto?>;

    /// <summary>
    /// Handles product details queries.
    /// </summary>
    public sealed class Handler : IRequestHandler<Query, ProductDetailDto?>
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
        public async Task<ProductDetailDto?> Handle(Query request, CancellationToken cancellationToken)
        {
            var product = await _productReadRepository.GetActiveProductBySlugAsync(request.Slug, cancellationToken);
            if (product is null)
            {
                return null;
            }

            return new ProductDetailDto(
                product.Id,
                product.Title,
                product.Slug,
                product.Description,
                product.Price,
                product.StockQuantity,
                product.Category?.Name,
                product.Images
                    .OrderBy(image => image.SortOrder)
                    .Select(image => new ProductImageDto(
                        image.Id,
                        image.ImageUrl,
                        image.AltText,
                        image.IsPrimary,
                        image.SortOrder))
                    .ToList());
        }
    }
}

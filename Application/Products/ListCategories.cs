using Application.Products.DTOs;
using MediatR;
using Persistence.Products;

namespace Application.Products;

/// <summary>
/// Lists categories for admin product forms.
/// </summary>
public static class ListCategories
{
    /// <summary>
    /// Represents an admin category list query.
    /// </summary>
    public sealed record Query : IRequest<IReadOnlyList<AdminCategoryDto>>;

    /// <summary>
    /// Handles admin category list queries.
    /// </summary>
    public sealed class Handler : IRequestHandler<Query, IReadOnlyList<AdminCategoryDto>>
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
        public async Task<IReadOnlyList<AdminCategoryDto>> Handle(Query request, CancellationToken cancellationToken)
        {
            var categories = await _productAdminRepository.GetCategoriesAsync(cancellationToken);
            return categories
                .Select(category => new AdminCategoryDto(category.Id, category.Name, category.Slug, category.ParentCategoryId))
                .ToList();
        }
    }
}

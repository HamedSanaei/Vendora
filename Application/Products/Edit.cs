using Application.Interfaces;
using Application.Products.DTOs;
using Domain.Common;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Persistence.Common;
using Persistence.Products;

namespace Application.Products;

/// <summary>
/// Updates a product from the admin panel.
/// </summary>
public static class Edit
{
    private const long MaxImageBytes = 5 * 1024 * 1024;
    private const int MaxProductImages = 10;
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp"
    };

    /// <summary>Represents an edit product command.</summary>
    public sealed record Command(
        Guid Id,
        string Title,
        string? Slug,
        string? Description,
        decimal Price,
        int StockQuantity,
        Guid? CategoryId,
        IReadOnlyList<Guid> CategoryIds,
        Guid? BrandId,
        ProductStatus Status,
        IReadOnlyList<Guid> ColorIds,
        IReadOnlyList<Guid> DeletedImageIds,
        Guid? PrimaryImageId,
        IReadOnlyList<ProductImageUpload> Images,
        int? PrimaryNewImageIndex) : IRequest<Result>;

    /// <summary>Represents the edit product result.</summary>
    public sealed record Result(EditFailure Failure, string? Error, AdminProductDto? Product)
    {
        /// <summary>Returns whether the command succeeded.</summary>
        public bool Succeeded => Failure == EditFailure.None;
    }

    /// <summary>Identifies why editing failed.</summary>
    public enum EditFailure
    {
        None = 0,
        NotFound = 1,
        Validation = 2,
        DuplicateSlug = 3,
        CategoryNotFound = 4,
        BrandNotFound = 5,
        ColorNotFound = 6
    }

    /// <summary>Handles edit product commands.</summary>
    public sealed class Handler : IRequestHandler<Command, Result>
    {
        private readonly IProductAdminRepository _repository;
        private readonly IProductImageStorage _imageStorage;
        private readonly IUnitOfWork _unitOfWork;

        /// <summary>Creates the handler.</summary>
        public Handler(IProductAdminRepository repository, IProductImageStorage imageStorage, IUnitOfWork unitOfWork)
        {
            _repository = repository;
            _imageStorage = imageStorage;
            _unitOfWork = unitOfWork;
        }

        /// <inheritdoc />
        public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
        {
            var product = await _repository.GetProductAsync(request.Id, trackChanges: true, cancellationToken);
            if (product is null)
            {
                return new Result(EditFailure.NotFound, "Product was not found.", null);
            }

            string title = request.Title.Trim();
            if (string.IsNullOrWhiteSpace(title))
            {
                return Invalid("Product title is required.");
            }

            if (request.Price <= 0)
            {
                return Invalid("Product price must be greater than zero.");
            }

            if (request.StockQuantity < 0)
            {
                return Invalid("Product stock quantity cannot be negative.");
            }

            if (request.Images.Count > MaxProductImages)
            {
                return Invalid($"A product can have at most {MaxProductImages} images.");
            }

            int remainingExistingImages = product.Images.Count(image => !request.DeletedImageIds.Contains(image.Id));
            if (remainingExistingImages + request.Images.Count > MaxProductImages)
            {
                return Invalid($"A product can have at most {MaxProductImages} images.");
            }

            foreach (var image in request.Images)
            {
                if (image.Length > MaxImageBytes || !AllowedContentTypes.Contains(image.ContentType))
                {
                    return Invalid("Only JPG, PNG, and WebP images up to 5MB are allowed.");
                }
            }

            string slug = SlugHelper.ToSlug(string.IsNullOrWhiteSpace(request.Slug) ? title : request.Slug);
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Invalid("Product slug could not be generated.");
            }

            if (await _repository.SlugExistsAsync(slug, request.Id, cancellationToken))
            {
                return new Result(EditFailure.DuplicateSlug, "A product with this slug already exists.", null);
            }

            var categoryIds = ResolveCategoryIds(request.CategoryId, request.CategoryIds);
            if (!await _repository.CategoriesExistAsync(categoryIds, cancellationToken))
            {
                return new Result(EditFailure.CategoryNotFound, "One or more selected categories do not exist.", null);
            }

            if (request.BrandId.HasValue && !await _repository.BrandExistsAsync(request.BrandId.Value, cancellationToken))
            {
                return new Result(EditFailure.BrandNotFound, "The selected brand does not exist.", null);
            }

            if (!await _repository.ColorsExistAsync(request.ColorIds, cancellationToken))
            {
                return new Result(EditFailure.ColorNotFound, "One or more selected colors do not exist.", null);
            }

            product.Title = title;
            product.Slug = slug;
            product.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            product.Price = request.Price;
            product.StockQuantity = request.StockQuantity;
            product.CategoryId = categoryIds.FirstOrDefault();
            product.BrandId = request.BrandId;
            product.Status = request.Status;
            product.InventoryStatus = ResolveInventoryStatus(request.StockQuantity);
            _repository.ReplaceCategories(product, categoryIds);
            _repository.ReplaceColors(product, request.ColorIds);

            _repository.RemoveImages(product, request.DeletedImageIds);

            Guid? primaryNewImageId = null;
            int sortOrder = product.Images.Count == 0 ? 1 : product.Images.Max(image => image.SortOrder) + 1;
            for (int index = 0; index < request.Images.Count; index++)
            {
                var storedImage = await _imageStorage.SaveAsync(request.Images[index], cancellationToken);
                var image = new ProductImage
                {
                    ImageUrl = storedImage.Url,
                    AltText = product.Title,
                    IsPrimary = request.PrimaryNewImageIndex == index,
                    SortOrder = sortOrder + index
                };
                if (image.IsPrimary)
                {
                    primaryNewImageId = image.Id;
                }

                product.Images.Add(image);
            }

            NormalizePrimaryImage(product, request.PrimaryImageId, primaryNewImageId);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return new Result(EditFailure.None, null, AdminProductMappings.MapProduct(product));
        }

        private static Result Invalid(string error)
        {
            return new Result(EditFailure.Validation, error, null);
        }

        private static InventoryStatus ResolveInventoryStatus(int stockQuantity)
        {
            if (stockQuantity <= 0)
            {
                return InventoryStatus.OutOfStock;
            }

            return stockQuantity < 8 ? InventoryStatus.LowStock : InventoryStatus.InStock;
        }

        private static IReadOnlyList<Guid> ResolveCategoryIds(Guid? categoryId, IReadOnlyCollection<Guid> categoryIds)
        {
            return categoryIds
                .Concat(categoryId.HasValue ? new[] { categoryId.Value } : Array.Empty<Guid>())
                .Distinct()
                .ToList();
        }

        private static void NormalizePrimaryImage(Product product, Guid? primaryImageId, Guid? primaryNewImageId)
        {
            if (product.Images.Count == 0)
            {
                return;
            }

            bool matchedExisting = primaryImageId.HasValue && product.Images.Any(image => image.Id == primaryImageId.Value);
            bool matchedNew = primaryNewImageId.HasValue && product.Images.Any(image => image.Id == primaryNewImageId.Value);

            foreach (var image in product.Images)
            {
                image.AltText = product.Title;
                if (matchedExisting)
                {
                    image.IsPrimary = image.Id == primaryImageId;
                }
                else if (matchedNew)
                {
                    image.IsPrimary = image.Id == primaryNewImageId;
                }
            }

            if (!matchedExisting && !matchedNew)
            {
                product.Images.OrderBy(image => image.SortOrder).First().IsPrimary = true;
            }
        }
    }
}

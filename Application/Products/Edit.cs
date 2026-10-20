using Application.Interfaces;
using Application.Products.DTOs;
using Domain.Common;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Persistence.Common;
using Persistence.Products;
using Persistence;
using Application.Pricing;
using Microsoft.EntityFrameworkCore;
using Application.Seo;

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
        int? PrimaryNewImageIndex,
        decimal? UsdPrice = null,
        IReadOnlyList<ProductAttributeInput>? Attributes = null,
        SeoInput? Seo = null,
        IReadOnlyList<ImageAltInput>? ImageAlts = null,
        IReadOnlyList<string>? NewImageAlts = null) : IRequest<Result>;

    /// <summary>Explicit alt updates leave other persisted image descriptions untouched.</summary>
    public sealed record ImageAltInput(Guid Id, string Alt);

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
        private readonly AppDbContext _db;
        private readonly IProductDescriptionService _descriptions;

        /// <summary>Creates the handler.</summary>
        public Handler(IProductAdminRepository repository, IProductImageStorage imageStorage, IUnitOfWork unitOfWork, AppDbContext db, IProductDescriptionService descriptions)
        {
            _repository = repository;
            _imageStorage = imageStorage;
            _unitOfWork = unitOfWork;
            _db = db;
            _descriptions = descriptions;
        }

        /// <inheritdoc />
        public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
        {
            if (SeoMapping.Validate(request.Seo) is string seoError) return Invalid(seoError);
            if (request.ImageAlts?.Any(x => x is null || x.Alt is null || x.Alt.Length > 250) == true
                || request.NewImageAlts?.Any(x => x is null || x.Length > 250) == true) return Invalid("Image alternate text must be at most 250 characters.");
            if (request.Description?.Length > Product.MaxDescriptionLength)
                return Invalid($"Product description must be {Product.MaxDescriptionLength} characters or fewer.");
            string? description = _descriptions.Sanitize(request.Description);
            if (description?.Length > Product.MaxDescriptionLength)
                return Invalid($"Product description must be {Product.MaxDescriptionLength} characters or fewer.");
            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
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

            if (!request.UsdPrice.HasValue && request.Price <= 0)
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
            if (await SeoWriter.ReservedAsync(_db, "product", slug, product.Id, cancellationToken)) return Invalid("This slug is reserved by an existing product URL.");
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

            var attributes = await ProductAttributeWriter.ResolveAsync(_db, request.Attributes, product, cancellationToken);
            if (attributes.Error is not null) return Invalid(attributes.Error);
            if (attributes.Attributes is not null)
            {
                _db.ProductAttributes.RemoveRange(product.Attributes);
                product.Attributes = attributes.Attributes;
                // Explicit Added state avoids treating preassigned GUIDs as existing rows on a tracked product.
                _db.ProductAttributes.AddRange(product.Attributes);
            }

            product.Title = title;
            await SeoWriter.RememberAsync(_db, "product", product.Id, product.Slug, slug, cancellationToken);
            product.Slug = slug;
            product.Description = description;
            var pricingError = await ProductPriceWriter.ApplyAsync(_db, product, request.Price, request.UsdPrice, cancellationToken);
            if (pricingError is not null) return Invalid(pricingError);
            product.StockQuantity = request.StockQuantity;
            product.CategoryId = request.CategoryId ?? (categoryIds.Count > 0 ? categoryIds[0] : null);
            product.BrandId = request.BrandId;
            product.Status = request.Status;
            product.InventoryStatus = ResolveInventoryStatus(request.StockQuantity);
            _repository.ReplaceCategories(product, categoryIds);
            _repository.ReplaceColors(product, request.ColorIds);

            _repository.RemoveImages(product, request.DeletedImageIds);
            foreach (var alt in request.ImageAlts ?? [])
            {
                var existingImage = product.Images.SingleOrDefault(x => x.Id == alt.Id);
                if (existingImage is null) return Invalid("Image alternate text references an unknown image.");
                existingImage.AltText = alt.Alt.Trim();
            }

            Guid? primaryNewImageId = null;
            int sortOrder = product.Images.Count == 0 ? 1 : product.Images.Max(image => image.SortOrder) + 1;
            for (int index = 0; index < request.Images.Count; index++)
            {
                var storedImage = await _imageStorage.SaveAsync(request.Images[index], cancellationToken);
                var image = new ProductImage
                {
                    ImageUrl = storedImage.Url,
                    AltText = request.NewImageAlts?.ElementAtOrDefault(index)?.Trim() ?? product.Title,
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

            product.Seo = await SeoWriter.AssessAsync(_db, new("product", product.Id, product.Title, product.Slug, product.Description, request.Seo,
                product.Images.Select(x => new SeoImage(x.ImageUrl, x.AltText)).ToList()), product.Seo, _descriptions, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _db.CartItems.Where(item => item.ProductId == product.Id)
                .ExecuteUpdateAsync(update => update.SetProperty(item => item.UnitPrice, product.Price), cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            var saved = await _repository.GetProductAsync(product.Id, trackChanges: false, cancellationToken);
            return new Result(EditFailure.None, null, AdminProductMappings.MapProduct(saved!));
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

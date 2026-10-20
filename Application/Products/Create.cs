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
using Application.Seo;

namespace Application.Products;

/// <summary>
/// Creates a product from the admin panel.
/// </summary>
public static class Create
{
    private const long MaxImageBytes = 5 * 1024 * 1024;
    private const int MaxProductImages = 10;
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp"
    };

    /// <summary>
    /// Represents a create-product command.
    /// </summary>
    public sealed record Command(
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
        IReadOnlyList<ProductImageUpload> Images,
        int? PrimaryNewImageIndex,
        decimal? UsdPrice = null,
        IReadOnlyList<ProductAttributeInput>? Attributes = null,
        SeoInput? Seo = null,
        IReadOnlyList<string>? NewImageAlts = null) : IRequest<Result>;

    /// <summary>
    /// Represents the create-product outcome.
    /// </summary>
    public sealed record Result(CreateFailure Failure, string? Error, AdminProductDto? Product)
    {
        /// <summary>
        /// Returns whether the command succeeded.
        /// </summary>
        public bool Succeeded => Failure == CreateFailure.None;
    }

    /// <summary>
    /// Identifies why product creation failed.
    /// </summary>
    public enum CreateFailure
    {
        None = 0,
        Validation = 1,
        DuplicateSlug = 2,
        CategoryNotFound = 3,
        BrandNotFound = 4,
        ColorNotFound = 5
    }

    /// <summary>
    /// Handles create-product commands.
    /// </summary>
    public sealed class Handler : IRequestHandler<Command, Result>
    {
        private readonly IProductAdminRepository _productAdminRepository;
        private readonly IProductImageStorage _productImageStorage;
        private readonly IUnitOfWork _unitOfWork;
        private readonly AppDbContext _db;
        private readonly IProductDescriptionService _descriptions;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(
            IProductAdminRepository productAdminRepository,
            IProductImageStorage productImageStorage,
            IUnitOfWork unitOfWork,
            AppDbContext db, IProductDescriptionService descriptions)
        {
            _productAdminRepository = productAdminRepository;
            _productImageStorage = productImageStorage;
            _unitOfWork = unitOfWork;
            _db = db;
            _descriptions = descriptions;
        }

        /// <inheritdoc />
        public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
        {
            string title = request.Title.Trim();
            if (SeoMapping.Validate(request.Seo) is string seoError) return Invalid(seoError);
            if (request.NewImageAlts?.Any(x => x is null || x.Length > 250) == true) return Invalid("Image alternate text must be at most 250 characters.");
            if (request.Description?.Length > Product.MaxDescriptionLength)
                return Invalid($"Product description must be {Product.MaxDescriptionLength} characters or fewer.");
            string? description = _descriptions.Sanitize(request.Description);
            if (description?.Length > Product.MaxDescriptionLength)
                return Invalid($"Product description must be {Product.MaxDescriptionLength} characters or fewer.");
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

            foreach (var image in request.Images)
            {
                if (image.Length > MaxImageBytes)
                {
                    return Invalid("Each product image must be 5MB or smaller.");
                }

                if (!AllowedContentTypes.Contains(image.ContentType))
                {
                    return Invalid("Only JPG, PNG, and WebP product images are allowed.");
                }
            }

            string slug = SlugHelper.ToSlug(string.IsNullOrWhiteSpace(request.Slug) ? title : request.Slug);
            if (string.IsNullOrWhiteSpace(slug))
            {
                return Invalid("Product slug could not be generated.");
            }

            if (await _productAdminRepository.SlugExistsAsync(slug, cancellationToken: cancellationToken))
            {
                return new Result(CreateFailure.DuplicateSlug, "A product with this slug already exists.", null);
            }
            if (await SeoWriter.ReservedAsync(_db, "product", slug, null, cancellationToken)) return Invalid("This slug is reserved by an existing product URL.");

            var categoryIds = ResolveCategoryIds(request.CategoryId, request.CategoryIds);
            if (!await _productAdminRepository.CategoriesExistAsync(categoryIds, cancellationToken))
            {
                return new Result(CreateFailure.CategoryNotFound, "One or more selected categories do not exist.", null);
            }

            if (request.BrandId.HasValue
                && !await _productAdminRepository.BrandExistsAsync(request.BrandId.Value, cancellationToken))
            {
                return new Result(CreateFailure.BrandNotFound, "The selected brand does not exist.", null);
            }

            if (!await _productAdminRepository.ColorsExistAsync(request.ColorIds, cancellationToken))
            {
                return new Result(CreateFailure.ColorNotFound, "One or more selected colors do not exist.", null);
            }

            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            var attributes = await ProductAttributeWriter.ResolveAsync(_db, request.Attributes, null, cancellationToken);
            if (attributes.Error is not null) return Invalid(attributes.Error);
            var product = new Product
            {
                Title = title,
                Attributes = attributes.Attributes ?? [],
                Slug = slug,
                Description = description,
                Price = request.Price,
                StockQuantity = request.StockQuantity,
                CategoryId = request.CategoryId ?? (categoryIds.Count > 0 ? categoryIds[0] : null),
                BrandId = request.BrandId,
                Status = request.Status,
                InventoryStatus = ResolveInventoryStatus(request.StockQuantity),
                Categories = categoryIds
                    .Select(categoryId => new ProductCategory { CategoryId = categoryId })
                    .ToList(),
                Colors = request.ColorIds
                    .Distinct()
                    .Select(colorId => new ProductColor { CatalogColorId = colorId })
                    .ToList()
            };

            var pricingError = await ProductPriceWriter.ApplyAsync(_db, product, request.Price, request.UsdPrice, cancellationToken);
            if (pricingError is not null) return Invalid(pricingError);

            for (int index = 0; index < request.Images.Count; index++)
            {
                var storedImage = await _productImageStorage.SaveAsync(request.Images[index], cancellationToken);
                product.Images.Add(new ProductImage
                {
                    ImageUrl = storedImage.Url,
                    AltText = request.NewImageAlts?.ElementAtOrDefault(index)?.Trim() ?? product.Title,
                    IsPrimary = request.PrimaryNewImageIndex == index || (!request.PrimaryNewImageIndex.HasValue && index == 0),
                    SortOrder = index + 1
                });
            }

            if (product.Images.Count > 0 && product.Images.All(image => !image.IsPrimary))
            {
                product.Images.OrderBy(image => image.SortOrder).First().IsPrimary = true;
            }

            product.Seo = await SeoWriter.AssessAsync(_db, new("product", product.Id, product.Title, product.Slug, product.Description, request.Seo,
                product.Images.Select(x => new SeoImage(x.ImageUrl, x.AltText)).ToList()), null, _descriptions, cancellationToken);
            await _productAdminRepository.AddAsync(product, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var saved = await _productAdminRepository.GetProductAsync(product.Id, trackChanges: false, cancellationToken);
            return new Result(CreateFailure.None, null, AdminProductMappings.MapProduct(saved!));
        }

        private static Result Invalid(string error)
        {
            return new Result(CreateFailure.Validation, error, null);
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
    }
}

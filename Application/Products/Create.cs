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
        int? PrimaryNewImageIndex) : IRequest<Result>;

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

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(
            IProductAdminRepository productAdminRepository,
            IProductImageStorage productImageStorage,
            IUnitOfWork unitOfWork)
        {
            _productAdminRepository = productAdminRepository;
            _productImageStorage = productImageStorage;
            _unitOfWork = unitOfWork;
        }

        /// <inheritdoc />
        public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
        {
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

            var product = new Product
            {
                Title = title,
                Slug = slug,
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                Price = request.Price,
                StockQuantity = request.StockQuantity,
                CategoryId = categoryIds.FirstOrDefault(),
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

            for (int index = 0; index < request.Images.Count; index++)
            {
                var storedImage = await _productImageStorage.SaveAsync(request.Images[index], cancellationToken);
                product.Images.Add(new ProductImage
                {
                    ImageUrl = storedImage.Url,
                    AltText = product.Title,
                    IsPrimary = request.PrimaryNewImageIndex == index || (!request.PrimaryNewImageIndex.HasValue && index == 0),
                    SortOrder = index + 1
                });
            }

            if (product.Images.Count > 0 && product.Images.All(image => !image.IsPrimary))
            {
                product.Images.OrderBy(image => image.SortOrder).First().IsPrimary = true;
            }

            await _productAdminRepository.AddAsync(product, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new Result(CreateFailure.None, null, AdminProductMappings.MapProduct(product));
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

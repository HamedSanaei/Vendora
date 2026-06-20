using Application.Admin;
using Application.Admin.DTOs;
using Application.Interfaces;
using Application.Products;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Exposes development-stage admin endpoints.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = "AdminOnly")]
public sealed class AdminController : ControllerBase
{
    private const long MaxImageBytes = 5 * 1024 * 1024;
    private const int MaxProductImages = 10;
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp"
    };

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    };

    private readonly ISender _mediator;

    /// <summary>
    /// Creates the admin controller.
    /// </summary>
    /// <param name="mediator">The mediator for application use cases.</param>
    public AdminController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Returns all products for admin management screens.
    /// </summary>
    [HttpGet("products")]
    public async Task<ActionResult> GetProducts(CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new ListAdmin.Query(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Returns one product for admin editing.
    /// </summary>
    [HttpGet("products/{id:guid}")]
    public async Task<ActionResult> GetProduct(Guid id, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new DetailsAdmin.Query(id), cancellationToken);
        return result is null ? NotFound(new { message = "Product was not found." }) : Ok(result);
    }

    /// <summary>
    /// Returns category options for admin product forms.
    /// </summary>
    [HttpGet("categories")]
    public async Task<ActionResult> GetCategories(CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new ListCategories.Query(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Creates a product from a multipart admin form.
    /// </summary>
    [HttpPost("products")]
    [RequestSizeLimit(30 * 1024 * 1024)]
    public async Task<ActionResult> CreateProduct(
        [FromForm] CreateAdminProductRequest request,
        CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        if (!TryParseStatus(request.Status, out var productStatus))
        {
            return BadRequest(new { message = "Product status must be Draft, Active, or Archived." });
        }

        var imageValidationError = ValidateImages(request.Images);
        if (imageValidationError is not null)
        {
            return BadRequest(new { message = imageValidationError });
        }

        var uploads = request.Images
            .Select(file => new ProductImageUpload(
                file.FileName,
                file.ContentType,
                file.Length,
                file.OpenReadStream))
            .ToList();

        var result = await _mediator.Send(
            new Create.Command(
                request.Title,
                request.Slug,
                request.Description,
                request.Price,
                request.StockQuantity,
                request.CategoryId,
                request.CategoryIds,
                request.BrandId,
                productStatus,
                request.ColorIds,
                uploads,
                request.PrimaryNewImageIndex),
            cancellationToken);

        if (result.Succeeded)
        {
            return Created($"/api/admin/products/{result.Product!.Id}", result.Product);
        }

        return result.Failure switch
        {
            Create.CreateFailure.DuplicateSlug => Conflict(new { message = result.Error }),
            Create.CreateFailure.CategoryNotFound => BadRequest(new { message = result.Error }),
            Create.CreateFailure.BrandNotFound => BadRequest(new { message = result.Error }),
            Create.CreateFailure.ColorNotFound => BadRequest(new { message = result.Error }),
            _ => BadRequest(new { message = result.Error })
        };
    }

    /// <summary>
    /// Updates a product from a multipart admin form.
    /// </summary>
    [HttpPut("products/{id:guid}")]
    [RequestSizeLimit(30 * 1024 * 1024)]
    public async Task<ActionResult> EditProduct(
        Guid id,
        [FromForm] CreateAdminProductRequest request,
        CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        if (!TryParseStatus(request.Status, out var productStatus))
        {
            return BadRequest(new { message = "Product status must be Draft, Active, or Archived." });
        }

        var imageValidationError = ValidateImages(request.Images);
        if (imageValidationError is not null)
        {
            return BadRequest(new { message = imageValidationError });
        }

        var uploads = request.Images
            .Select(file => new ProductImageUpload(
                file.FileName,
                file.ContentType,
                file.Length,
                file.OpenReadStream))
            .ToList();

        var result = await _mediator.Send(
            new Edit.Command(
                id,
                request.Title,
                request.Slug,
                request.Description,
                request.Price,
                request.StockQuantity,
                request.CategoryId,
                request.CategoryIds,
                request.BrandId,
                productStatus,
                request.ColorIds,
                request.DeletedImageIds,
                request.PrimaryImageId,
                uploads,
                request.PrimaryNewImageIndex),
            cancellationToken);

        if (result.Succeeded)
        {
            return Ok(result.Product);
        }

        return result.Failure switch
        {
            Edit.EditFailure.NotFound => NotFound(new { message = result.Error }),
            Edit.EditFailure.DuplicateSlug => Conflict(new { message = result.Error }),
            Edit.EditFailure.CategoryNotFound => BadRequest(new { message = result.Error }),
            Edit.EditFailure.BrandNotFound => BadRequest(new { message = result.Error }),
            Edit.EditFailure.ColorNotFound => BadRequest(new { message = result.Error }),
            _ => BadRequest(new { message = result.Error })
        };
    }

    /// <summary>
    /// Returns all categories for admin management.
    /// </summary>
    [HttpGet("categories/manage")]
    public async Task<ActionResult> GetManageCategories(CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new Categories.List.Query(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Creates a category.
    /// </summary>
    [HttpPost("categories")]
    public async Task<ActionResult> CreateCategory(AdminCategoryRequest request, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new Categories.Create.Command(request.Name, request.Slug, request.ParentCategoryId, request.IsActive), cancellationToken);
        return ToMutationResponse(result.Action, result.Category, nameof(CreateCategory));
    }

    /// <summary>
    /// Updates a category.
    /// </summary>
    [HttpPut("categories/{id:guid}")]
    public async Task<ActionResult> EditCategory(Guid id, AdminCategoryRequest request, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new Categories.Edit.Command(id, request.Name, request.Slug, request.ParentCategoryId, request.IsActive), cancellationToken);
        return ToMutationResponse(result.Action, result.Category);
    }

    /// <summary>
    /// Soft deletes a category.
    /// </summary>
    [HttpDelete("categories/{id:guid}")]
    public async Task<ActionResult> DeleteCategory(Guid id, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new Categories.Delete.Command(id), cancellationToken);
        return result.Succeeded ? NoContent() : BadRequest(new { message = result.Error });
    }

    /// <summary>
    /// Returns brands.
    /// </summary>
    [HttpGet("brands")]
    public async Task<ActionResult> GetBrands(CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new Brands.List.Query(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Creates a brand.
    /// </summary>
    [HttpPost("brands")]
    public async Task<ActionResult> CreateBrand(AdminBrandRequest request, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(
            new Brands.Create.Command(
                request.Name,
                request.Slug,
                request.LogoUrl,
                request.Email,
                request.Website,
                request.Description,
                request.Location,
                request.IsActive),
            cancellationToken);
        return ToMutationResponse(result.Action, result.Brand, nameof(CreateBrand));
    }

    /// <summary>
    /// Updates a brand.
    /// </summary>
    [HttpPut("brands/{id:guid}")]
    public async Task<ActionResult> EditBrand(Guid id, AdminBrandRequest request, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(
            new Brands.Edit.Command(
                id,
                request.Name,
                request.Slug,
                request.LogoUrl,
                request.Email,
                request.Website,
                request.Description,
                request.Location,
                request.IsActive),
            cancellationToken);
        return ToMutationResponse(result.Action, result.Brand);
    }

    /// <summary>
    /// Soft deletes a brand.
    /// </summary>
    [HttpDelete("brands/{id:guid}")]
    public async Task<ActionResult> DeleteBrand(Guid id, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new Brands.Delete.Command(id), cancellationToken);
        return result.Succeeded ? NoContent() : BadRequest(new { message = result.Error });
    }

    /// <summary>
    /// Returns coupons.
    /// </summary>
    [HttpGet("coupons")]
    public async Task<ActionResult> GetCoupons(CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new Coupons.List.Query(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Returns admin order rows.
    /// </summary>
    [HttpGet("orders")]
    public async Task<ActionResult> GetOrders(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new Orders.List.Query(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Returns one admin order invoice.
    /// </summary>
    [HttpGet("orders/{id:guid}")]
    public async Task<ActionResult> GetOrder(Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new Orders.Details.Query(id), cancellationToken);
        return result is null ? NotFound(new { message = "Order was not found." }) : Ok(result);
    }

    /// <summary>
    /// Creates a coupon.
    /// </summary>
    [HttpPost("coupons")]
    public async Task<ActionResult> CreateCoupon(AdminCouponRequest request, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(
            new Coupons.Create.Command(
                request.Title,
                request.Code,
                request.DiscountPercent,
                request.MaxDiscountAmount,
                request.ExpiresAtUtc,
                request.IsActive,
                request.AppliesToAllCategories,
                request.CategoryIds),
            cancellationToken);
        return ToMutationResponse(result.Action, result.Coupon, nameof(CreateCoupon));
    }

    /// <summary>
    /// Updates a coupon.
    /// </summary>
    [HttpPut("coupons/{id:guid}")]
    public async Task<ActionResult> EditCoupon(Guid id, AdminCouponRequest request, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(
            new Coupons.Edit.Command(
                id,
                request.Title,
                request.Code,
                request.DiscountPercent,
                request.MaxDiscountAmount,
                request.ExpiresAtUtc,
                request.IsActive,
                request.AppliesToAllCategories,
                request.CategoryIds),
            cancellationToken);
        return ToMutationResponse(result.Action, result.Coupon);
    }

    /// <summary>
    /// Soft deletes a coupon.
    /// </summary>
    [HttpDelete("coupons/{id:guid}")]
    public async Task<ActionResult> DeleteCoupon(Guid id, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new Coupons.Delete.Command(id), cancellationToken);
        return result.Succeeded ? NoContent() : BadRequest(new { message = result.Error });
    }

    /// <summary>
    /// Returns users for profile management.
    /// </summary>
    [HttpGet("users")]
    public async Task<ActionResult> GetUsers(CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new Users.List.Query(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Returns one user.
    /// </summary>
    [HttpGet("users/{id:guid}")]
    public async Task<ActionResult> GetUser(Guid id, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        var result = await _mediator.Send(new Users.Details.Query(id), cancellationToken);
        return result is null ? NotFound(new { message = "User was not found." }) : Ok(result);
    }

    /// <summary>
    /// Updates a user.
    /// </summary>
    [HttpPut("users/{id:guid}")]
    public async Task<ActionResult> EditUser(Guid id, AdminUserRequest request, CancellationToken cancellationToken)
    {
        // TODO: Protect admin endpoints with role-based authorization before production.
        if (!Enum.TryParse<UserRole>(request.Role, ignoreCase: true, out var role))
        {
            return BadRequest(new { message = "User role must be Customer or Admin." });
        }

        var result = await _mediator.Send(
            new Users.Edit.Command(id, request.FullName, request.Email, request.PhoneNumber, role),
            cancellationToken);
        return ToMutationResponse(result.Action, result.User);
    }

    /// <summary>
    /// Requests a password reset action shell.
    /// </summary>
    [HttpPost("users/{id:guid}/password-reset")]
    public async Task<ActionResult> RequestPasswordReset(Guid id, CancellationToken cancellationToken)
    {
        // TODO: Wire this to a real auth/password provider before production.
        var result = await _mediator.Send(new Users.RequestPasswordReset.Command(id), cancellationToken);
        return StatusCode(StatusCodes.Status501NotImplemented, new { message = result.Error });
    }

    private ActionResult ToMutationResponse<T>(AdminActionResult action, T? payload, string? createdAction = null)
        where T : class
    {
        if (!action.Succeeded)
        {
            return BadRequest(new { message = action.Error });
        }

        if (createdAction is not null)
        {
            return Created($"/api/admin/{createdAction}", payload);
        }

        return Ok(payload);
    }

    private static bool TryParseStatus(string? status, out ProductStatus productStatus)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            productStatus = ProductStatus.Draft;
            return true;
        }

        return Enum.TryParse(status, ignoreCase: true, out productStatus);
    }

    private static string? ValidateImages(IReadOnlyCollection<IFormFile> images)
    {
        if (images.Count > MaxProductImages)
        {
            return $"A product can have at most {MaxProductImages} images.";
        }

        foreach (var image in images)
        {
            string extension = Path.GetExtension(image.FileName);
            if (!AllowedExtensions.Contains(extension))
            {
                return "Only JPG, PNG, and WebP product images are allowed.";
            }

            if (!AllowedContentTypes.Contains(image.ContentType))
            {
                return "Only JPG, PNG, and WebP product images are allowed.";
            }

            if (image.Length > MaxImageBytes)
            {
                return "Each product image must be 5MB or smaller.";
            }
        }

        return null;
    }
}

/// <summary>
/// Represents a multipart create-product request from the admin panel.
/// </summary>
public sealed class CreateAdminProductRequest
{
    /// <summary>Gets or sets the product title.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Gets or sets the optional product slug override.</summary>
    public string? Slug { get; set; }

    /// <summary>Gets or sets the optional product description.</summary>
    public string? Description { get; set; }

    /// <summary>Gets or sets the product price.</summary>
    public decimal Price { get; set; }

    /// <summary>Gets or sets the available stock quantity.</summary>
    public int StockQuantity { get; set; }

    /// <summary>Gets or sets the optional category identifier.</summary>
    public Guid? CategoryId { get; set; }

    /// <summary>Gets selected category identifiers for multi-category products.</summary>
    public List<Guid> CategoryIds { get; set; } = [];

    /// <summary>Gets or sets the optional brand identifier.</summary>
    public Guid? BrandId { get; set; }

    /// <summary>Gets selected color identifiers.</summary>
    public List<Guid> ColorIds { get; set; } = [];

    /// <summary>Gets or sets the product publication status.</summary>
    public string? Status { get; set; }

    /// <summary>Gets existing image identifiers that should be removed.</summary>
    public List<Guid> DeletedImageIds { get; set; } = [];

    /// <summary>Gets the existing image identifier that should become primary.</summary>
    public Guid? PrimaryImageId { get; set; }

    /// <summary>Gets the zero-based new upload index that should become primary.</summary>
    public int? PrimaryNewImageIndex { get; set; }

    /// <summary>Gets or sets uploaded product images.</summary>
    public List<IFormFile> Images { get; set; } = [];
}

/// <summary>
/// Represents a category mutation request.
/// </summary>
public sealed class AdminCategoryRequest
{
    /// <summary>Gets or sets the category name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Gets or sets the optional category slug.</summary>
    public string? Slug { get; set; }

    /// <summary>Gets or sets the optional parent category identifier.</summary>
    public Guid? ParentCategoryId { get; set; }

    /// <summary>Gets or sets whether the category is active.</summary>
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// Represents a brand mutation request.
/// </summary>
public sealed class AdminBrandRequest
{
    /// <summary>Gets or sets the brand name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Gets or sets the optional slug.</summary>
    public string? Slug { get; set; }

    /// <summary>Gets or sets the optional logo URL.</summary>
    public string? LogoUrl { get; set; }

    /// <summary>Gets or sets the optional email.</summary>
    public string? Email { get; set; }

    /// <summary>Gets or sets the optional website.</summary>
    public string? Website { get; set; }

    /// <summary>Gets or sets the optional description.</summary>
    public string? Description { get; set; }

    /// <summary>Gets or sets the optional location.</summary>
    public string? Location { get; set; }

    /// <summary>Gets or sets whether the brand is active.</summary>
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// Represents a coupon mutation request.
/// </summary>
public sealed class AdminCouponRequest
{
    /// <summary>Gets or sets the coupon title.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Gets or sets the coupon code.</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Gets or sets the discount percent.</summary>
    public decimal DiscountPercent { get; set; }

    /// <summary>Gets or sets the optional maximum discount amount in Toman.</summary>
    public decimal? MaxDiscountAmount { get; set; }

    /// <summary>Gets or sets the expiration timestamp.</summary>
    public DateTime ExpiresAtUtc { get; set; }

    /// <summary>Gets or sets whether the coupon is active.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Gets or sets whether the coupon applies to every category.</summary>
    public bool AppliesToAllCategories { get; set; } = true;

    /// <summary>Gets category restrictions when not applying globally.</summary>
    public List<Guid> CategoryIds { get; set; } = [];
}

/// <summary>
/// Represents a user mutation request.
/// </summary>
public sealed class AdminUserRequest
{
    /// <summary>Gets or sets the full name.</summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>Gets or sets the email.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Gets or sets the optional phone number.</summary>
    public string? PhoneNumber { get; set; }

    /// <summary>Gets or sets the role name.</summary>
    public string Role { get; set; } = string.Empty;
}

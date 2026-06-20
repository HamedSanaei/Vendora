using Application.Products.DTOs;
using Domain.Entities;

namespace Application.Products;

internal static class AdminProductMappings
{
    internal static AdminProductDto MapProduct(Product product)
    {
        var images = product.Images
            .OrderBy(image => image.SortOrder)
            .Select(image => new ProductImageDto(
                image.Id,
                image.ImageUrl,
                image.AltText,
                image.IsPrimary,
                image.SortOrder))
            .ToList();

        return new AdminProductDto(
            product.Id,
            product.Title,
            product.Slug,
            product.Description,
            product.Price,
            product.StockQuantity,
            product.Status.ToString(),
            product.InventoryStatus.ToString(),
            ResolvePrimaryCategoryId(product),
            ResolvePrimaryCategoryName(product),
            product.Categories
                .Where(productCategory => productCategory.Category is not null)
                .OrderBy(productCategory => productCategory.Category.Name)
                .Select(productCategory => new ProductCategoryDto(
                    productCategory.Category.Id,
                    productCategory.Category.Name,
                    productCategory.Category.Slug,
                    productCategory.Category.ParentCategoryId))
                .ToList(),
            product.BrandId,
            product.Brand?.Name,
            images.FirstOrDefault(image => image.IsPrimary)?.ImageUrl ?? images.FirstOrDefault()?.ImageUrl,
            images,
            product.Colors
                .Where(color => color.CatalogColor is not null)
                .OrderBy(color => color.CatalogColor.Name)
                .Select(color => new CatalogColorDto(
                    color.CatalogColor.Id,
                    color.CatalogColor.Name,
                    color.CatalogColor.Slug,
                    color.CatalogColor.HexCode))
                .ToList());
    }

    private static Guid? ResolvePrimaryCategoryId(Product product)
    {
        return product.Categories.FirstOrDefault()?.CategoryId ?? product.CategoryId;
    }

    private static string? ResolvePrimaryCategoryName(Product product)
    {
        return product.Categories.FirstOrDefault()?.Category?.Name ?? product.Category?.Name;
    }
}

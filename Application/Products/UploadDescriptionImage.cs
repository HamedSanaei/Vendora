using Application.Interfaces;
using MediatR;

namespace Application.Products;

/// <summary>Uploads an article image independently of the product's ten-image gallery.</summary>
public static class UploadDescriptionImage
{
    /// <summary>Contains a single administrator-supplied raster image.</summary>
    public sealed record Command(ProductImageUpload Image) : IRequest<Result>;
    /// <summary>Contains either a locally stored URL or a validation error.</summary>
    public sealed record Result(string? Url, string? Error);

    /// <summary>Checks size, extension, MIME type, and binary signature before storing the upload.</summary>
    public sealed class Handler(IProductImageStorage storage) : IRequestHandler<Command, Result>
    {
        /// <inheritdoc />
        public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
        {
            var image = request.Image;
            if (image.Length <= 0 || image.Length > 5 * 1024 * 1024)
                return new(null, "Article images must be between 1 byte and 5MB.");
            byte[] header = new byte[12];
            await using (var stream = image.OpenReadStream())
            {
                int read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
                if (read < header.Length) return new(null, "The uploaded file is not a supported image.");
            }
            string extension = Path.GetExtension(image.FileName).ToLowerInvariant();
            bool valid = (extension, image.ContentType.ToLowerInvariant()) switch
            {
                (".jpg" or ".jpeg", "image/jpeg") => header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff,
                (".png", "image/png") => header.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
                (".webp", "image/webp") => header.AsSpan(0, 4).SequenceEqual("RIFF"u8) && header.AsSpan(8, 4).SequenceEqual("WEBP"u8),
                _ => false
            };
            if (!valid) return new(null, "Only matching JPG, PNG, and WebP image files are allowed.");
            var saved = await storage.SaveAsync(image, cancellationToken);
            return new(saved.Url, null);
        }
    }
}

using System.Buffers;
using System.Buffers.Binary;
using Application.Interfaces;

namespace Application.Slideshow;

/// <summary>Validates slideshow settings and bounded raster image uploads before storage is touched.</summary>
internal static class SlideshowValidation
{
    internal const long MaxImageBytes = 5 * 1024 * 1024;

    /// <summary>Returns a validation error for invalid ordering or playback duration.</summary>
    internal static string? ValidateSettings(int sortOrder, int durationSeconds)
    {
        if (sortOrder < 0)
        {
            return "Sort order must be a nonnegative integer.";
        }

        return durationSeconds is < 1 or > 120
            ? "Duration must be an integer between 1 and 120 seconds."
            : null;
    }

    /// <summary>Checks extension/MIME agreement, actual byte count and raster signatures without buffering the file.</summary>
    internal static async Task<string?> ValidateImageAsync(ProductImageUpload image, CancellationToken cancellationToken)
    {
        const string error = "Upload a nonempty JPG, PNG, or WebP image up to 5MB with matching file content.";
        if (image.Length is <= 0 or > MaxImageBytes)
        {
            return error;
        }

        string extension = Path.GetExtension(image.FileName).ToLowerInvariant();
        string? expectedType = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => null
        };
        if (expectedType is null || !string.Equals(expectedType, image.ContentType, StringComparison.OrdinalIgnoreCase))
        {
            return error;
        }

        byte[] buffer = ArrayPool<byte>.Shared.Rent(81920);
        // First 32 bytes and a rolling 12-byte trailer suffice for format signatures/end markers.
        byte[] header = new byte[44];
        int headerLength = 0;
        long length = 0;
        try
        {
            await using Stream stream = image.OpenReadStream();
            int count;
            while ((count = await stream.ReadAsync(buffer.AsMemory(), cancellationToken)) != 0)
            {
                length += count;
                if (length > MaxImageBytes || length > image.Length)
                {
                    return error;
                }

                int headerBytes = Math.Min(count, 32 - headerLength);
                buffer.AsSpan(0, headerBytes).CopyTo(header.AsSpan(headerLength));
                headerLength += headerBytes;
                if (count >= 12)
                {
                    buffer.AsSpan(count - 12, 12).CopyTo(header.AsSpan(32));
                }
                else
                {
                    header.AsSpan(32 + count, 12 - count).CopyTo(header.AsSpan(32));
                    buffer.AsSpan(0, count).CopyTo(header.AsSpan(44 - count));
                }
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }

        if (length != image.Length)
        {
            return error;
        }

        bool matches = expectedType switch
        {
            "image/jpeg" => headerLength >= 3 && header[0] == 0xff && header[1] == 0xd8
                && header[2] == 0xff && header[42] == 0xff && header[43] == 0xd9,
            "image/png" => headerLength == 32
                && header.AsSpan(0, 8).SequenceEqual<byte>([137, 80, 78, 71, 13, 10, 26, 10])
                && BinaryPrimitives.ReadUInt32BigEndian(header.AsSpan(8, 4)) == 13
                && header.AsSpan(12, 4).SequenceEqual("IHDR"u8)
                && BinaryPrimitives.ReadUInt32BigEndian(header.AsSpan(16, 4)) > 0
                && BinaryPrimitives.ReadUInt32BigEndian(header.AsSpan(20, 4)) > 0
                && length >= 45
                && header.AsSpan(32, 12).SequenceEqual<byte>([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]),
            "image/webp" => headerLength >= 20 && header.AsSpan(0, 4).SequenceEqual("RIFF"u8)
                && header.AsSpan(8, 4).SequenceEqual("WEBP"u8)
                && BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(4, 4)) == length - 8
                && BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(16, 4)) <= length - 20
                && (header.AsSpan(12, 4).SequenceEqual("VP8 "u8)
                    || header.AsSpan(12, 4).SequenceEqual("VP8L"u8)
                    || header.AsSpan(12, 4).SequenceEqual("VP8X"u8)),
            _ => false
        };
        return matches ? null : error;
    }
}

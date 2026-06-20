namespace Application.Interfaces;

/// <summary>
/// Represents an uploaded product image passed into the application layer.
/// </summary>
/// <param name="FileName">The original client file name.</param>
/// <param name="ContentType">The uploaded file content type.</param>
/// <param name="Length">The uploaded file length in bytes.</param>
/// <param name="OpenReadStream">Opens a readable stream for the file content.</param>
public sealed record ProductImageUpload(
    string FileName,
    string ContentType,
    long Length,
    Func<Stream> OpenReadStream);

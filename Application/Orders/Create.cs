using Application.Orders.DTOs;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;
using Persistence.Carts;
using Persistence.Common;
using Persistence.Orders;
using Persistence.Products;

namespace Application.Orders;

/// <summary>
/// Creates an order from a cart.
/// </summary>
public static class Create
{
    /// <summary>
    /// Represents a cart item selected by the customer at checkout.
    /// </summary>
    public sealed record ItemInput(Guid ProductId, int Quantity);

    /// <summary>
    /// Represents a new shipping address entered during checkout.
    /// </summary>
    public sealed record AddressInput(
        string? Title,
        string RecipientName,
        string PhoneNumber,
        string Province,
        string City,
        string StreetAddress,
        string? Plaque,
        string? Unit,
        string PostalCode,
        bool SaveToAddressBook,
        bool IsDefault);

    /// <summary>
    /// Represents a create-order command.
    /// </summary>
    public sealed record Command(
        Guid UserId,
        decimal ShippingCost,
        decimal DiscountAmount,
        Guid? ShippingAddressId,
        AddressInput? NewAddress,
        IReadOnlyList<ItemInput> Items) : IRequest<OrderDto>;

    /// <summary>
    /// Handles create-order commands.
    /// </summary>
    public sealed class Handler : IRequestHandler<Command, OrderDto>
    {
        private readonly ICartRepository _cartRepository;
        private readonly IOrderRepository _orderRepository;
        private readonly IProductReadRepository _productReadRepository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly AppDbContext _dbContext;

        /// <summary>
        /// Creates the handler.
        /// </summary>
        public Handler(
            ICartRepository cartRepository,
            IOrderRepository orderRepository,
            IProductReadRepository productReadRepository,
            IUnitOfWork unitOfWork,
            AppDbContext dbContext)
        {
            _cartRepository = cartRepository;
            _orderRepository = orderRepository;
            _productReadRepository = productReadRepository;
            _unitOfWork = unitOfWork;
            _dbContext = dbContext;
        }

        /// <inheritdoc />
        public async Task<OrderDto> Handle(Command request, CancellationToken cancellationToken)
        {
            var checkoutItems = await ResolveCheckoutItemsAsync(request, cancellationToken);

            var order = new Order
            {
                UserId = request.UserId,
                OrderNumber = $"ORD-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}"[..28],
                ShippingCost = request.ShippingCost,
                DiscountAmount = request.DiscountAmount
            };

            var address = await ResolveShippingAddressAsync(request, cancellationToken);
            ApplyShippingSnapshot(order, address);

            foreach (var cartItem in checkoutItems)
            {
                var product = await _productReadRepository.GetActiveProductByIdAsync(cartItem.ProductId, cancellationToken)
                    ?? throw new InvalidOperationException($"Product {cartItem.ProductId} was not found.");

                if (product.StockQuantity < cartItem.Quantity)
                {
                    throw new InvalidOperationException($"Product {product.Title} does not have enough stock.");
                }

                product.StockQuantity -= cartItem.Quantity;

                order.Items.Add(new OrderItem
                {
                    ProductId = product.Id,
                    ProductTitle = product.Title,
                    UnitPrice = product.Price,
                    Quantity = cartItem.Quantity
                });
            }

            order.RecalculateTotals();

            await _orderRepository.AddAsync(order, cancellationToken);
            var serverCart = await _cartRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (serverCart is not null)
            {
                _cartRepository.ClearItems(serverCart);
                serverCart.Touch();
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return OrderMappings.Map(order);
        }

        private async Task<IReadOnlyList<ItemInput>> ResolveCheckoutItemsAsync(Command request, CancellationToken cancellationToken)
        {
            if (request.Items.Count > 0)
            {
                var validItems = request.Items
                    .Where(item => item.ProductId != Guid.Empty && item.Quantity > 0)
                    .GroupBy(item => item.ProductId)
                    .Select(group => new ItemInput(group.Key, group.Sum(item => item.Quantity)))
                    .ToList();

                if (validItems.Count == 0)
                {
                    throw new InvalidOperationException("Cart is empty.");
                }

                return validItems;
            }

            var cart = await _cartRepository.GetByUserIdAsync(request.UserId, cancellationToken)
                ?? throw new InvalidOperationException("Cart was not found.");

            if (cart.Items.Count == 0)
            {
                throw new InvalidOperationException("Cart is empty.");
            }

            return cart.Items.Select(item => new ItemInput(item.ProductId, item.Quantity)).ToList();
        }

        private async Task<CustomerAddress> ResolveShippingAddressAsync(Command request, CancellationToken cancellationToken)
        {
            if (request.NewAddress is not null)
            {
                var address = new CustomerAddress { UserId = request.UserId };
                string? error = ApplyAddress(address, request.NewAddress);
                if (error is not null)
                {
                    throw new InvalidOperationException(error);
                }

                bool shouldSave = request.NewAddress.SaveToAddressBook;
                bool hasAnyAddress = await _dbContext.CustomerAddresses.AnyAsync(x => x.UserId == request.UserId, cancellationToken);
                address.IsDefault = request.NewAddress.IsDefault || !hasAnyAddress;

                if (address.IsDefault)
                {
                    await ClearDefaultAddressAsync(request.UserId, null, cancellationToken);
                }

                if (shouldSave)
                {
                    await _dbContext.CustomerAddresses.AddAsync(address, cancellationToken);
                }

                return address;
            }

            if (request.ShippingAddressId is null || request.ShippingAddressId == Guid.Empty)
            {
                throw new InvalidOperationException("Shipping address is required.");
            }

            return await _dbContext.CustomerAddresses
                .AsNoTracking()
                .SingleOrDefaultAsync(address => address.Id == request.ShippingAddressId && address.UserId == request.UserId, cancellationToken)
                ?? throw new InvalidOperationException("Shipping address was not found.");
        }

        private static void ApplyShippingSnapshot(Order order, CustomerAddress address)
        {
            order.ShippingAddressId = address.Id;
            order.ShippingRecipientName = address.RecipientName;
            order.ShippingPhoneNumber = address.PhoneNumber;
            order.ShippingProvince = address.Province;
            order.ShippingCity = address.City;
            order.ShippingStreetAddress = address.StreetAddress;
            order.ShippingPlaque = address.Plaque;
            order.ShippingUnit = address.Unit;
            order.ShippingPostalCode = address.PostalCode;
        }

        private static string? ApplyAddress(CustomerAddress address, AddressInput input)
        {
            string postalCode = NormalizeDigits(input.PostalCode)?.Trim() ?? string.Empty;
            string phoneNumber = NormalizeDigits(input.PhoneNumber)?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(input.RecipientName))
            {
                return "Recipient name is required.";
            }

            if (phoneNumber.Length != 11 || !phoneNumber.StartsWith("09", StringComparison.Ordinal) || !phoneNumber.All(char.IsDigit))
            {
                return "Phone number must be a valid Iranian mobile number.";
            }

            if (string.IsNullOrWhiteSpace(input.Province))
            {
                return "Province is required.";
            }

            if (string.IsNullOrWhiteSpace(input.City))
            {
                return "City is required.";
            }

            if (string.IsNullOrWhiteSpace(input.StreetAddress))
            {
                return "Street address is required.";
            }

            if (postalCode.Length != 10 || !postalCode.All(char.IsDigit))
            {
                return "Postal code must be a 10-digit Iranian postal code.";
            }

            address.Title = string.IsNullOrWhiteSpace(input.Title) ? "Address" : input.Title.Trim();
            address.RecipientName = input.RecipientName.Trim();
            address.PhoneNumber = phoneNumber;
            address.Province = input.Province.Trim();
            address.City = input.City.Trim();
            address.StreetAddress = input.StreetAddress.Trim();
            address.Plaque = string.IsNullOrWhiteSpace(input.Plaque) ? null : NormalizeDigits(input.Plaque)?.Trim();
            address.Unit = string.IsNullOrWhiteSpace(input.Unit) ? null : NormalizeDigits(input.Unit)?.Trim();
            address.PostalCode = postalCode;
            return null;
        }

        private async Task ClearDefaultAddressAsync(Guid userId, Guid? exceptAddressId, CancellationToken cancellationToken)
        {
            var defaultAddresses = await _dbContext.CustomerAddresses
                .Where(address => address.UserId == userId && address.IsDefault && address.Id != exceptAddressId)
                .ToListAsync(cancellationToken);

            foreach (var defaultAddress in defaultAddresses)
            {
                defaultAddress.IsDefault = false;
            }
        }

        private static string? NormalizeDigits(string? value)
        {
            if (value is null)
            {
                return null;
            }

            var builder = new System.Text.StringBuilder(value.Length);
            foreach (char character in value)
            {
                builder.Append(character switch
                {
                    >= '\u06F0' and <= '\u06F9' => (char)('0' + character - '\u06F0'),
                    >= '\u0660' and <= '\u0669' => (char)('0' + character - '\u0660'),
                    _ => character
                });
            }

            return builder.ToString();
        }
    }
}

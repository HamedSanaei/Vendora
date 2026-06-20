using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Admin;

/// <summary>
/// Admin order and invoice use cases.
/// </summary>
public static class Orders
{
    /// <summary>Represents a row in the admin order list.</summary>
    public sealed record AdminOrderListItemDto(
        Guid Id,
        string OrderNumber,
        string CustomerName,
        DateTime CreatedAtUtc,
        decimal TotalAmount,
        string Status,
        string PaymentStatus,
        int ItemCount);

    /// <summary>Represents one invoice line item.</summary>
    public sealed record AdminOrderItemDto(Guid ProductId, string ProductTitle, decimal UnitPrice, int Quantity, decimal LineTotal);

    /// <summary>Represents one payment transaction on an invoice.</summary>
    public sealed record AdminPaymentTransactionDto(
        Guid Id,
        string Provider,
        string? Authority,
        string? ReferenceId,
        decimal Amount,
        string Status,
        string? FailureReason);

    /// <summary>Represents the customer snapshot shown on an invoice.</summary>
    public sealed record AdminOrderCustomerDto(Guid? Id, string FullName, string Email, string? PhoneNumber);

    /// <summary>Represents a full admin invoice.</summary>
    public sealed record AdminOrderDetailsDto(
        Guid Id,
        string OrderNumber,
        string Status,
        string PaymentStatus,
        string CurrencyCode,
        DateTime CreatedAtUtc,
        decimal Subtotal,
        decimal ShippingCost,
        decimal DiscountAmount,
        decimal TotalAmount,
        AdminOrderCustomerDto Customer,
        IReadOnlyList<AdminOrderItemDto> Items,
        IReadOnlyList<AdminPaymentTransactionDto> Payments);

    /// <summary>Lists orders for admin management.</summary>
    public static class List
    {
        /// <summary>Represents a list query.</summary>
        public sealed record Query : IRequest<IReadOnlyList<AdminOrderListItemDto>>;

        /// <summary>Handles order list queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<AdminOrderListItemDto>>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<IReadOnlyList<AdminOrderListItemDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var orders = await _dbContext.Orders
                    .AsNoTracking()
                    .Include(order => order.Items)
                    .OrderByDescending(order => order.CreatedAtUtc)
                    .ToListAsync(cancellationToken);

                var userIds = orders.Where(order => order.UserId.HasValue).Select(order => order.UserId!.Value).Distinct().ToList();
                var users = await _dbContext.UserAccounts
                    .AsNoTracking()
                    .Where(user => userIds.Contains(user.Id))
                    .ToDictionaryAsync(user => user.Id, cancellationToken);

                return orders.Select(order =>
                {
                    users.TryGetValue(order.UserId ?? Guid.Empty, out var user);
                    return new AdminOrderListItemDto(
                        order.Id,
                        order.OrderNumber,
                        user?.FullName ?? "Guest Customer",
                        order.CreatedAtUtc,
                        order.TotalAmount,
                        order.Status.ToString(),
                        order.PaymentStatus.ToString(),
                        order.Items.Sum(item => item.Quantity));
                }).ToList();
            }
        }
    }

    /// <summary>Returns one order invoice.</summary>
    public static class Details
    {
        /// <summary>Represents a details query.</summary>
        public sealed record Query(Guid Id) : IRequest<AdminOrderDetailsDto?>;

        /// <summary>Handles order details queries.</summary>
        public sealed class Handler : IRequestHandler<Query, AdminOrderDetailsDto?>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<AdminOrderDetailsDto?> Handle(Query request, CancellationToken cancellationToken)
            {
                var order = await _dbContext.Orders
                    .AsNoTracking()
                    .Include(item => item.Items)
                    .SingleOrDefaultAsync(order => order.Id == request.Id, cancellationToken);

                if (order is null)
                {
                    return null;
                }

                UserAccount? user = null;
                if (order.UserId.HasValue)
                {
                    user = await _dbContext.UserAccounts
                        .AsNoTracking()
                        .SingleOrDefaultAsync(account => account.Id == order.UserId.Value, cancellationToken);
                }

                var payments = await _dbContext.PaymentTransactions
                    .AsNoTracking()
                    .Where(payment => payment.OrderId == order.Id)
                    .OrderBy(payment => payment.CreatedAtUtc)
                    .ToListAsync(cancellationToken);

                return new AdminOrderDetailsDto(
                    order.Id,
                    order.OrderNumber,
                    order.Status.ToString(),
                    order.PaymentStatus.ToString(),
                    order.CurrencyCode,
                    order.CreatedAtUtc,
                    order.Subtotal,
                    order.ShippingCost,
                    order.DiscountAmount,
                    order.TotalAmount,
                    new AdminOrderCustomerDto(
                        user?.Id,
                        user?.FullName ?? "Guest Customer",
                        user?.Email ?? string.Empty,
                        user?.PhoneNumber),
                    order.Items
                        .OrderBy(item => item.ProductTitle)
                        .Select(item => new AdminOrderItemDto(
                            item.ProductId,
                            item.ProductTitle,
                            item.UnitPrice,
                            item.Quantity,
                            item.LineTotal))
                        .ToList(),
                    payments
                        .Select(payment => new AdminPaymentTransactionDto(
                            payment.Id,
                            payment.Provider.ToString(),
                            payment.Authority,
                            payment.ReferenceId,
                            payment.Amount,
                            payment.Status.ToString(),
                            payment.FailureReason))
                        .ToList());
            }
        }
    }
}

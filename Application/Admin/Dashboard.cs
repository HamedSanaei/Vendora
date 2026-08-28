using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Admin;

/// <summary>
/// Provides read-only operational metrics for the admin dashboard.
/// </summary>
public static class Dashboard
{
    /// <summary>Represents one calendar-month sales point.</summary>
    public sealed record MonthlySalesPointDto(int Year, int Month, decimal Amount);

    /// <summary>Represents the complete dashboard payload.</summary>
    public sealed record AdminDashboardDto(
        decimal TotalSales,
        int TotalOrders,
        int TotalProducts,
        int TotalCustomers,
        IReadOnlyList<MonthlySalesPointDto> MonthlySales,
        IReadOnlyList<Orders.AdminOrderListItemDto> RecentOrders);

    /// <summary>Represents a dashboard query for a bounded number of calendar months.</summary>
    public sealed record Query(int Months = 6) : IRequest<AdminDashboardDto>;

    /// <summary>Calculates dashboard metrics from persisted commerce data.</summary>
    public sealed class Handler : IRequestHandler<Query, AdminDashboardDto>
    {
        private readonly AppDbContext _dbContext;

        /// <summary>Creates the dashboard query handler.</summary>
        public Handler(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <inheritdoc />
        public async Task<AdminDashboardDto> Handle(Query request, CancellationToken cancellationToken)
        {
            int months = Math.Clamp(request.Months, 1, 24);
            DateTime currentMonth = new(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            DateTime firstMonth = currentMonth.AddMonths(-(months - 1));

            var verifiedSales = await _dbContext.Orders
                .AsNoTracking()
                .Where(order => order.PaymentStatus == PaymentStatus.Verified)
                .Select(order => new { order.CreatedAtUtc, order.TotalAmount })
                .ToListAsync(cancellationToken);

            var monthlySales = Enumerable.Range(0, months)
                .Select(offset => firstMonth.AddMonths(offset))
                .Select(month => new MonthlySalesPointDto(
                    month.Year,
                    month.Month,
                    verifiedSales
                        .Where(order => order.CreatedAtUtc.Year == month.Year && order.CreatedAtUtc.Month == month.Month)
                        .Sum(order => order.TotalAmount)))
                .ToList();

            var recentOrders = await _dbContext.Orders
                .AsNoTracking()
                .Include(order => order.Items)
                .OrderByDescending(order => order.CreatedAtUtc)
                .Take(5)
                .ToListAsync(cancellationToken);

            var userIds = recentOrders
                .Where(order => order.UserId.HasValue)
                .Select(order => order.UserId!.Value)
                .Distinct()
                .ToList();
            var users = await _dbContext.UserAccounts
                .AsNoTracking()
                .Where(user => userIds.Contains(user.Id))
                .ToDictionaryAsync(user => user.Id, cancellationToken);

            return new AdminDashboardDto(
                verifiedSales.Sum(order => order.TotalAmount),
                await _dbContext.Orders.AsNoTracking().CountAsync(cancellationToken),
                await _dbContext.Products.AsNoTracking().CountAsync(cancellationToken),
                await _dbContext.UserAccounts.AsNoTracking()
                    .CountAsync(user => user.Role == UserRole.Customer, cancellationToken),
                monthlySales,
                recentOrders.Select(order => MapRecentOrder(order, users)).ToList());
        }

        private static Orders.AdminOrderListItemDto MapRecentOrder(
            Order order,
            IReadOnlyDictionary<Guid, UserAccount> users)
        {
            users.TryGetValue(order.UserId ?? Guid.Empty, out var user);
            return new Orders.AdminOrderListItemDto(
                order.Id,
                order.OrderNumber,
                user?.FullName ?? "Guest Customer",
                order.CreatedAtUtc,
                order.TotalAmount,
                order.Status.ToString(),
                order.PaymentStatus.ToString(),
                order.Items.Sum(item => item.Quantity),
                order.GetAllowedTransitions().Select(status => status.ToString()).ToList());
        }
    }
}

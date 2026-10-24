using Domain.Accounting;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

/// <summary>Authorized adjustments and durable order reservations use the same stock authority.</summary>
public static class InventoryCommands
{
    public sealed record Adjust(Guid Actor, string Key, Guid ProductId, long Version, int QuantityDelta, decimal? TotalCostToman, string Reason) : IRequest<Guid>;
    public sealed record Expire(Guid ReservationId) : IRequest;

    /// <summary>Posts a costed intake or reasoned free-stock decrease with optimistic concurrency.</summary>
    public sealed class AdjustHandler(AccountingUnitOfWork work, InventoryPosting inventory) : IRequestHandler<Adjust, Guid>
    {
        public Task<Guid> Handle(Adjust r, CancellationToken ct) => work.ExecuteAsync(r.Actor, r.Key, "adjust-stock", r,
            async token =>
            {
                await work.RequireActiveAsync(token);
                if (r.QuantityDelta == 0 || r.QuantityDelta is < -1_000_000 or > 1_000_000 || string.IsNullOrWhiteSpace(r.Reason) ||
                    r.Reason.Length > 1000 || (r.QuantityDelta > 0 && (r.TotalCostToman is null or < 0 or > 1_000_000_000_000_000)) ||
                    (r.QuantityDelta < 0 && r.TotalCostToman.HasValue)) throw new AccountingException("INVALID_ADJUSTMENT", 400);
                var balance = await inventory.BalanceAsync(r.ProductId, token);
                if (balance.Version != r.Version) throw new AccountingException("STALE_VERSION");
                decimal value = r.QuantityDelta > 0 ? balance.Receive(r.QuantityDelta, r.TotalCostToman!.Value) : -balance.Issue(-r.QuantityDelta);
                return await inventory.RecordAsync(balance, $"adjust:{Guid.NewGuid()}", r.QuantityDelta > 0 ? StockMovementKind.AdjustmentIn : StockMovementKind.AdjustmentOut,
                    r.QuantityDelta, 0, value, r.Actor, r.Reason.Trim(), token);
            }, ct);
    }

    /// <summary>Releases one expired reservation exactly once; safe after restarts and competing cancellation/verification.</summary>
    public sealed class ExpireHandler(AppDbContext db, AccountingUnitOfWork work, InventoryPosting inventory, TimeProvider time) : IRequestHandler<Expire>
    {
        public async Task Handle(Expire r, CancellationToken ct)
        {
            Guid system = Guid.Parse("00000000-0000-0000-0000-000000000003");
            await work.ExecuteAsync(system, $"reservation-expire:{r.ReservationId}", "expire-reservation", r, async token =>
            {
                var reservation = await db.StockReservations.SingleOrDefaultAsync(x => x.Id == r.ReservationId, token);
                if (reservation is null) throw new AccountingException("RESERVATION_NOT_FOUND", 404);
                if (reservation.Status != ReservationStatus.Active) return reservation.Id;
                if (reservation.ExpiresAtUtc > time.GetUtcNow().UtcDateTime) throw new AccountingException("RESERVATION_NOT_EXPIRED");
                var balance = await inventory.BalanceAsync(reservation.ProductId, token);
                balance.Release(reservation.Quantity); reservation.Status = ReservationStatus.Expired; reservation.Version++;
                await inventory.RecordAsync(balance, $"reservation-expire:{reservation.Id}", StockMovementKind.Release, 0,
                    -reservation.Quantity, 0, system, "Thirty-minute order reservation expired", token);
                return reservation.Id;
            }, ct);
        }
    }
}

/// <summary>Called only inside the order transaction, after its common stock write gate has been acquired.</summary>
public sealed class OrderReservations(AppDbContext db, InventoryPosting inventory, TimeProvider time)
{
    /// <summary>Reserves an order line without reducing physical stock or recording a sale/receipt.</summary>
    public async Task ReserveAsync(Order order, OrderItem line, Guid actor, CancellationToken ct)
    {
        var balance = await inventory.BalanceAsync(line.ProductId, ct); balance.Reserve(line.Quantity);
        var reservation = new StockReservation { OrderId = order.Id, OrderItemId = line.Id, ProductId = line.ProductId,
            Quantity = line.Quantity, ExpiresAtUtc = time.GetUtcNow().UtcDateTime.AddMinutes(30) };
        db.StockReservations.Add(reservation);
        await inventory.RecordAsync(balance, $"reservation:{line.Id}", StockMovementKind.Reserve, 0, line.Quantity, 0, actor, order.OrderNumber, ct);
    }

    /// <summary>Releases still-active order reservations; expired/consumed reservations are never released twice.</summary>
    public async Task ReleaseAsync(Guid orderId, Guid actor, CancellationToken ct)
    {
        var reservations = await db.StockReservations.Where(x => x.OrderId == orderId && x.Status == ReservationStatus.Active).ToListAsync(ct);
        foreach (var reservation in reservations)
        {
            var balance = await inventory.BalanceAsync(reservation.ProductId, ct); balance.Release(reservation.Quantity);
            reservation.Status = ReservationStatus.Released; reservation.Version++;
            await inventory.RecordAsync(balance, $"reservation-release:{reservation.Id}", StockMovementKind.Release,
                0, -reservation.Quantity, 0, actor, "Order cancelled before payment", ct);
        }
    }
}

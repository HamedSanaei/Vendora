using Application.Accounting;
using Application.Sms;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Support;

public sealed record TicketSummary(Guid Id, string Subject, string Status, Guid UserId, Guid? OrderId, long Version, DateTime UpdatedAtUtc, string CustomerName = "");
public sealed record TicketEntry(Guid Id, string Author, bool IsStaff, string Text, DateTime CreatedAtUtc);
public sealed record TicketDetails(TicketSummary Ticket, IReadOnlyList<TicketEntry> Messages);

/// <summary>Private text-only support. Ownership/staff identity is determined on the server, never by browser flags.</summary>
public static class SupportTickets
{
    public sealed record List(Guid Actor, bool Admin, int Page = 1, string? Status = null) : IRequest<object>;
    public sealed record Detail(Guid Actor, bool Admin, Guid Id) : IRequest<TicketDetails?>;
    public sealed record Create(Guid Actor, string Key, string Subject, string Text, Guid? OrderId = null) : IRequest<Guid>;
    public sealed record Reply(Guid Actor, bool Admin, Guid Id, long Version, string Text, string Key) : IRequest<Guid>;
    public sealed record SetStatus(Guid Actor, bool Admin, Guid Id, long Version, bool Close, string Key) : IRequest<Guid>;

    /// <summary>Lists only owned conversations unless the authenticated caller has Admin.</summary>
    public sealed class ListHandler(AppDbContext db) : IRequestHandler<List,object>
    {
        public async Task<object> Handle(List request, CancellationToken ct)
        {
            var query = db.SupportTickets.AsNoTracking().Where(x => (request.Admin || x.UserId == request.Actor) && (request.Status == null || x.Status == request.Status));
            int total = await query.CountAsync(ct); int page = Math.Max(1,request.Page);
            var rows = await query.OrderByDescending(x => x.UpdatedAtUtc).Skip((page-1)*25).Take(25).ToListAsync(ct);
            var ids = rows.Select(x => x.UserId).Distinct().ToList();
            var names = await db.Users.AsNoTracking().Where(x => ids.Contains(x.Id)).Select(x => new { x.Id, x.FullName }).ToDictionaryAsync(x => x.Id,x => x.FullName,ct);
            return new { total, page, items = rows.Select(x => Map(x,names.GetValueOrDefault(x.UserId) ?? "")) };
        }
    }

    /// <summary>Returns authored plain text without email/phone/order-private data; inaccessible IDs look missing.</summary>
    public sealed class DetailHandler(AppDbContext db) : IRequestHandler<Detail,TicketDetails?>
    {
        public async Task<TicketDetails?> Handle(Detail request, CancellationToken ct)
        {
            var ticket = await db.SupportTickets.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.Id && (request.Admin || x.UserId == request.Actor), ct);
            if (ticket is null) return null;
            var messages = await db.SupportTicketMessages.AsNoTracking().Where(x => x.TicketId == ticket.Id).OrderBy(x => x.CreatedAtUtc)
                .Select(x => new TicketEntry(x.Id, db.Users.Where(u => u.Id == x.AuthorId).Select(u => u.FullName).FirstOrDefault() ?? "", x.IsStaff, x.Text, DateTime.SpecifyKind(x.CreatedAtUtc,DateTimeKind.Utc))).ToListAsync(ct);
            var name = await db.Users.AsNoTracking().Where(x => x.Id == ticket.UserId).Select(x => x.FullName).SingleOrDefaultAsync(ct);
            return new(Map(ticket,name ?? ""),messages);
        }
    }

    /// <summary>Creates a customer-owned conversation and administrator notification atomically and idempotently.</summary>
    public sealed class CreateHandler(AppDbContext db, AccountingUnitOfWork work, TimeProvider time) : IRequestHandler<Create,Guid>
    {
        public Task<Guid> Handle(Create request, CancellationToken ct) => work.ExecuteAsync(request.Actor, request.Key, "ticket-create", request, async token => {
            if (string.IsNullOrWhiteSpace(request.Subject) || request.Subject.Length > 200) throw new AccountingException("TICKET_INVALID_SUBJECT",400);
            ValidateText(request.Text);
            if (!await db.Users.AnyAsync(x => x.Id == request.Actor, token)) throw new AccountingException("UNAUTHORIZED",401);
            if (!await Application.Auth.CustomerProfile.IsCompleteAsync(db, request.Actor, token)) throw new AccountingException("PROFILE_INCOMPLETE",403);
            if (request.OrderId.HasValue && !await db.Orders.AnyAsync(x => x.Id == request.OrderId && x.UserId == request.Actor, token)) throw new AccountingException("ORDER_NOT_FOUND",404);
            var ticket = new SupportTicket { UserId = request.Actor, OrderId = request.OrderId, Subject = request.Subject.Trim(), CreatedAtUtc = time.GetUtcNow().UtcDateTime, UpdatedAtUtc = time.GetUtcNow().UtcDateTime };
            ticket.Messages.Add(new() { AuthorId = request.Actor, Text = request.Text.Trim(), CreatedAtUtc = time.GetUtcNow().UtcDateTime });
            db.SupportTickets.Add(ticket);
            var events = new SmsNotifications(db,time);
            await events.AdminsAsync("AdminTicketNew", "ticket:" + ticket.Id, new Dictionary<string,string> { ["link"] = await events.LinkAsync("admin/tickets/" + ticket.Id, token) }, token);
            return ticket.Id;
        }, ct);
    }

    /// <summary>Adds a direct authored reply; version and closed-state checks prevent overwriting or silently reopening conversations.</summary>
    public sealed class ReplyHandler(AppDbContext db, AccountingUnitOfWork work, TimeProvider time) : IRequestHandler<Reply,Guid>
    {
        public Task<Guid> Handle(Reply request, CancellationToken ct) => work.ExecuteAsync(request.Actor, request.Key, "ticket-reply", request, async token => {
            ValidateText(request.Text);
            if (!request.Admin && !await Application.Auth.CustomerProfile.IsCompleteAsync(db, request.Actor, token)) throw new AccountingException("PROFILE_INCOMPLETE",403);
            var ticket = await OwnedAsync(db,request.Actor,request.Admin,request.Id,request.Version,token);
            if (ticket.Status == "Closed") throw new AccountingException("TICKET_CLOSED",409);
            var message = new SupportTicketMessage { TicketId = ticket.Id, AuthorId = request.Actor, IsStaff = request.Admin, Text = request.Text.Trim(), CreatedAtUtc = time.GetUtcNow().UtcDateTime };
            db.SupportTicketMessages.Add(message); ticket.Status = request.Admin ? "WaitingForCustomer" : "WaitingForSupport";
            ticket.Version++; ticket.UpdatedAtUtc = time.GetUtcNow().UtcDateTime;
            var events = new SmsNotifications(db,time);
            if (request.Admin) await events.CustomerAsync("TicketReply", "ticket-reply:" + message.Id, ticket.UserId,
                new Dictionary<string,string> { ["link"] = await events.LinkAsync("account/tickets/" + ticket.Id,token) },token);
            else await events.AdminsAsync("AdminTicketReply", "ticket-reply:" + message.Id,
                new Dictionary<string,string> { ["link"] = await events.LinkAsync("admin/tickets/" + ticket.Id,token) },token);
            return message.Id;
        }, ct);
    }

    /// <summary>Explicitly closes or reopens an owned conversation without editing any prior text.</summary>
    public sealed class StatusHandler(AppDbContext db, AccountingUnitOfWork work, TimeProvider time) : IRequestHandler<SetStatus,Guid>
    {
        public Task<Guid> Handle(SetStatus request, CancellationToken ct) => work.ExecuteAsync(request.Actor,request.Key,"ticket-status",request,async token => {
            var ticket = await OwnedAsync(db,request.Actor,request.Admin,request.Id,request.Version,token);
            ticket.Status = request.Close ? "Closed" : "WaitingForSupport"; ticket.Version++; ticket.UpdatedAtUtc = time.GetUtcNow().UtcDateTime; return ticket.Id;
        },ct);
    }

    /// <summary>Checks ownership and optimistic version in the same write transaction.</summary>
    private static async Task<SupportTicket> OwnedAsync(AppDbContext db, Guid actor, bool admin, Guid id, long version, CancellationToken ct)
    {
        var ticket = await db.SupportTickets.SingleOrDefaultAsync(x => x.Id == id && (admin || x.UserId == actor),ct) ?? throw new AccountingException("TICKET_NOT_FOUND",404);
        if (ticket.Version != version) throw new AccountingException("TICKET_CHANGED",409);
        return ticket;
    }
    /// <summary>Validates bounded plain text; React renders it as text, never HTML.</summary>
    private static void ValidateText(string? text) { if (string.IsNullOrWhiteSpace(text) || text.Length > 3000) throw new AccountingException("TICKET_INVALID_TEXT",400); }
    /// <summary>Projects a safe conversation header shared by list/detail views.</summary>
    private static TicketSummary Map(SupportTicket ticket,string name) => new(ticket.Id,ticket.Subject,ticket.Status,ticket.UserId,ticket.OrderId,ticket.Version,DateTime.SpecifyKind(ticket.UpdatedAtUtc,DateTimeKind.Utc),name);
}

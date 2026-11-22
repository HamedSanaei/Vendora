using Domain.Entities;

namespace Application.Egress;

/// <summary>Network safety and testing supplied by the infrastructure layer.</summary>
public interface IEgressNetwork
{
    bool CanProxy(string service);
    Task ValidateProxyAsync(string host, CancellationToken ct);
    Task<EgressCheck> ProbeAsync(string service, EgressProxy? profile, CancellationToken ct);
}

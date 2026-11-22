# Vendora outbound network settings

Open Store management → Network & outbound proxy in the admin panel. Create an HTTP CONNECT, HTTPS CONNECT, or SOCKS5 profile and use **Test proxy with Google**. Assign the profile to individual services and apply each route. Direct is the default. Saving a route affects the next outbound request.

Active integrations and probes

| Service | Adapter | Read-only probe |
| --- | --- | --- |
| Google | `GoogleKeys` | Google's official public JWKS |
| ParsGreen | `ParsGreenSmsGateway` | Public SOAP service description |
| Kavenegar | `KavenegarSmsGateway` | API root |
| TabaPay | `TabaPayGateway` | API root |
| USDT rates | `PublicUsdtRateSource` | Public exchange market response |
| Postex | `PostexRates` | Read-only city reference |
| Neshan | `NeshanAddressGeocoder` | API root |
| 9Router | `NineRouterSeoGateway` | Configured public models endpoint, without credentials |

An upstream HTTP response such as 401 or 404 establishes connectivity only. It does not validate payment, SMS, or provider authorization. The old unused ParsGreen phone adapter is not registered. Incoming callback traffic, browsers, database access and internal 9Router calls stay outside proxy routing. A configured 9Router origin can use a proxy only over HTTPS and with public DNS answers. The server does not accept arbitrary probe destinations.

The HTTP transports verify TLS and disable redirects. SOCKS5 negotiates with the configured proxy and sends the official host name for remote resolution. Public DNS answers are checked and pinned for each TCP connection to a proxy or a direct official host. Proxy-required routes fail if the profile is disabled, cannot be decrypted or the connection fails. The transport never switches to Direct and adds no retries to payment or SMS. Each request is bounded by the adapter timeout and, when proxied, by the profile timeout. Existing adapter retry policies still apply. HTTPS CONNECT also protects the proxy connection itself. With HTTP CONNECT, the upstream service is encrypted but Basic proxy authentication travels over the unencrypted client-to-proxy leg.

Credentials are write-only. Blank credential inputs preserve saved values. Changing the endpoint requires re-entry or explicit removal. Production Data Protection keys live in the API-owned `/data/egress-keys` directory, persistent across deployments. Protect the directory with owner-only access. Keep key-ring backups access-controlled and separate from SQLite backups. Restoring the database without the matching keys requires re-entering credentials. Configuration changes are audited without copying password or username fields.

## Rollout and recovery

1. Deploy the additive migration and confirm the API health check. Existing installations also default to Direct until assigned. Remove stale `Google__EgressProxy` from host configuration when convenient. It no longer changes routing.
2. Test the saved profile and each service from the admin panel. For a server operator, `docker exec -i vendora-api dotnet API.dll --vendora-import-egress` accepts one JSON line on stdin with `name`, `url` and `services`. Provide the literal credential-bearing URL via a private input source rather than shell history, repository, or command-line args. Import checks destinations before assigning reachable services and requires a working Google probe when Google is selected.
3. Check an actual authorized Google sign-in and watch service-specific results. If needed, set any affected service to Direct and apply the change. Do so before removing a profile. Turning off an assigned profile blocks requests, so it is useful for an intentional stop.
4. If rolling back the API image, keep the additive tables and key ring. Use the prior release's documented Google settings only if returning to the prior image.

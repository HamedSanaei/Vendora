namespace Application.Egress;

/// <summary>Fixed server-side integration destinations. Probes never take a URL from an administrator.</summary>
public static class EgressCatalog
{
    public const string Google = "google";
    public const string ParsGreen = "parsgreen";
    public const string Kavenegar = "kavenegar";
    public const string TabaPay = "tabapay";
    public const string Rates = "rates";
    public const string Postex = "postex";
    public const string Neshan = "neshan";
    public const string Seo = "seo";

    public sealed record Service(string Id, Uri? Probe, string[] Hosts, int MaxBytes = 2 * 1024 * 1024);

    public static IReadOnlyDictionary<string, Service> Services { get; } = new Service[]
    {
        new(Google, new("https://www.googleapis.com/oauth2/v3/certs"), ["www.googleapis.com"], 128 * 1024),
        new(ParsGreen, new("https://login.parsgreen.com/Api/SendSMS.asmx?WSDL"), ["login.parsgreen.com", "sms.parsgreen.ir"], 64 * 1024),
        new(Kavenegar, new("https://api.kavenegar.com/"), ["api.kavenegar.com"], 64 * 1024),
        new(TabaPay, new("https://api.tabapay.ir/"), ["api.tabapay.ir"], 64 * 1024),
        new(Rates, new("https://api.wallex.ir/v1/markets"), ["api.wallex.ir", "apiv2.nobitex.ir", "api.abantether.com"]),
        new(Postex, new("https://api.postex.ir/api/v1/locality/cities/all"), ["api.postex.ir"], 16 * 1024 * 1024),
        new(Neshan, new("https://api.neshan.org/"), ["api.neshan.org"]),
        new(Seo, null, [])
    }.ToDictionary(x => x.Id);
}

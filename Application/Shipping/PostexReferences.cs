using System.Text.Json;

namespace Application.Shipping;

/// <summary>Normalizes the vendor's public catalogs into a narrow UI contract with no account information.</summary>
public static class PostexReferences
{
    public sealed record Item(string Code, string Name, string? Province = null, string? CourierCode = null);

    /// <summary>Reads the published city hierarchy and IR_POST service catalog; unknown shapes produce no selectable entries.</summary>
    public static IReadOnlyList<Item> Items(string resource, JsonElement json)
    {
        var items = new List<Item>();
        Walk(json, null);
        return items.Distinct().ToList();

        void Walk(JsonElement node, string? province)
        {
            if (node.ValueKind == JsonValueKind.Array) { foreach (var child in node.EnumerateArray()) Walk(child, province); return; }
            if (node.ValueKind != JsonValueKind.Object) return;
            string Text(params string[] fields) => fields.Select(key => node.TryGetProperty(key, out var value) && value.ValueKind is JsonValueKind.String or JsonValueKind.Number ? value.ToString() : "").FirstOrDefault(x => x.Length > 0) ?? "";
            var name = Text("name", "title", "text", "courierServiceName", "label");
            if (resource == "cities" && province is not null)
            {
                var code = Text("id", "code");
                if (code.Length > 0 && name.Length > 0) items.Add(new(code, name, province));
            }
            else if (resource == "methods" && Text("courierCode") == "IR_POST")
            {
                var code = Text("courierServiceCode");
                if (code.Length > 0) items.Add(new(code, name.Length > 0 ? name : code, CourierCode: "IR_POST"));
            }
            else if (resource is "boxes" or "payments")
            {
                var code = Text("value", "id", "code");
                if (code.Length > 0) items.Add(new(code, name.Length > 0 ? name : code));
            }
            foreach (var property in node.EnumerateObject())
                if (property.Value.ValueKind is JsonValueKind.Array or JsonValueKind.Object) Walk(property.Value, property.Name == "cities" ? name : province);
        }
    }
}

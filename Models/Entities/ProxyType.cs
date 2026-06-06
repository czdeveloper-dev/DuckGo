namespace DuckGo.Models.Entities;

public class ProxyType
{
    public int Id { get; set; }
    public string Value { get; set; } = "";
    public string Label { get; set; } = "";
    public int DisplayOrder { get; set; }
}

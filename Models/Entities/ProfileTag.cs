namespace DuckGo.Models.Entities;

public class ProfileTag
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}

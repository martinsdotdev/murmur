using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Murmur.Models;

public sealed class SoundCatalog
{
    private static readonly Lazy<SoundCatalog> _instance = new(() => new SoundCatalog());
    public static SoundCatalog Instance => _instance.Value;

    public IReadOnlyList<Sound> BuiltIn { get; }
    public ObservableCollection<Sound> Custom { get; } = new();

    public IEnumerable<Sound> All => BuiltIn.Concat(Custom);

    private SoundCatalog()
    {
        BuiltIn = new[]
        {
            Built("birds", "Birds", "nature"),
            Built("rain", "Rain", "nature"),
            Built("storm", "Storm", "nature"),
            Built("stream", "Stream", "nature"),
            Built("summer-night", "Summer night", "nature"),
            Built("waves", "Waves", "nature"),
            Built("wind", "Wind", "nature"),
            Built("boat", "Boat", "urban"),
            Built("city", "City", "urban"),
            Built("coffee-shop", "Coffee shop", "urban"),
            Built("fireplace", "Fireplace", "urban"),
            Built("train", "Train", "urban"),
            Built("pink-noise", "Pink noise", "generated"),
            Built("white-noise", "White noise", "generated"),
            Built("brown-noise", "Brown noise", "generated"),
        };
    }

    private static Sound Built(string id, string display, string category)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Sounds", $"{id}.ogg");
        return new Sound(id, display, category, new Uri(path, UriKind.Absolute));
    }

    public Sound? FindById(string id) => All.FirstOrDefault(s => s.Id == id);

    /// <summary>Slugifies <paramref name="baseName"/> and appends 8 hex from a fresh GUID.
    /// Capped at 100 retries with a throw so a corrupted catalog can't loop forever.</summary>
    public string MakeUniqueId(string baseName, string fallbackSlug)
    {
        var slug = Regex.Replace(baseName.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrEmpty(slug))
            slug = fallbackSlug;
        if (slug.Length > 32)
            slug = slug[..32].TrimEnd('-');

        for (int attempt = 0; attempt < 100; attempt++)
        {
            var id = $"{slug}-{Guid.NewGuid().ToString("N")[..8]}";
            if (!All.Any(s => s.Id == id))
                return id;
        }
        throw new InvalidOperationException(
            $"Could not generate a unique sound id for '{baseName}'."
        );
    }
}

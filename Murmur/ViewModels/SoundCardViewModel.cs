using System;
using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using Murmur.Models;
using Murmur.Services;

namespace Murmur.ViewModels;

public sealed partial class SoundCardViewModel : ObservableObject
{
    public Sound Sound { get; }
    private readonly IMixerService _mixer;

    // Default first-toggle level when the user has never set a non-zero volume on this card.
    private double _lastNonZeroVolume = 0.7;

    [ObservableProperty]
    public partial double Volume { get; set; }

    public string Id => Sound.Id;
    public string DisplayName => Sound.DisplayName;
    public string Category => Sound.Category;
    public bool IsCustom => Sound.IsCustom;
    public string CategoryDisplay { get; }
    public string IconPath { get; }

    public string VolumePercentText =>
        IsActive
            ? ((int)Math.Round(Volume * 100)).ToString(CultureInfo.InvariantCulture) + "%"
            : "";

    public string AccessibleName =>
        IsActive
            ? $"{DisplayName}, {VolumePercentText} volume, {CategoryDisplay}"
            : $"{DisplayName}, off, {CategoryDisplay}";

    public bool IsActive
    {
        get => Volume > 0;
        set
        {
            if (value == IsActive)
                return;
            Volume = value ? (_lastNonZeroVolume > 0 ? _lastNonZeroVolume : 0.7) : 0;
        }
    }

    public event EventHandler<double>? VolumeChanged;

    public SoundCardViewModel(Sound sound, IMixerService mixer)
    {
        Sound = sound;
        _mixer = mixer;
        IconPath = PathFor(sound.Id);
        CategoryDisplay = CapitalizeFirst(sound.Category);
    }

    partial void OnVolumeChanged(double oldValue, double newValue)
    {
        _mixer.SetSoundVolume(Sound.Id, newValue);
        if (newValue > 0)
            _lastNonZeroVolume = newValue;

        // Slider drags emit dozens of OnVolumeChanged ticks per second, only invalidate
        // downstream bindings whose displayed value actually changed.
        if ((oldValue > 0) != (newValue > 0))
        {
            OnPropertyChanged(nameof(IsActive));
        }
        if ((int)Math.Round(oldValue * 100) != (int)Math.Round(newValue * 100))
        {
            OnPropertyChanged(nameof(VolumePercentText));
            OnPropertyChanged(nameof(AccessibleName));
        }

        VolumeChanged?.Invoke(this, newValue);
    }

    private static string CapitalizeFirst(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToUpperInvariant(s[0]) + s[1..];

    // SVG path data from lucide.dev (24-unit viewBox). Per-icon comments label otherwise
    // opaque path strings.
    private static string PathFor(string id) =>
        id switch
        {
            // bird
            "birds" =>
                "M16 7h.01 M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20 M20 7l2 .5-2 .5 M10 18v3 M14 17.75V21 M7 18a6 6 0 0 0 3.84-10.61",

            // cloud-rain
            "rain" =>
                "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242 M16 14v6 M8 14v6 M12 16v6",

            // cloud-lightning
            "storm" => "M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973 M13 12l-3 5h4l-3 5",

            // droplets
            "stream" =>
                "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97",

            // moon-star
            "summer-night" =>
                "M18 5h4 M20 3v4 M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",

            // waves
            "waves" =>
                "M2 12q2.5 2 5 0t5 0 5 0 5 0 M2 19q2.5 2 5 0t5 0 5 0 5 0 M2 5q2.5 2 5 0t5 0 5 0 5 0",

            // wind
            "wind" =>
                "M12.8 19.6A2 2 0 1 0 14 16H2 M17.5 8a2.5 2.5 0 1 1 2 4H2 M9.8 4.4A2 2 0 1 1 11 8H2",

            // sailboat
            "boat" =>
                "M10 2v15 M7 22a4 4 0 0 1-4-4 1 1 0 0 1 1-1h16a1 1 0 0 1 1 1 4 4 0 0 1-4 4z M9.159 2.46a1 1 0 0 1 1.521-.193l9.977 8.98A1 1 0 0 1 20 13H4a1 1 0 0 1-.824-1.567z",

            // building-2
            "city" =>
                "M10 12h4 M10 8h4 M14 21v-3a2 2 0 0 0-4 0v3 M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2 M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",

            // coffee
            "coffee-shop" =>
                "M10 2v2 M14 2v2 M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1 M6 2v2",

            // flame
            "fireplace" =>
                "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4",

            // train-front
            "train" =>
                "M8 3.1V7a4 4 0 0 0 8 0V3.1 M9 15l-1-1 M15 15l1-1 M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z M8 19l-2 3 M16 19l2 3",

            // audio-waveform
            "pink-noise" =>
                "M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2",

            // audio-lines
            "white-noise" => "M2 10v3 M6 6v11 M10 3v18 M14 8v7 M18 5v13 M22 10v3",

            // chart-no-axes-column-decreasing
            "brown-noise" => "M12 20V10 M18 20v-4 M6 20V4",

            // music
            _ =>
                "M9 18V5l12-2v13 M3 18A3 3 0 1 0 9 18A3 3 0 1 0 3 18Z M15 16A3 3 0 1 0 21 16A3 3 0 1 0 15 16Z",
        };
}

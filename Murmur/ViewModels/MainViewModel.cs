using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Murmur.Helpers;
using Murmur.Models;
using Murmur.Services;

namespace Murmur.ViewModels;

public sealed partial class MainViewModel : ObservableObject, IDisposable
{
    private readonly IMixerService _mixer;
    private readonly PowerService _power = new();
    private readonly Microsoft.UI.Dispatching.DispatcherQueue? _uiDispatcher;

    private AppState? _state;
    private PresetService? _presetService;
    private bool _suppressVolumeWrites;

    [ObservableProperty]
    public partial bool IsPlaying { get; set; }

    [ObservableProperty]
    public partial bool IsReady { get; set; }

    [ObservableProperty]
    public partial double MasterVolume { get; set; } = 1.0;

    [ObservableProperty]
    public partial string StatusMessage { get; set; } = "Initializing audio engine…";

    [ObservableProperty]
    public partial Preset? ActivePreset { get; set; }

    [ObservableProperty]
    public partial bool InhibitSuspension { get; set; }

    [ObservableProperty]
    public partial bool BackgroundPlayback { get; set; } = true;

    [ObservableProperty]
    public partial bool AutoStart { get; set; }

    [ObservableProperty]
    public partial bool StartPaused { get; set; }

    [ObservableProperty]
    public partial int ThemeIndex { get; set; }

    [ObservableProperty]
    public partial int ActiveSoundCount { get; set; }

    [ObservableProperty]
    public partial bool IsGridView { get; set; }
    public bool IsListView => !IsGridView;

    // Segoe Fluent Icons. Toggle shows the OTHER view's icon, clicking it switches to that view.
    public string ViewToggleGlyph => IsGridView ? "" : ""; // List : GridView
    public string ViewToggleAccessibleName =>
        IsGridView ? "Switch to list view" : "Switch to grid view";
    public string ViewToggleTooltip =>
        IsGridView ? "Switch to list view (Ctrl+G)" : "Switch to grid view (Ctrl+G)";

    public ObservableCollection<SoundCardViewModel> SoundCards { get; } = new();

    public string HintMessage =>
        ActiveSoundCount == 0
            ? "No sounds playing. Toggle a tile or drag its slider to start a mix."
            : $"Currently playing {SoundCountText.Format(ActiveSoundCount)}. Toggle a tile or drag its slider to adjust.";

    public string NowPlayingSubtitle
    {
        get
        {
            if (!IsPlaying)
                return "Paused";
            if (ActiveSoundCount == 0)
                return "Idle";
            return $"{SoundCountText.Format(ActiveSoundCount)} playing";
        }
    }

    private readonly ObservableCollection<Preset> _emptyPresets = new();
    public ObservableCollection<Preset> Presets => _state?.Presets ?? _emptyPresets;

    public string PlayPauseLabel => IsPlaying ? "Pause" : "Play";

    public string PlayPauseGlyph => IsPlaying ? "" : "";

    public MainViewModel(IMixerService mixer)
    {
        _mixer = mixer;
        // Constructed on the UI thread (see MainWindow ctor), capture dispatcher for
        // marshaling mixer events that fire on non-UI threads.
        _uiDispatcher = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
        _mixer.PlayStateChanged += OnMixerPlayStateChanged;
        _mixer.StreamAttachFailed += OnStreamAttachFailed;
    }

    private void OnStreamAttachFailed(object? sender, string message)
    {
        if (_uiDispatcher is null || _uiDispatcher.HasThreadAccess)
        {
            StatusMessage = message;
        }
        else
        {
            _uiDispatcher.TryEnqueue(() => StatusMessage = message);
        }
    }

    private void OnMixerPlayStateChanged(object? sender, EventArgs e)
    {
        IsPlaying = _mixer.IsPlaying;
        if (_state is not null && !_suppressVolumeWrites)
        {
            _state.Playing = IsPlaying;
            _state.RequestSave();
        }
    }

    public async Task InitializeAsync()
    {
        _state = App.State = await AppState.LoadOrCreateAsync();
        _state.Initialize(Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread());

        // Push the loaded preset list to the ComboBox BEFORE setting ActivePreset, so the
        // SelectedItem reference lookup can succeed.
        OnPropertyChanged(nameof(Presets));

        await _mixer.InitializeAsync();

        StatusMessage = $"Decoding {SoundCatalog.Instance.BuiltIn.Count} sounds…";
        var registerTasks = SoundCatalog
            .Instance.BuiltIn.Select(s => _mixer.RegisterSoundAsync(s))
            .ToArray();
        await Task.WhenAll(registerTasks);

        foreach (var sound in SoundCatalog.Instance.BuiltIn)
        {
            AddCardFor(sound);
        }

        // Wire import services BEFORE restore, RestoreSavedAsync mutates catalog.Custom,
        // which fires CollectionChanged that we listen to below.
        SoundCatalog.Instance.Custom.CollectionChanged += OnCustomSoundsCollectionChanged;
        App.ImportService = new CustomAudioImportService(_mixer, SoundCatalog.Instance, _state);
        App.YouTubeService = new YouTubeAudioImportService(_mixer, SoundCatalog.Instance, _state);
        await App.ImportService.RestoreSavedAsync();
        await App.YouTubeService.RestoreSavedAsync();

        _suppressVolumeWrites = true;
        try
        {
            MasterVolume = _state.MasterVolume;
            InhibitSuspension = _state.InhibitSuspension;
            BackgroundPlayback = _state.BackgroundPlayback;
            AutoStart = _state.AutoStart;
            StartPaused = _state.StartPaused;
            ThemeIndex = ParseThemeIndex(_state.Theme);
            IsGridView = _state.IsGridView;
        }
        finally
        {
            _suppressVolumeWrites = false;
        }
        _mixer.MasterVolume = MasterVolume;
        ApplyThemeToWindow(ThemeIndex);

        _presetService = App.PresetService = new PresetService(
            _state,
            _mixer,
            SoundCatalog.Instance
        );
        _presetService.PresetApplied += OnPresetApplied;
        ApplyActivePreset();

        if (_state.Playing && !_state.StartPaused)
        {
            _mixer.Play();
        }

        IsReady = true;
        StatusMessage = $"Ready. Active preset: {ActivePreset?.VisibleName ?? "Default"}.";
    }

    private void ApplyActivePreset()
    {
        if (_state is null || _presetService is null)
            return;

        if (!_state.Presets.Any(p => p.Id == _state.ActivePresetId))
        {
            _state.ActivePresetId = AppState.DefaultPresetId;
        }

        _presetService.Apply(_state.ActivePresetId);
        ActivePreset = _state.ActivePreset;
    }

    private void OnPresetApplied(object? sender, Preset preset)
    {
        _suppressVolumeWrites = true;
        try
        {
            foreach (var card in SoundCards)
            {
                card.Volume = preset.SoundVolumes.TryGetValue(card.Id, out var v) ? v : 0.0;
            }
        }
        finally
        {
            _suppressVolumeWrites = false;
        }
        ActivePreset = preset;
        RecomputeActiveSoundCount();
        StatusMessage = $"Loaded preset: {preset.VisibleName}.";
        App.Smtc?.UpdatePresetName(preset.VisibleName);
        App.Tray.UpdateTooltip($"Murmur - {preset.VisibleName}");
    }

    private void OnSoundCardVolumeChanged(object? sender, double volume)
    {
        RecomputeActiveSoundCount();
        if (_suppressVolumeWrites || _presetService is null)
            return;
        if (sender is SoundCardViewModel vm)
        {
            _presetService.UpdateActivePresetVolume(vm.Id, volume);
        }
    }

    private void RecomputeActiveSoundCount()
    {
        int count = 0;
        foreach (var card in SoundCards)
        {
            if (card.IsActive)
                count++;
        }
        ActiveSoundCount = count;
    }

    private void AddCardFor(Sound sound)
    {
        var card = new SoundCardViewModel(sound, _mixer);
        card.VolumeChanged += OnSoundCardVolumeChanged;
        SoundCards.Add(card);
    }

    private void RemoveCardFor(Sound sound)
    {
        var card = SoundCards.FirstOrDefault(c => c.Id == sound.Id);
        if (card is null)
            return;
        card.VolumeChanged -= OnSoundCardVolumeChanged;
        SoundCards.Remove(card);
        RecomputeActiveSoundCount();
    }

    private void OnCustomSoundsCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (e.NewItems is not null)
        {
            foreach (Sound sound in e.NewItems)
                AddCardFor(sound);
        }
        if (e.OldItems is not null)
        {
            foreach (Sound sound in e.OldItems)
                RemoveCardFor(sound);
        }
    }

    public async Task<Sound?> ImportCustomAudioAsync(Microsoft.UI.Xaml.Window owner)
    {
        if (App.ImportService is null)
            return null;
        try
        {
            return await App.ImportService.ImportAsync(owner);
        }
        catch (Exception ex)
        {
            StatusMessage = $"Import failed: {ex.Message}";
            return null;
        }
    }

    public async Task<Sound?> ImportYouTubeAudioAsync(string watchUrl)
    {
        if (App.YouTubeService is null)
            return null;
        StatusMessage = "Resolving YouTube URL…";
        DiagnosticLog.Log($"YouTube import requested: {watchUrl}");
        try
        {
            var sound = await App.YouTubeService.ImportAsync(watchUrl);
            StatusMessage = $"Added \"{sound.DisplayName}\". Drag its slider above 0 to play.";
            return sound;
        }
        catch (Exception ex)
        {
            // Full type + stack: YoutubeExplode breaks regularly when YouTube changes
            // internals; log enough to diagnose without re-running under a debugger.
            DiagnosticLog.Log(
                $"YouTube import failed for '{watchUrl}': {ex.GetType().Name}: {ex.Message}\n{ex}"
            );
            StatusMessage = $"YouTube import failed: {ex.Message}";
            return null;
        }
    }

    partial void OnMasterVolumeChanged(double value)
    {
        _mixer.MasterVolume = value;
        if (_state is not null && !_suppressVolumeWrites)
        {
            _state.MasterVolume = value;
            _state.RequestSave();
        }
    }

    partial void OnIsPlayingChanged(bool value)
    {
        OnPropertyChanged(nameof(PlayPauseLabel));
        OnPropertyChanged(nameof(PlayPauseGlyph));
        OnPropertyChanged(nameof(NowPlayingSubtitle));
        UpdatePowerInhibit();
        App.Smtc?.UpdatePlayState(value);
    }

    partial void OnActiveSoundCountChanged(int value)
    {
        OnPropertyChanged(nameof(HintMessage));
        OnPropertyChanged(nameof(NowPlayingSubtitle));
    }

    partial void OnInhibitSuspensionChanged(bool value)
    {
        if (_state is not null && !_suppressVolumeWrites)
        {
            _state.InhibitSuspension = value;
            _state.RequestSave();
        }
        UpdatePowerInhibit();
    }

    partial void OnBackgroundPlaybackChanged(bool value)
    {
        if (_state is not null && !_suppressVolumeWrites)
        {
            _state.BackgroundPlayback = value;
            _state.RequestSave();
        }
    }

    partial void OnIsGridViewChanged(bool value)
    {
        OnPropertyChanged(nameof(IsListView));
        OnPropertyChanged(nameof(ViewToggleGlyph));
        OnPropertyChanged(nameof(ViewToggleAccessibleName));
        OnPropertyChanged(nameof(ViewToggleTooltip));
        if (_state is not null && !_suppressVolumeWrites)
        {
            _state.IsGridView = value;
            _state.RequestSave();
        }
    }

    partial void OnStartPausedChanged(bool value)
    {
        if (_state is not null && !_suppressVolumeWrites)
        {
            _state.StartPaused = value;
            _state.RequestSave();
        }
    }

    private long _autoStartVersion;

    partial void OnAutoStartChanged(bool value)
    {
        if (_state is not null && !_suppressVolumeWrites)
        {
            _state.AutoStart = value;
            _state.RequestSave();
            // Version-token so an out-of-order completion can't roll back a newer toggle.
            long version = Interlocked.Increment(ref _autoStartVersion);
            _ = ApplyAutoStartAsync(value, version);
        }
    }

    private async Task ApplyAutoStartAsync(bool wantOn, long version)
    {
        var state = await App.Startup.SetEnabledAsync(wantOn);
        if (Interlocked.Read(ref _autoStartVersion) != version)
            return;

        var actuallyOn =
            state
            is Windows.ApplicationModel.StartupTaskState.Enabled
                or Windows.ApplicationModel.StartupTaskState.EnabledByPolicy;
        if (actuallyOn != AutoStart)
        {
            // Reflect actual state, group policy / unpackaged build / user-disabled-in-Task-Manager.
            _suppressVolumeWrites = true;
            try
            {
                AutoStart = actuallyOn;
            }
            finally
            {
                _suppressVolumeWrites = false;
            }
            if (_state is not null)
            {
                _state.AutoStart = actuallyOn;
                _state.RequestSave();
            }
            StatusMessage = $"Autostart unavailable ({state}) - toggle reverted.";
        }
    }

    partial void OnThemeIndexChanged(int value)
    {
        if (_state is not null && !_suppressVolumeWrites)
        {
            _state.Theme = ThemeIndexToString(value);
            _state.RequestSave();
        }
        ApplyThemeToWindow(value);
    }

    private static int ParseThemeIndex(string theme) =>
        theme switch
        {
            "Light" => 1,
            "Dark" => 2,
            _ => 0,
        };

    private static string ThemeIndexToString(int index) =>
        index switch
        {
            1 => "Light",
            2 => "Dark",
            _ => "Default",
        };

    private static void ApplyThemeToWindow(int index)
    {
        var theme = index switch
        {
            1 => Microsoft.UI.Xaml.ElementTheme.Light,
            2 => Microsoft.UI.Xaml.ElementTheme.Dark,
            _ => Microsoft.UI.Xaml.ElementTheme.Default,
        };
        if (App.MainWindow?.Content is Microsoft.UI.Xaml.FrameworkElement root)
        {
            root.RequestedTheme = theme;
        }
    }

    private void UpdatePowerInhibit()
    {
        if (IsPlaying && InhibitSuspension)
            _power.Activate();
        else
            _power.Release();
    }

    partial void OnActivePresetChanged(Preset? value)
    {
        if (value is null || _presetService is null)
            return;
        if (_state is not null && _state.ActivePresetId != value.Id)
        {
            _presetService.Apply(value.Id);
        }
    }

    [RelayCommand]
    private void PlayPause()
    {
        if (_mixer.IsPlaying)
            _mixer.Pause();
        else
            _mixer.Play();
    }

    public void ResetMix()
    {
        foreach (var card in SoundCards)
        {
            if (card.Volume != 0)
                card.Volume = 0;
        }
    }

    public Preset? SaveCurrentAsNewPreset(string name) => _presetService?.SaveCurrentAs(name);

    public void RenameActivePreset(string newName)
    {
        if (_presetService is null || ActivePreset is null)
            return;
        _presetService.Rename(ActivePreset.Id, newName);
        OnPropertyChanged(nameof(ActivePreset));
    }

    public Preset? DuplicateActivePreset()
    {
        if (_presetService is null || ActivePreset is null)
            return null;
        var copy = _presetService.Duplicate(ActivePreset.Id);
        return copy;
    }

    public void DeleteActivePreset()
    {
        if (_presetService is null || ActivePreset is null)
            return;
        _presetService.Delete(ActivePreset.Id);
    }

    private bool _disposed;

    public void Dispose()
    {
        if (_disposed)
            return;
        _disposed = true;

        _mixer.PlayStateChanged -= OnMixerPlayStateChanged;
        _mixer.StreamAttachFailed -= OnStreamAttachFailed;
        SoundCatalog.Instance.Custom.CollectionChanged -= OnCustomSoundsCollectionChanged;
        if (_presetService is not null)
        {
            _presetService.PresetApplied -= OnPresetApplied;
        }
        foreach (var card in SoundCards)
        {
            card.VolumeChanged -= OnSoundCardVolumeChanged;
        }
        _power.Dispose();
    }
}

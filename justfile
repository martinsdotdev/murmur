# Task runner for Murmur. `just` lists recipes; `just <name>` runs one.
#
# Detects PROCESSOR_ARCHITECTURE at parse time and maps AMD64 -> x64 so the
# Platform value matches the .csproj <Platforms> declaration (x86;x64;ARM64).
# Building with Platform=AMD64 produces a non-canonical obj/AMD64 tree.

set windows-shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-Command"]

project := "Murmur"
tfm     := "net10.0-windows10.0.26100.0"

arch     := env_var_or_default("PROCESSOR_ARCHITECTURE", "AMD64")
platform := if arch == "ARM64" { "ARM64" } else { if arch == "x86" { "x86" } else { "x64" } }
rid      := lowercase(platform)

state-dir   := env_var_or_default("LOCALAPPDATA", "") + "\\Murmur"
state-file  := state-dir + "\\state.json"
log-file    := state-dir + "\\debug.log"
custom-dir  := state-dir + "\\CustomAudio"

# List recipes.
default:
    @just --list

# ---- Build / Run --------------------------------------------------------

# Debug build for the current architecture.
build:
    cd {{project}}; dotnet build -c Debug -p:Platform={{platform}}

# Release build for the current architecture.
build-release:
    cd {{project}}; dotnet build -c Release -p:Platform={{platform}}

# Quick unpackaged run. StartupTask and tray "Run on startup" only work after `just register`.
run:
    cd {{project}}; dotnet run -c Debug -p:Platform={{platform}}

# Restore NuGet packages.
restore:
    cd {{project}}; dotnet restore

# `dotnet clean` for both configs (continues if either is a no-op).
clean:
    cd {{project}}; dotnet clean -c Debug -p:Platform={{platform}}; dotnet clean -c Release -p:Platform={{platform}}

# Nuke bin/ and obj/ entirely. Use when intermediates are corrupted or after switching SDK versions.
clean-deep:
    if (Test-Path "{{project}}/bin") { Remove-Item -Recurse -Force "{{project}}/bin"; Write-Host "Removed {{project}}/bin" }; if (Test-Path "{{project}}/obj") { Remove-Item -Recurse -Force "{{project}}/obj"; Write-Host "Removed {{project}}/obj" }

# Publish a Release artifact via the win-$(Platform).pubxml profile.
publish:
    cd {{project}}; dotnet publish -c Release -p:Platform={{platform}}

# ---- Format / Lint ------------------------------------------------------

# Apply formatting and analyzer fixes in-place per .editorconfig + stylecop.json.
format:
    cd {{project}}; dotnet format

# Apply only whitespace fixes (faster; skips style + analyzer phases).
format-whitespace:
    cd {{project}}; dotnet format whitespace

# Verify formatting without writing. Exits non-zero if any file would change. CI-friendly.
format-check:
    cd {{project}}; dotnet format --verify-no-changes

# Build with minimal output, surfacing only CA*/SA*/IDE* warnings + errors.
lint:
    cd {{project}}; dotnet build -c Debug -p:Platform={{platform}} --verbosity:minimal -nologo

# ---- Sounds -------------------------------------------------------------

# Make Sounds/brown-noise.ogg (CC0): a seamless 20 s stereo loop at -27 LUFS.
brown-noise:
    ffmpeg -y -f lavfi -i "anoisesrc=color=brown:seed=1:sample_rate=44100:duration=22" -f lavfi -i "anoisesrc=color=brown:seed=2:sample_rate=44100:duration=22" -filter_complex "[0][1]join=inputs=2:channel_layout=stereo,highpass=f=20,asplit[a][b];[a]atrim=2:22,asetpts=PTS-STARTPTS[body];[b]atrim=0:2,asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=2:c1=qsin:c2=qsin,volume=-14.4dB" -c:a libvorbis -q:a 4 "{{project}}/Sounds/brown-noise.ogg"

# ---- MSIX install -------------------------------------------------------

# Build then sideload-register so Start menu, autostart, and the tray icon work.
deploy: build register

# Register the most recent Debug MSIX with Windows.
register:
    Add-AppxPackage -Register "{{project}}/bin/{{platform}}/Debug/{{tfm}}/win-{{rid}}/AppxManifest.xml"

# Register the most recent Release MSIX.
register-release:
    Add-AppxPackage -Register "{{project}}/bin/{{platform}}/Release/{{tfm}}/win-{{rid}}/AppxManifest.xml"

# Unregister every Murmur* package. Run before reinstalling from a fresh build if the registration is sticky.
unregister:
    Get-AppxPackage Murmur* | Remove-AppxPackage

# Confirm Developer Mode is on. Sideload registration silently no-ops without it.
check-devmode:
    Get-WindowsDeveloperLicense

# ---- Process ------------------------------------------------------------

# Force-kill a stuck Murmur.exe. The single-instance redirection in Program.cs
# can leave a zombie after a crash, blocking the next launch.
kill:
    taskkill /IM Murmur.exe /F

# ---- Tests --------------------------------------------------------------

# Run tests. Optional filter matches FullyQualifiedName~PATTERN.
# Requires a sibling Murmur.Tests/ project; see Murmur/.github/instructions/testing.instructions.md.
test filter='':
    if ('{{filter}}' -eq '') { cd {{project}}.Tests; dotnet test -c Debug -p:Platform={{platform}} } else { cd {{project}}.Tests; dotnet test -c Debug -p:Platform={{platform}} --filter "FullyQualifiedName~{{filter}}" }

# ---- User-data debugging ------------------------------------------------

# Tail the rolling diagnostic log.
log:
    Get-Content -Path "{{log-file}}" -Wait -Tail 50

# Open the diagnostic log in the default editor.
log-open:
    Invoke-Item "{{log-file}}"

# Open %LOCALAPPDATA%\Murmur in Explorer (state.json, debug.log, CustomAudio\).
appdata:
    Invoke-Item "{{state-dir}}"

# Delete persisted preferences (presets, master volume, theme, view mode).
wipe-state:
    if (Test-Path "{{state-file}}") { Remove-Item "{{state-file}}" -Force; Write-Host "Removed {{state-file}}" } else { Write-Host "No state file at {{state-file}}." }

# Delete imported custom audio.
wipe-customs:
    if (Test-Path "{{custom-dir}}") { Remove-Item "{{custom-dir}}" -Recurse -Force; Write-Host "Removed {{custom-dir}}." } else { Write-Host "No CustomAudio folder." }

# Wipe state, customs, and log. Factory reset.
wipe-all: wipe-state wipe-customs
    if (Test-Path "{{log-file}}") { Remove-Item "{{log-file}}" -Force; Write-Host "Removed {{log-file}}." }

# Print the resolved variables (useful when build paths look wrong).
env:
    @Write-Host "arch     = {{arch}}"
    @Write-Host "platform = {{platform}}"
    @Write-Host "rid      = {{rid}}"
    @Write-Host "tfm      = {{tfm}}"
    @Write-Host "state    = {{state-dir}}"

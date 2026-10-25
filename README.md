# Murmur

Murmur plays ambient sounds while you work, read or fall asleep. Layer rain over a fireplace, or a train over white noise, set each one's volume, and save the blend to come back to.

It runs on Windows and in the browser. It's free, open source under GPLv3, and has no telemetry, no account and no ads.

- Use it in the browser at [murmur.umaru.dev](https://murmur.umaru.dev/)
- Download it for Windows from [Releases](https://github.com/martinsdotdev/Murmur/releases)

## Sounds

Fourteen sounds come built in:

| Nature                                                | Urban                                     | Generated               |
| ----------------------------------------------------- | ----------------------------------------- | ----------------------- |
| Birds, Rain, Storm, Stream, Summer night, Waves, Wind | Boat, City, Coffee shop, Fireplace, Train | Pink noise, White noise |

You can add your own audio files and YouTube links next to them, and save any blend as a mix.

## Windows and the browser

Both apps play the same fourteen files. Here is where they differ.

|                   | Windows                                                                             | Browser                                                                        |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Your own audio    | OGG files                                                                           | Any format the browser plays, such as MP3 or M4A                               |
| YouTube links     | Streams the audio alone                                                             | Plays the whole video in a hidden player                                       |
| In the background | Closes to the tray and keeps playing. Media keys work, and it can launch at startup | Installs as an app, and the built-in sounds can be saved for offline use       |
| Also              | Can keep the PC from sleeping while a sound plays                                   | Sleep timer, share links for mixes, and a backup file of your mixes and sounds |
| Languages         | English                                                                             | English, Portuguese (Brazil), Spanish and Japanese                             |

Safari plays the built-in sounds from version 18.4. On an iPhone, a YouTube sound's level is set with the phone's volume buttons, since iOS doesn't let a page change a video's volume.

## Install on Windows

Murmur runs on Windows 10 (build 19041 or later) and Windows 11, on x64 and ARM64.

Releases are signed with a self-signed certificate, which keeps them free to publish. Windows won't install the package until you trust that certificate:

1. From the [latest release](https://github.com/martinsdotdev/Murmur/releases/latest), download `Murmur-<version>.cer`. Right-click it, choose **Install Certificate**, and put it in **Local Machine → Trusted People**. Windows asks for admin approval.
2. Download the `.msixbundle` for your CPU: `x64` for most PCs, `arm64` for Snapdragon PCs and the Surface Pro X.
3. Double-click the `.msixbundle`. Murmur appears in your Start menu.

Every release is signed with a new certificate, so trust the `.cer` that comes with the release you're installing. A Microsoft Store release may remove this step later.

## Build from source

| Folder               | What's in it                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Murmur/`            | The Windows app: WinUI 3 on .NET 10 and the Windows App SDK                                                                                         |
| `web/`               | The browser app and the About page, built with Astro and React                                                                                      |
| `.github/workflows/` | `release.yml` builds and signs the MSIX bundles for a `v*.*.*` tag. `website.yml` deploys `web/` to GitHub Pages when a push to `master` changes it |

### The Windows app

You need the .NET 10 SDK. The [`justfile`](justfile) wraps the `dotnet` commands; `just` lists every recipe.

```powershell
just run      # quick unpackaged run
just deploy   # build, then register the MSIX with Windows
just format   # dotnet format
```

The tray's "Run on startup" only works in a registered package, and registering needs Developer Mode on (`just check-devmode`). Without it, registration does nothing and reports no error.

The app keeps its state, imported audio and a diagnostic log in `%LOCALAPPDATA%\Murmur`. `just log` follows the log, and `just wipe-all` resets everything.

### The browser app

You need Node 22.12 or later and pnpm.

```powershell
cd web
pnpm install
pnpm dev      # http://localhost:4321/
pnpm build    # writes dist/
```

`dev` and `build` copy the app icon and the fourteen OGG files from `Murmur/` into `web/public/`, so both apps play the same files. [`web/README.md`](web/README.md) covers icons, testing offline and the files kept in step with the Windows app by hand. [`web/messages/README.md`](web/messages/README.md) covers translations.

## Contributing

Report a bug or suggest a sound on the [issue tracker](https://github.com/martinsdotdev/Murmur/issues). Pull requests are welcome.

The Portuguese, Spanish and Japanese translations haven't been checked by a native speaker yet, so corrections to them are especially useful.

## Support

If Murmur helps you focus or sleep, you can [leave a tip on Ko-fi](https://ko-fi.com/umarudotdev).

## License

Murmur's code is under the GNU General Public License v3; see [`LICENSE`](LICENSE).

The sound set was assembled by [Blanket](https://apps.gnome.org/Blanket/). Each sound keeps its own license (CC0, CC BY, CC BY-SA or public domain), and [`Murmur/Sounds/SOUNDS_LICENSING.md`](Murmur/Sounds/SOUNDS_LICENSING.md) lists each one with its author and source.

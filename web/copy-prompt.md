# Write the copy for the Murmur landing page

You are writing every user-facing string on the landing page of Murmur, a free ambient-sound mixer for Windows. The strings ship verbatim into the page, so respect each slot's length limit. Work only from the facts below; if a claim is not listed here, do not make it.

## The facts

- Murmur plays several looping ambient sounds at once, each with its own volume slider. You blend rain against a fireplace, or a train against white noise, until the room sounds right, then save the blend as a named preset.
- Describe Murmur on its own terms. It is not positioned as a port of, or a companion to, any other app; do not introduce lineage, ancestry, or "inspired by" framing anywhere in the copy.
- 14 built-in sounds in three groups.
  Nature: birds, rain, storm, stream, summer night (crickets), waves, wind.
  Urban: boat, city, coffee shop, fireplace, train.
  Generated: pink noise, white noise.
- Users can add their own sounds: import an audio file, or paste a YouTube link and Murmur extracts the audio.
- It behaves the way background software should: the close button hides it to the system tray and playback continues, the keyboard media keys control it, it can start with Windows, and it follows the system light or dark theme.
- Free and open source under GPLv3. No telemetry, no account, no ads.
- Runs on Windows 10 (build 19041 or later) and Windows 11, x64 and ARM64.
- Install friction, and how to talk about it: releases are MSIX bundles signed with a self-signed certificate. A first install means downloading a small `.cer` file, trusting it once (Local Machine → Trusted People), then double-clicking the bundle. Explain this plainly. The honest framing: self-signing keeps the project free and independent, and a future Store release may remove the step. Never call the process "easy".
- Every bundled sound is Creative Commons or public domain, from named artists (freesound.org, SoundBible, Wikimedia). The footer shows a full attribution table, and a single line under it credits the Blanket project for assembling the sound set. That credit belongs to the attribution area only; it is not a fact about what Murmur is.
- The whole mixer runs in the browser at the site's root, with this page at `/about/`, playing the app's actual sound files. A visitor can mix before downloading anything, save mixes, and share one as a link. The landing page points there from the nav and from the hero; it does not try to be a second mixer, and it does not list the sounds outside the footer's attribution table.

## The voice

Murmur is unobtrusive software, and the copy should be quiet too. Do not call the app itself quiet: it is a sound mixer, and its whole job is to be audible; the word belongs to the writing, not the product. The model is a good GNOME app page: short, factual, unhurried. Write like the developer describing the thing they made to a friend who uses Windows, not like a marketer describing a product to a market.

State uses, not outcomes. People play this while working, reading, and falling asleep; you may say that. Do not promise focus, calm, better sleep, or productivity. The app plays rain sounds, and the reader already knows what rain sounds are for.

Concrete beats abstract everywhere. "Rain over a fireplace" beats "your perfect soundscape". Name real sounds from the list above instead of gesturing at variety.

Never:

- exclamation marks
- Title Case in headings or buttons (the page is sentence case throughout)
- "unlock", "seamless", "immersive", "elevate", "crafted", or "experience" as a noun
- "it's not X, it's Y" or "more than just" constructions
- scientific or wellness claims
- em dashes, anywhere, in the copy or in this file; use commas, colons or full stops
- three parallel phrases where one concrete example would land harder

## The slots

Current copy is shown for register. Beat it or keep it; do not change a line just to have changed it.

1. **Meta title**: 60 characters max. Current: `Murmur · Ambient sound mixer for Windows`
2. **Meta description**: 155 characters max. It is read out of context, in a search result, so it must name the app and a real sound rather than gesture at atmosphere. Current: `Layer rain over a fireplace, or a train over white noise. A free, open-source ambient sound mixer for Windows.`
3. **Hero heading**: the product name. The hero is icon-led, like a GNOME app page: mark, name, one line. There is no eyebrow. Current: `Murmur`
4. **Hero subtitle**: 120 characters max, renders as two lines on a wide screen and three on a phone. It is the only prose above the feature grid, so it must say what the app does and name a real sound. One example, not a list of them. Current: `Play ambient sounds while you work, read, or fall asleep. Layer rain over a fireplace, and save the blend.`
5. **Hero meta line**: dot-separated bare facts. Current: `Free · GPLv3 · No telemetry · Windows 10 and 11`
6. **Feature section heading and intro**: a heading of two to four words, then one line framing all six cards at once. It says how the app behaves, never what it contains, and never restates a card. Current: `What it does` / `Designed to be ignored. It remembers your blends and stays out of the way.`
7. **Six feature cards**: each a title of 2 to 6 words plus one short line under it; no paragraph.
   - Titles are plain verb phrases, not taglines. No "X, one Y", no implied contrasts.
   - The subtitle names specifics the title leaves out. Do not restate the title in it.
   - Two independent clauses take a semicolon, not a comma.
   - Name real sounds, never the category labels. Nature, urban and generated are identifiers from the catalogue, and "generated" does not tell a reader it means noise.
   - No sound count anywhere in the grid. It dates the page the moment the catalogue changes, and the footer's attribution table already names every sound.
   - The layering card is not scoped to the bundled set. Imported files and YouTube audio layer the same way, so "the built-in sounds" understates it.
   - Every subtitle states a fact or lands a joke. Neither may be a benefit claim: "you never have to set it" is the register to avoid, and the voice section already rules out outcomes.
   - Exactly one card is allowed to be funny, and it is the theme card. A second joke would make the grid a bit, and the page is quiet everywhere else.
   - No card says "Windows". The meta title, meta description, hero meta line, download requirements and footer all name the platform already; a card describes behaviour, so write "at startup" and "your system theme".
   - Read each subtitle aloud. "Media keys work; starts with Windows if you want" was two spec bullets joined by a semicolon, and "Name a mix; get it back" left a reader asking what came back.

   Current:

   - `Layer sounds at any volume` / `A storm over a coffee shop`
   - `Save blends as presets` / `Every slider back where you left it`
   - `Bring your own audio` / `An audio file, or a YouTube link`
   - `Closes to the tray, keeps playing` / `Your media keys still work, and it can launch at startup`
   - `Follows your system theme` / `No flashbang at 2am`
   - `Free, GPLv3, no telemetry` / `No account, no ads`

8. **Download heading**: short; the build system appends a version tag, so do not include one. Current: `Get Murmur`
9. **Certificate disclosure**: a summary line stating the requirement before the reassurance, since the reader has not installed anything yet and the steps below are what they need. Do not concede the friction inside a clause: "updates install with a double-click, even though…" led with the wrong half and put the two facts in a contrast they are not in. Current: `The first install asks you to trust a certificate. Updates after that are a double-click.`

   Then three steps, each a short title plus the action alone: download the `.cer`, install it to Local Machine → Trusted People, run the `.msixbundle`. Do not restate the lead in step three: it already said updates are a double-click. Then a one-sentence closing note in the honest framing described above.

10. **No-release fallback**: one line shown when no build is published yet, pointing at the GitHub repo. Current: `v1.0.0 build coming soon, watch the repo to be notified.`
11. **Footer blurb**: one sentence saying what Murmur is. Do not describe the attribution table: it sits alongside under its own heading, names every artist and licence, and needs no prose introduction. Current: `Murmur is a free, open-source ambient sound mixer for Windows.`

## Output

Return a markdown list keyed by the slot names above. For slot 4 (the hero subtitle), give two alternatives and one sentence on which you would ship. One option everywhere else. Slot 3 is fixed: the hero heading is the product name.

Then make one editing pass before you answer: read each line as if aloud, cut any phrase that could sit on any app's landing page, recount your em dashes, and check every character limit.

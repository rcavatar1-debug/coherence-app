# Coherence: Shadow to Stillness

A single-purpose web app that guides a user from sympathetic (fight-or-flight)
activation into parasympathetic brain-heart coherence, using real-time
synthesized audio, a paced breathing visualizer, and an adaptive 3-step
instruction script.

No build step, no dependencies beyond a browser. Open `index.html` directly,
or serve the folder with any static file server.

```
cd coherence-app
python3 -m http.server 8080
# then open http://localhost:8080
```

Headphones are recommended — the binaural layer only works as intended with
true left/right ear separation.

## Installing on your iPhone (Home Screen app)

The app is now a lightweight PWA: it has a manifest, Home Screen icons, and a
service worker for offline caching. No App Store, no Xcode, no Apple ID
needed — just Safari.

**1. Serve it from your Mac on your home WiFi** (your iPhone needs to reach
the files over the network — `file://` links and `localhost` on the Mac
aren't visible to the phone):

```
cd coherence-app
python3 -m http.server 8080 --bind 0.0.0.0
```

**2. Find your Mac's local IP address** — System Settings → Wi-Fi → (i) next
to your network → look for the IP starting with `192.168.` or `10.`. Or run
`ipconfig getifaddr en0` in Terminal.

**3. On your iPhone** (same WiFi network), open Safari and go to
`http://<that-ip>:8080` — e.g. `http://192.168.1.42:8080`.

**4. Tap the Share icon → "Add to Home Screen."** You'll get a Coherence app
icon that opens full-screen, no browser chrome, with the sphere's glow as the
icon.

**Notes / limitations:**
- Your Mac needs to be on and running the `http.server` command each time,
  unless you deploy the folder to a free static host (GitHub Pages, Netlify,
  Vercel, Cloudflare Pages) — then the Home Screen app works from anywhere,
  not just your home WiFi. Ask me if you'd like help setting that up.
- iOS pauses audio for backgrounded/locked-screen web apps — keep the phone
  unlocked and the app in the foreground during a session. A true native app
  (via Xcode/Capacitor) would be needed for reliable background/lock-screen
  audio.
- After the first successful load, the service worker caches the app shell,
  so it'll still open (though not necessarily sync new changes) with no
  signal.

## File structure

```
coherence-app/
├── index.html                Layout: timer, sphere, prompt box, mixers
├── manifest.webmanifest      PWA metadata (name, icons, standalone display)
├── sw.js                     Service worker: offline caching of the app shell
├── icons/                    Home Screen / favicon icons (generated, various sizes)
├── css/
│   └── style.css             Deep Space & Bioluminescence theme
├── js/
│   ├── audioEngine.js        Web Audio API synthesis (binaural + solfeggio)
│   ├── breathVisualizer.js   0.1 Hz sine-driven sphere animation
│   ├── instructionEngine.js  3-step adaptive prompt script
│   └── main.js               DOM wiring / session state machine
└── README.md
```

## The audio engine

Everything is generated mathematically with native `OscillatorNode`s — no
MP3/WAV files, so there is no loop seam and no gap artifacts for the
duration of a session.

**Binaural beat.** Two sine oscillators, hard-panned left and right with
`StereoPannerNode`:

- Left ear: 136.1 Hz (the "Om"/Earth-tone carrier)
- Right ear: 140.6 Hz (136.1 + 4.5 Hz)

The brain perceives the 4.5 Hz *difference* between the ears as a phantom
beat in the Theta range, associated with deep meditative states and reduced
amygdala reactivity.

**Resonant Vagus Solfeggio bed.** A continuous ambient drone, user-toggled
between 432 Hz (emotional release / heart-centeredness) and 528 Hz (cellular
repair). It's actually two oscillators — the second detuned ~0.3% and slowly
modulated by a 0.07 Hz LFO — so the drone breathes and shimmers instead of
sounding like a lab tone.

**Mixer.** A single crossfade slider blends the two layers using an
equal-power curve (`sin`/`cos` of the mix angle) so the perceived loudness
stays constant across the whole slider range, plus an independent master
volume.

**Breath-synced cues.** A short two-partial chime (C6 + G6) fires at the
start of every inhale; a filtered white-noise "oceanic sigh" (lowpass swept
from ~900 Hz down to ~140 Hz) fires at the start of every exhale.

## The breathing visualizer

The sphere's scale is a pure sine wave over an 11-second period (5.5s
inhale + 5.5s exhale), computed every animation frame:

```
scale(t) = mid + amp * sin(2π · (t mod 11000) / 11000 − π/2)
```

Because it's a sine wave, velocity naturally eases to zero at the very top
and bottom of the breath — there's no linear snap and no dead pause between
inhale and exhale, which avoids the "held breath" sensation that can itself
trigger a sympathetic alarm. Glow intensity (`box-shadow` blur/spread) is
driven by the same curve so the sphere brightens on the inhale and softens
on the exhale.

## The adaptive instruction engine

The reference script is written for a ~10 minute session (0–2min, 2–5min,
5min+). To preserve the same felt pacing on the 5 and 20 minute options, the
two breakpoints scale proportionally to the chosen duration (20% / 50% of
total), capped at the literal 2-minute / 5-minute marks so a 20-minute
session doesn't rush step 1.

## Known limitations / next steps

- **Text-to-speech** is not wired up. The prompt script updates as on-screen
  text only; hooking `window.speechSynthesis` to speak `stepText` on each
  `applyStep()` call in `main.js` is a small, self-contained addition.
- **Mobile wrapper.** The app is a static site today; wrapping it in Capacitor
  or a WebView shell would give it app-store distribution without touching
  the audio/visual code.
- **iOS Safari** requires the very first `AudioContext` resume to happen
  synchronously inside a user gesture — `audio.start()` is called directly
  from the Start Session click handler for this reason. Don't move it behind
  an `async` boundary.
- No persistence/analytics by design — this is meant to be a private,
  ephemeral nervous-system reset, not a tracked habit app.

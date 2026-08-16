/**
 * audioEngine.js
 * ------------------------------------------------------------------
 * "Coherence: Shadow to Stillness" — Dual-Tone Audio Engine
 *
 * Layer 1 — Binaural Beat:
 *   Left ear:  136.1 Hz  (carrier / "Om" frequency)
 *   Right ear: 140.6 Hz  (136.1 + 4.5 Hz offset)
 *   The brain perceives the 4.5 Hz *difference* between the two ears
 *   as a phantom Theta-range beat, which is the actual entrainment
 *   signal (theta = deep meditation / reduced amygdala reactivity).
 *   True binaural separation requires headphones.
 *
 * Layer 2 — Resonant Vagus Solfeggio Bed:
 *   A single continuous drone at either 432 Hz or 528 Hz, gently
 *   detuned with a slow chorus-like LFO on a second oscillator so it
 *   doesn't sound like a sterile test tone.
 *
 * Both layers are generated mathematically with native OscillatorNodes
 * (no static audio files), so there is zero loop-seam and no gap
 * artifacts — the tones simply run for the duration of the session.
 *
 * A single equal-power crossfade slider (0..1) blends between the two
 * layers, and a master gain controls overall output level. Short,
 * separately-triggered "chime" (inhale) and "sigh" (exhale) events are
 * layered on top, synced to the breathing visualizer.
 * ------------------------------------------------------------------
 */

class CoherenceAudioEngine {
  constructor() {
    this.ctx = null;
    this.isRunning = false;

    // Binaural beat parameters
    this.carrierFreq = 136.1;
    this.thetaOffset = 4.5;

    // Solfeggio bed parameters (user-selectable)
    this.solfeggioFreq = 432; // 432Hz default: better-supported evidence for anxiety/BP/HRV than 528Hz

    // Node references (created in _buildGraph)
    this.nodes = {};

    // User-controllable state, applied once ctx exists
    this._masterVolume = 0.6;
    this._mix = 0.5; // 0 = all solfeggio, 1 = all binaural

    // Cached noise buffer for the exhale "oceanic sigh"
    this._noiseBuffer = null;
  }

  /** Lazily create the AudioContext — must be called from a user gesture. */
  _ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
      this.ctx.resume();
    }
    this._unlockSilently();
    return this.ctx;
  }

  /**
   * Play an inaudible 1-sample buffer through to the real output the moment
   * the context is created. On iOS this "wakes up" the audio hardware path
   * as part of the same user gesture, which some WebKit versions otherwise
   * need before oscillator-only (no real media element) audio reliably
   * reaches the speaker/output device.
   */
  _unlockSilently() {
    try {
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
    } catch (e) {
      /* best-effort only */
    }
  }

  /** Immediately stop/disconnect any live oscillators without a fade (internal use only). */
  _teardownNodes() {
    const { oscLeft, oscRight, oscSolfeggioA, oscSolfeggioB, chorusLFO } = this.nodes;
    [oscLeft, oscRight, oscSolfeggioA, oscSolfeggioB, chorusLFO].forEach((o) => {
      if (!o) return;
      try {
        o.stop();
      } catch (e) {
        /* already stopped */
      }
    });
    this.nodes = {};
  }

  /** Discard the current AudioContext entirely so the next start() builds a fresh one. */
  _closeContext() {
    if (!this.ctx) return;
    const staleCtx = this.ctx;
    this.ctx = null;
    this._noiseBuffer = null; // buffers are recreated against whichever context exists at call time
    try {
      staleCtx.close();
    } catch (e) {
      /* already closed */
    }
  }

  /** Build the full oscillator/gain graph. Called once per session start. */
  _buildGraph() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // ---- Master output ----
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(this._masterVolume, now + 2.5); // soft fade-in
    masterGain.connect(ctx.destination);

    // ---- Binaural beat bus ----
    const binauralBus = ctx.createGain();
    this._applyMixGains(binauralBus, null, this._mix); // placeholder, fixed below
    binauralBus.connect(masterGain);

    const oscLeft = ctx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(this.carrierFreq, now);
    const panLeft = ctx.createStereoPanner();
    panLeft.pan.setValueAtTime(-1, now);
    oscLeft.connect(panLeft).connect(binauralBus);

    const oscRight = ctx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(this.carrierFreq + this.thetaOffset, now);
    const panRight = ctx.createStereoPanner();
    panRight.pan.setValueAtTime(1, now);
    oscRight.connect(panRight).connect(binauralBus);

    // ---- Solfeggio bed bus ----
    const solfeggioBus = ctx.createGain();
    solfeggioBus.connect(masterGain);

    const oscSolfeggioA = ctx.createOscillator();
    oscSolfeggioA.type = 'sine';
    oscSolfeggioA.frequency.setValueAtTime(this.solfeggioFreq, now);

    // Second, slightly detuned oscillator + slow LFO for a warm, living drone
    const oscSolfeggioB = ctx.createOscillator();
    oscSolfeggioB.type = 'sine';
    oscSolfeggioB.frequency.setValueAtTime(this.solfeggioFreq * 1.003, now);

    const chorusLFO = ctx.createOscillator();
    chorusLFO.type = 'sine';
    chorusLFO.frequency.setValueAtTime(0.07, now); // very slow drift
    const chorusDepth = ctx.createGain();
    chorusDepth.gain.setValueAtTime(0.8, now);
    chorusLFO.connect(chorusDepth).connect(oscSolfeggioB.frequency);

    const solfeggioBlend = ctx.createGain();
    solfeggioBlend.gain.setValueAtTime(0.5, now);
    oscSolfeggioA.connect(solfeggioBlend);
    oscSolfeggioB.connect(solfeggioBlend);
    solfeggioBlend.connect(solfeggioBus);

    // Gentle lowpass so the bed feels ambient rather than piercing
    const solfeggioFilter = ctx.createBiquadFilter();
    solfeggioFilter.type = 'lowpass';
    solfeggioFilter.frequency.setValueAtTime(2200, now);
    solfeggioBus.disconnect();
    solfeggioBus.connect(solfeggioFilter).connect(masterGain);

    // Start all continuous oscillators
    [oscLeft, oscRight, oscSolfeggioA, oscSolfeggioB, chorusLFO].forEach((o) => o.start(now));

    this.nodes = {
      masterGain,
      binauralBus,
      solfeggioBus,
      oscLeft,
      oscRight,
      oscSolfeggioA,
      oscSolfeggioB,
      chorusLFO,
    };

    // Apply the real equal-power mix now that both busses exist
    this._applyMixGains(binauralBus, solfeggioBus, this._mix);
  }

  /** Equal-power crossfade between the binaural bus and the solfeggio bus. */
  _applyMixGains(binauralBus, solfeggioBus, mix) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const t = Math.max(0, Math.min(1, mix));
    const binauralGain = Math.sin(t * Math.PI * 0.5);
    const solfeggioGain = Math.cos(t * Math.PI * 0.5);

    binauralBus.gain.cancelScheduledValues(now);
    binauralBus.gain.linearRampToValueAtTime(binauralGain, now + 0.4);

    if (solfeggioBus) {
      solfeggioBus.gain.cancelScheduledValues(now);
      solfeggioBus.gain.linearRampToValueAtTime(solfeggioGain, now + 0.4);
    }
  }

  /** Build (once) a 2-second white noise buffer used for the exhale sigh. */
  _getNoiseBuffer() {
    if (this._noiseBuffer) return this._noiseBuffer;
    const ctx = this.ctx;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this._noiseBuffer = buffer;
    return buffer;
  }

  // ---------------------------------------------------------------
  // Public controls
  // ---------------------------------------------------------------

  start() {
    if (this.isRunning) {
      // On iOS Safari, an OS-level interruption (backgrounding, a call, power
      // throttling) can silently kill audio output while our JS state still
      // thinks a session is "running." If that happens, the old no-op guard
      // below would skip rebuilding entirely and produce total silence on the
      // next attempt. Instead, hard-tear-down and rebuild fresh every time.
      this._teardownNodes();
      this._closeContext();
    }
    this._ensureContext();
    this._buildGraph();
    this.isRunning = true;
  }

  /** Soft fade-out then full stop/teardown of all nodes. */
  stop() {
    if (!this.isRunning || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const { masterGain, oscLeft, oscRight, oscSolfeggioA, oscSolfeggioB, chorusLFO } = this.nodes;

    if (masterGain) {
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 1.5);
    }

    [oscLeft, oscRight, oscSolfeggioA, oscSolfeggioB, chorusLFO].forEach((o) => {
      try {
        o.stop(now + 1.6);
      } catch (e) {
        /* already stopped */
      }
    });

    this.isRunning = false;
    this.nodes = {};

    // Fully close and discard this AudioContext once the fade-out finishes,
    // so the *next* start() always builds a brand-new one. This works around
    // a real iOS Safari bug where a context can report state:'running' after
    // an interruption but silently produce no audio output at all.
    const staleCtx = ctx;
    this.ctx = null;
    this._noiseBuffer = null;
    setTimeout(() => {
      try {
        staleCtx.close();
      } catch (e) {
        /* already closed */
      }
    }, 1700);
  }

  setMasterVolume(v) {
    this._masterVolume = v;
    if (this.ctx && this.nodes.masterGain) {
      const now = this.ctx.currentTime;
      this.nodes.masterGain.gain.cancelScheduledValues(now);
      this.nodes.masterGain.gain.linearRampToValueAtTime(v, now + 0.15);
    }
  }

  /** mix: 0 = all Solfeggio bed, 1 = all binaural beat. */
  setMix(mix) {
    this._mix = mix;
    if (this.ctx && this.nodes.binauralBus && this.nodes.solfeggioBus) {
      this._applyMixGains(this.nodes.binauralBus, this.nodes.solfeggioBus, mix);
    }
  }

  /** Change the solfeggio drone frequency live (432 or 528). */
  setSolfeggioFreq(freq) {
    this.solfeggioFreq = freq;
    if (this.ctx && this.nodes.oscSolfeggioA) {
      const now = this.ctx.currentTime;
      this.nodes.oscSolfeggioA.frequency.linearRampToValueAtTime(freq, now + 1.2);
      this.nodes.oscSolfeggioB.frequency.linearRampToValueAtTime(freq * 1.003, now + 1.2);
    }
  }

  /** High, soft chime marking the start of an inhale. */
  playInhaleChime() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now); // C6

    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(1568.0, now); // G6, soft fifth overtone

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0, now);
    overtoneGain.gain.linearRampToValueAtTime(0.04, now + 0.08);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

    osc.connect(gain).connect(this.nodes.masterGain || ctx.destination);
    overtone.connect(overtoneGain).connect(this.nodes.masterGain || ctx.destination);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 1.2);
    overtone.stop(now + 1.2);
  }

  /** Low, filtered "oceanic sigh" marking the start of an exhale. */
  playExhaleSigh() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this._getNoiseBuffer();

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(0.6, now);
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 2.6);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.6);
    gain.gain.linearRampToValueAtTime(0, now + 2.8);

    noiseSource.connect(filter).connect(gain).connect(this.nodes.masterGain || ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + 3);
  }
}

// Exposed as a global for the plain-script setup used by main.js
window.CoherenceAudioEngine = CoherenceAudioEngine;

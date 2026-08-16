/**
 * breathVisualizer.js
 * ------------------------------------------------------------------
 * Drives the glowing sphere at a strict 0.1 Hz Heart Coherence rhythm:
 *   Period    = 11 seconds  (0.1 Hz oscillation → 10s would be 0.1Hz;
 *               we use 5.5s + 5.5s = 11s to match the exact instruction
 *               spec of "5.5s inhale / 5.5s exhale").
 *   Inhale    = first half of the period (sphere expands)
 *   Exhale    = second half of the period (sphere contracts)
 *
 * The scale is a pure sine wave, so velocity naturally slows to zero
 * exactly at the top and bottom of the breath — there is no linear
 * "snap" and no dead pause between inhale and exhale, which keeps the
 * nervous system from registering a jarring stop/start (a sympathetic
 * trigger).
 * ------------------------------------------------------------------
 */

class BreathVisualizer {
  /**
   * @param {HTMLElement} sphereEl   The element to scale/glow.
   * @param {HTMLElement} labelEl    Text element showing "Inhale"/"Exhale".
   * @param {Object} callbacks       { onInhaleStart, onExhaleStart }
   */
  constructor(sphereEl, labelEl, callbacks = {}) {
    this.sphereEl = sphereEl;
    this.labelEl = labelEl;
    this.callbacks = callbacks;

    this.periodMs = 11000; // 5.5s inhale + 5.5s exhale
    this.scaleMin = 0.82;
    this.scaleMax = 1.18;

    this._rafId = null;
    this._startTime = null;
    this._lastPhaseMs = 0;
    this._running = false;
  }

  start() {
    this._running = true;
    this._startTime = performance.now();
    this._lastPhaseMs = 0;
    const tick = (now) => {
      if (!this._running) return;
      this._update(now);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  _update(now) {
    const elapsed = now - this._startTime;
    const phaseMs = elapsed % this.periodMs;
    const half = this.periodMs / 2;

    // sine wave: starts at min (phase 0), peaks at max (phase = half), back to min at period
    const angle = (phaseMs / this.periodMs) * 2 * Math.PI - Math.PI / 2;
    const mid = (this.scaleMin + this.scaleMax) / 2;
    const amp = (this.scaleMax - this.scaleMin) / 2;
    const scale = mid + amp * Math.sin(angle);

    // subtle glow intensity follows the same curve
    const glowStrength = 0.55 + 0.45 * ((scale - this.scaleMin) / (this.scaleMax - this.scaleMin));

    this.sphereEl.style.transform = `scale(${scale.toFixed(4)})`;
    this.sphereEl.style.setProperty('--glow-strength', glowStrength.toFixed(3));

    const isInhale = phaseMs < half;
    if (this.labelEl) {
      this.labelEl.textContent = isInhale ? 'Inhale' : 'Exhale';
    }

    // Detect phase-boundary crossings (handle wrap-around robustly)
    if (this._lastPhaseMs > phaseMs) {
      // wrapped around to a new period => inhale begins
      this.callbacks.onInhaleStart && this.callbacks.onInhaleStart();
    } else if (this._lastPhaseMs < half && phaseMs >= half) {
      // crossed the midpoint => exhale begins
      this.callbacks.onExhaleStart && this.callbacks.onExhaleStart();
    }

    this._lastPhaseMs = phaseMs;
  }
}

window.BreathVisualizer = BreathVisualizer;

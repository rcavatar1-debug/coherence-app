/**
 * instructionEngine.js
 * ------------------------------------------------------------------
 * The Adaptive Instruction Engine: a 3-step nervous-system-shifting
 * script. The reference spec times the steps at 0-2min, 2-5min, and
 * 5min+ — calibrated for a ~10 minute session. To keep the same felt
 * pacing on shorter or longer sessions, the two breakpoints are
 * scaled proportionally to the chosen session length (step 1 = first
 * 20%, step 2 = next 30%, step 3 = final 50%), but never scaled
 * *past* the literal 2min / 5min marks for sessions of 10+ minutes.
 * ------------------------------------------------------------------
 */

const COHERENCE_STEPS = [
  {
    key: 'anchor',
    title: 'Step 1 — The Bio-Somatic Anchor',
    text:
      'Close your eyes. Bring your awareness to your physical heart center. ' +
      'Place your palm over your chest. Feel the warmth of your hand against ' +
      'your skin. Rest your focus entirely on the space your heart occupies in space. ' +
      'Whenever it feels natural, let a soft, low hum rise on your exhale, loosely ' +
      'matching the tone you hear.',
  },
  {
    key: 'shift',
    title: 'Step 2 — The Parasympathetic Shift',
    text:
      'Synchronize your breath with the expanding sphere. Breathe into the ' +
      'back of your heart, making your exhale soft, long, and unforced. On each ' +
      'exhale, let a soft, low hum escape — loosely matching the tone you hear, ' +
      'feeling it vibrate in your throat and chest more than performing it ' +
      'perfectly. Drop your shoulders and soften your jaw as you do. You are safe. ' +
      'The survival mind can rest.',
  },
  {
    key: 'induction',
    title: 'Step 3 — The Quantum Induction',
    text:
      'Now, evoke a feeling of profound gratitude or elevated appreciation for a ' +
      'single moment in your life. Do not think it — feel it. Let that warmth ' +
      'radiate from your heart into every cell of your biology. Broadcast this ' +
      'frequency into the field around you.',
  },
];

class InstructionEngine {
  /**
   * @param {number} totalDurationMs  Total planned session length.
   */
  constructor(totalDurationMs) {
    this.totalDurationMs = totalDurationMs;

    const twoMin = 2 * 60 * 1000;
    const fiveMin = 5 * 60 * 1000;

    // Proportional breakpoints, capped at the literal reference marks.
    this.breakpoint1 = Math.min(twoMin, totalDurationMs * 0.2);
    this.breakpoint2 = Math.min(fiveMin, totalDurationMs * 0.5);

    // Guard against breakpoint2 <= breakpoint1 on very short sessions
    if (this.breakpoint2 <= this.breakpoint1) {
      this.breakpoint2 = this.breakpoint1 + Math.max(1000, totalDurationMs * 0.15);
    }

    this._currentIndex = -1;
  }

  /** Returns the step object {title, text} appropriate for elapsed time. */
  getStepForElapsed(elapsedMs) {
    let index;
    if (elapsedMs < this.breakpoint1) {
      index = 0;
    } else if (elapsedMs < this.breakpoint2) {
      index = 1;
    } else {
      index = 2;
    }
    return { index, step: COHERENCE_STEPS[index] };
  }

  /** Returns true (and updates internal state) only when the step has changed. */
  hasStepChanged(elapsedMs) {
    const { index } = this.getStepForElapsed(elapsedMs);
    if (index !== this._currentIndex) {
      this._currentIndex = index;
      return true;
    }
    return false;
  }

  reset() {
    this._currentIndex = -1;
  }

  /**
   * Silently mark the current step as "already shown" without returning a
   * change flag. Call this once right after manually rendering the initial
   * step, so the first hasStepChanged() call inside the countdown loop
   * doesn't immediately re-trigger a duplicate fade-in for the same step.
   */
  primeCurrentIndex(elapsedMs) {
    this._currentIndex = this.getStepForElapsed(elapsedMs).index;
  }
}

window.COHERENCE_STEPS = COHERENCE_STEPS;
window.InstructionEngine = InstructionEngine;

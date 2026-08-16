/**
 * main.js — wires the audio engine, breath visualizer, and instruction
 * engine to the DOM. This is the only file that touches document
 * elements directly; the other modules are self-contained and reusable.
 */
(() => {
  const els = {
    timerSelect: document.getElementById('timerSelect'),
    sessionBtn: document.getElementById('sessionBtn'),
    countdown: document.getElementById('countdown'),
    sphere: document.getElementById('sphere'),
    phaseLabel: document.getElementById('phaseLabel'),
    sessionEndMsg: document.getElementById('sessionEndMsg'),
    stepTitle: document.getElementById('stepTitle'),
    stepText: document.getElementById('stepText'),
    masterVol: document.getElementById('masterVol'),
    masterVolVal: document.getElementById('masterVolVal'),
    mixSlider: document.getElementById('mixSlider'),
    freqToggle: document.getElementById('freqToggle'),
  };

  const audio = new CoherenceAudioEngine();
  let visualizer = null;
  let instructionEngine = null;

  let selectedMinutes = 5;
  let sessionActive = false;
  let sessionStartMs = 0;
  let totalDurationMs = selectedMinutes * 60 * 1000;
  let countdownRAF = null;

  // ---------------- Timer selection ----------------
  els.timerSelect.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-minutes]');
    if (!btn || sessionActive) return;
    [...els.timerSelect.children].forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMinutes = Number(btn.dataset.minutes);
    totalDurationMs = selectedMinutes * 60 * 1000;
    updateCountdownDisplay(totalDurationMs);
  });

  function updateCountdownDisplay(remainingMs) {
    const total = Math.max(0, Math.round(remainingMs / 1000));
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    els.countdown.textContent = `${mm}:${ss}`;
  }

  // ---------------- Mixer controls ----------------
  els.masterVol.addEventListener('input', () => {
    const v = Number(els.masterVol.value) / 100;
    els.masterVolVal.textContent = `${els.masterVol.value}%`;
    audio.setMasterVolume(v);
  });

  els.mixSlider.addEventListener('input', () => {
    const v = Number(els.mixSlider.value) / 100;
    audio.setMix(v);
  });

  els.freqToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-freq]');
    if (!btn) return;
    [...els.freqToggle.children].forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    audio.setSolfeggioFreq(Number(btn.dataset.freq));
  });

  // ---------------- Session control ----------------
  els.sessionBtn.addEventListener('click', () => {
    if (!sessionActive) {
      startSession();
    } else {
      endSession(false);
    }
  });

  function startSession() {
    sessionActive = true;
    sessionStartMs = performance.now();
    totalDurationMs = selectedMinutes * 60 * 1000;

    els.sessionBtn.textContent = 'End Session';
    els.sessionBtn.classList.add('stop');
    els.sessionEndMsg.textContent = '';
    [...els.timerSelect.children].forEach((b) => (b.disabled = true));

    // iOS reliability nudge: play a silent clip on this same tap gesture so
    // Safari treats the page as an active "playback" audio session, which
    // helps the Web Audio API tones stay audible instead of getting treated
    // as low-priority "ambient" sound.
    const unlockEl = document.getElementById('audioUnlock');
    if (unlockEl) {
      unlockEl.play().catch(() => {
        /* fine if this fails — it's a best-effort nudge, not a requirement */
      });
    }

    // Audio
    audio.setMasterVolume(Number(els.masterVol.value) / 100);
    audio.setMix(Number(els.mixSlider.value) / 100);
    const activeFreqBtn = els.freqToggle.querySelector('button.active');
    audio.setSolfeggioFreq(Number(activeFreqBtn.dataset.freq));
    audio.start();

    // Instructions
    instructionEngine = new InstructionEngine(totalDurationMs);
    applyStep(instructionEngine.getStepForElapsed(0).step);
    instructionEngine.primeCurrentIndex(0); // avoid an immediate duplicate re-fade in tickCountdown

    // Breath visualizer, synced chimes
    visualizer = new BreathVisualizer(els.sphere, els.phaseLabel, {
      onInhaleStart: () => audio.playInhaleChime(),
      onExhaleStart: () => audio.playExhaleSigh(),
    });
    visualizer.start();
    // Trigger the very first inhale chime immediately so audio + visual align at t=0
    audio.playInhaleChime();

    tickCountdown();
  }

  function tickCountdown() {
    if (!sessionActive) return;
    const elapsed = performance.now() - sessionStartMs;
    const remaining = totalDurationMs - elapsed;

    updateCountdownDisplay(remaining);

    if (instructionEngine.hasStepChanged(elapsed)) {
      const step = instructionEngine.getStepForElapsed(elapsed).step;
      applyStep(step);
      // Auto-crossfade the solfeggio bed from 432Hz (Heart) to 528Hz (Repair)
      // right as Step 3 (Quantum Induction) begins. The breakpoint itself is
      // already duration-aware (InstructionEngine scales it for 5/10/20min
      // sessions), so this naturally lands at a different real time for each.
      if (step.key === 'induction') {
        switchToRepairTone();
      }
    }

    if (remaining <= 0) {
      endSession(true);
      return;
    }

    countdownRAF = requestAnimationFrame(tickCountdown);
  }

  function switchToRepairTone() {
    audio.setSolfeggioFreq(528);
    [...els.freqToggle.children].forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.freq) === 528);
    });
  }

  function applyStep(step) {
    els.stepTitle.textContent = step.title;
    els.stepText.textContent = step.text;
    const box = els.stepText.closest('.prompt-box');
    box.style.opacity = 0;
    requestAnimationFrame(() => {
      box.style.opacity = 1;
    });
  }

  function endSession(completedNaturally) {
    sessionActive = false;
    if (countdownRAF) cancelAnimationFrame(countdownRAF);
    if (visualizer) visualizer.stop();
    audio.stop();

    els.sessionBtn.textContent = 'Start Session';
    els.sessionBtn.classList.remove('stop');
    els.phaseLabel.textContent = ' ';
    [...els.timerSelect.children].forEach((b) => (b.disabled = false));
    updateCountdownDisplay(totalDurationMs);

    // Reset the tone toggle back to 432Hz (Heart) so the next session starts
    // the automatic Heart -> Repair sequence from the beginning again.
    [...els.freqToggle.children].forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.freq) === 432);
    });

    els.stepTitle.textContent = 'Ready';
    els.stepText.textContent =
      'Select a duration and press Start Session. Headphones are recommended for the binaural layer.';

    els.sessionEndMsg.textContent = completedNaturally
      ? 'Session complete. Return gently to the room, and carry this coherence with you.'
      : '';
  }

  // Initialize countdown display on load
  updateCountdownDisplay(totalDurationMs);
})();

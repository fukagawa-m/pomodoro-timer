document.addEventListener('DOMContentLoaded', () => {
  // --- Constants ---
  const DURATIONS = { work: 25 * 60, break: 10 * 60 };
  const RING_CIRCUMFERENCE = 628; // 2 * pi * r (r = 100)

  // --- State ---
  const state = {
    mode: 'work',
    status: 'idle', // 'idle' | 'running' | 'done'
    totalSeconds: DURATIONS.work,
    remaining: DURATIONS.work,
    startedAt: null,    // Date.now() when timer started
    startedRemaining: DURATIONS.work, // remaining at the time of last start
    intervalId: null,
    sessionsToday: 0,
    audioCtx: null,
  };

  // --- DOM refs ---
  const timerReadout   = document.getElementById('timer-readout');
  const ringProgress   = document.getElementById('ring-progress');
  const modeBadge      = document.querySelector('.mode-badge');
  const btnStartStop   = document.getElementById('btn-start-stop');
  const btnRepeat      = document.getElementById('btn-repeat');
  const btnSwitchMode  = document.getElementById('btn-switch-mode');
  const sessionCountEl = document.getElementById('session-count');

  // --- Audio ---
  function initAudio() {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playNotification() {
    if (!state.audioCtx) return;
    const ctx = state.audioCtx;
    ctx.resume().then(() => {
      const playTone = (freq, startTime, duration) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.35, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = ctx.currentTime;
      playTone(880,  now,        0.3);  // A5
      playTone(1108, now + 0.25, 0.45); // C#6 (major third up)
    });
  }

  // --- Display ---
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateDisplay() {
    const timeStr = formatTime(state.remaining);
    timerReadout.textContent = timeStr;
    document.title = `${timeStr} — Pomodoro`;

    // SVG ring: dashoffset proportional to remaining / total
    const offset = (1 - state.remaining / state.totalSeconds) * RING_CIRCUMFERENCE;
    ringProgress.style.strokeDashoffset = offset;
  }

  // --- Timer core ---
  function tick() {
    // Wall-clock accurate: compute elapsed from start time
    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    state.remaining = Math.max(0, state.startedRemaining - elapsed);
    updateDisplay();

    if (state.remaining === 0) {
      onTimerEnd();
    }
  }

  function startTimer() {
    if (state.status === 'running') return;
    initAudio();
    state.startedAt = Date.now();
    state.startedRemaining = state.remaining;
    state.status = 'running';
    state.intervalId = setInterval(tick, 500); // 500ms for smooth display
    btnStartStop.textContent = 'Stop';
    btnRepeat.hidden = true;
  }

  function stopTimer() {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.status = 'idle';
    btnStartStop.textContent = 'Start';
  }

  function resetToMode(mode) {
    stopTimer();
    state.mode = mode;
    state.totalSeconds = DURATIONS[mode];
    state.remaining = DURATIONS[mode];
    state.status = 'idle';

    document.body.dataset.mode = mode;
    modeBadge.textContent = mode === 'work' ? 'Work Session' : 'Short Break';
    btnSwitchMode.textContent = mode === 'work' ? 'Take a Break' : 'Back to Work';
    btnStartStop.textContent = 'Start';
    btnRepeat.hidden = true;

    updateDisplay();
  }

  function onTimerEnd() {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.status = 'done';

    if (state.mode === 'work') {
      state.sessionsToday++;
      sessionCountEl.textContent = state.sessionsToday;
    }

    playNotification();

    btnStartStop.textContent = 'Start Again';
    btnRepeat.hidden = false;
    updateDisplay();
  }

  // --- Event bindings ---
  btnStartStop.addEventListener('click', () => {
    if (state.status === 'running') {
      stopTimer();
    } else {
      if (state.status === 'done') {
        // Reset remaining before starting again
        state.remaining = state.totalSeconds;
      }
      startTimer();
    }
  });

  btnRepeat.addEventListener('click', () => {
    state.remaining = state.totalSeconds;
    state.status = 'idle';
    btnRepeat.hidden = true;
    updateDisplay();
    startTimer();
  });

  btnSwitchMode.addEventListener('click', () => {
    const next = state.mode === 'work' ? 'break' : 'work';
    resetToMode(next);
  });

  // --- Init ---
  updateDisplay();
});

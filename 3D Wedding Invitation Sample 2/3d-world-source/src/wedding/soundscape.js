const pianoTrackUrl = import.meta.env.DEV
  ? '/src/assets/audio/world-piano.m4a'
  : new URL('../assets/audio/world-piano.m4a', document.baseURI).href;

// The supplied piano cover is the musical heart of the experience. A compact
// Web Audio layer adds ceremonial percussion, bells, shankh and firecrackers.
// The piano is streamed by the browser instead of being decoded into a large
// in-memory AudioBuffer, which keeps mobile memory use predictable.

const MASTER_VOLUME = 0.48;
const TRANSPORT_BPM = 96;
const STEP_SECONDS = 60 / TRANSPORT_BPM / 4;
const LOOKAHEAD_SECONDS = 0.26;

const AUDIO_PROFILES = {
  opening: { track: 0.80, drone: 0.52, air: 0.10, melody: 0.38, rhythm: 0.14 },
  procession: { track: 0.70, drone: 0.44, air: 0.11, melody: 0.50, rhythm: 0.52 },
  arrival: { track: 0.57, drone: 0.42, air: 0.12, melody: 0.52, rhythm: 0.58 },
  celebration: { track: 0.76, drone: 0.46, air: 0.10, melody: 0.48, rhythm: 0.44 },
};

const DHOLAK = [0.13, 0, 0, 0.045, 0.095, 0, 0.06, 0, 0.13, 0, 0, 0.045, 0.095, 0, 0.075, 0.052];
const TABLA = [0, 0, 0.055, 0, 0, 0.042, 0, 0.052, 0, 0, 0.055, 0, 0, 0.042, 0.06, 0];
const MANJIRA = [0.021, 0, 0, 0, 0.018, 0, 0, 0, 0.021, 0, 0, 0, 0.018, 0, 0, 0];

// Sa Re Ga Ma Pa Dha Ni Sa. The phrase is an original ceremonial refrain,
// deliberately not a transcription of any commercial wedding song.
const WEDDING_SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
const WEDDING_PHRASE = [0, 2, 1, 0, 2, 3, 4, 3, 2, 1, 0, 1, 2, 4, 3, 2];

export function createWeddingSoundscape({ button = null, onStateChange = null, initialTrackTime = 0 } = {}) {
  let audioCtx = null;
  let masterGain = null;
  let musicBus = null;
  let fxBus = null;
  let noiseBuffer = null;
  let audioStarted = false;
  let audioMuted = false;
  let pendingArrivalCue = false;
  let pendingArrivalRequestedAt = 0;
  let blessingPlayed = false;
  let desiredPhase = 'opening';
  let activePhase = '';
  let nextStepTime = 0;
  let stepIndex = 0;
  let schedulerId = null;
  let resumePromise = null;
  let resumeGeneration = 0;
  let pianoTrack = null;
  let pianoSource = null;
  let pianoGain = null;
  let trackPlaying = false;
  let trackFailed = false;
  let pendingTrackTime = Number.isFinite(Number(initialTrackTime)) ? Math.max(0, Number(initialTrackTime)) : null;
  let muteGeneration = 0;
  const buses = { drone: null, air: null, melody: null, rhythm: null };

  function holdParam(param, time) {
    if (!param) return;
    try {
      if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(time);
      else {
        const value = param.value;
        param.cancelScheduledValues(time);
        param.setValueAtTime(value, time);
      }
    } catch {
      param.cancelScheduledValues(time);
      param.setValueAtTime(param.value, time);
    }
  }

  function rampParam(param, value, seconds = 0.4, when = null) {
    if (!audioCtx || !param) return;
    const start = Math.max(audioCtx.currentTime, when ?? audioCtx.currentTime);
    holdParam(param, start);
    param.linearRampToValueAtTime(value, start + seconds);
  }

  function transientEnvelope(param, time, peak, attack, release) {
    param.cancelScheduledValues(time);
    param.setValueAtTime(0.0001, time);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack);
    param.exponentialRampToValueAtTime(0.0001, time + attack + release);
  }

  function connectWithPan(node, destination, pan = 0) {
    if (typeof audioCtx.createStereoPanner === 'function') {
      const panner = audioCtx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner);
      panner.connect(destination);
    } else node.connect(destination);
  }

  function applyPhase(next, seconds = 0.55, when = null) {
    if (!audioCtx || !audioStarted) return;
    activePhase = AUDIO_PROFILES[next] ? next : 'opening';
    const profile = AUDIO_PROFILES[activePhase];
    const pianoMix = trackPlaying;
    const rhythmScale = pianoMix
      ? (activePhase === 'arrival' ? 0.78 : activePhase === 'procession' ? 0.70 : activePhase === 'celebration' ? 0.58 : 0.34)
      : 1;
    rampParam(pianoGain?.gain, profile.track, seconds, when);
    rampParam(buses.drone.gain, profile.drone * (pianoMix ? 0.11 : 1), seconds, when);
    rampParam(buses.air.gain, profile.air * (pianoMix ? 0.82 : 1), seconds, when);
    rampParam(buses.melody.gain, profile.melody * (pianoMix ? 0.07 : 1), seconds, when);
    rampParam(buses.rhythm.gain, profile.rhythm * rhythmScale, seconds, when);
  }

  function setTrackPlaying(next) {
    const value = Boolean(next);
    if (trackPlaying === value) { setButtonState(); return; }
    trackPlaying = value;
    if (value && audioCtx?.state === 'running') {
      unlockEvents.forEach((name) => window.removeEventListener(name, unlockAudio));
    }
    if (audioStarted) applyPhase(desiredPhase, value ? 0.7 : 0.28);
    setButtonState();
  }

  function applyInitialTrackTime() {
    if (!pianoTrack || pendingTrackTime == null || pianoTrack.readyState < 1) return;
    try {
      const duration = Number.isFinite(pianoTrack.duration) && pianoTrack.duration > 0 ? pianoTrack.duration : null;
      pianoTrack.currentTime = duration ? pendingTrackTime % duration : pendingTrackTime;
      pendingTrackTime = null;
    } catch { /* metadata may not be seekable until the next media event */ }
  }

  function playPianoTrack(forceGesture = false) {
    if (!pianoTrack || trackFailed || audioMuted || document.hidden) return;
    applyInitialTrackTime();
    if (!forceGesture && !pianoTrack.paused) return;
    try {
      const result = pianoTrack.play();
      if (result?.then) {
        result
          .then(() => setTrackPlaying(true))
          .catch(() => setTrackPlaying(false));
      } else setTrackPlaying(true);
    } catch {
      setTrackPlaying(false);
    }
  }

  function pausePianoTrack() {
    if (!pianoTrack || pianoTrack.paused) return;
    try { pianoTrack.pause(); } catch { /* keep the procedural fallback alive */ }
    setTrackPlaying(false);
  }

  function setPhase(next, immediate = false) {
    desiredPhase = AUDIO_PROFILES[next] ? next : 'opening';
    if (desiredPhase !== 'arrival') {
      pendingArrivalCue = false;
      pendingArrivalRequestedAt = 0;
    }
    if (audioStarted && (immediate || !activePhase)) applyPhase(desiredPhase, immediate ? 0.08 : 0.55);
  }

  function scheduleShehnai(time, frequency, duration, gain = 0.05, glideTo = null) {
    if (!audioCtx) return;
    const reed = audioCtx.createOscillator();
    const warmth = audioCtx.createOscillator();
    reed.type = 'sawtooth';
    warmth.type = 'triangle';
    reed.frequency.setValueAtTime(frequency, time);
    warmth.frequency.setValueAtTime(frequency, time);
    warmth.detune.value = 5;
    if (glideTo) {
      const glideAt = time + duration * 0.62;
      reed.frequency.setValueAtTime(frequency, glideAt);
      warmth.frequency.setValueAtTime(frequency, glideAt);
      reed.frequency.exponentialRampToValueAtTime(glideTo, time + duration * 0.94);
      warmth.frequency.exponentialRampToValueAtTime(glideTo, time + duration * 0.94);
    }

    const reedLevel = audioCtx.createGain(); reedLevel.gain.value = 0.62;
    const warmLevel = audioCtx.createGain(); warmLevel.gain.value = 0.34;
    const tone = audioCtx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 1650; tone.Q.value = 0.75;
    const envelope = audioCtx.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + 0.035);
    envelope.gain.setValueAtTime(gain * 0.9, time + Math.max(0.05, duration - 0.055));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    const vibrato = audioCtx.createOscillator(); vibrato.frequency.value = 5.1;
    const vibratoDepth = audioCtx.createGain(); vibratoDepth.gain.value = 10;
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(reed.detune);
    vibratoDepth.connect(warmth.detune);
    reed.connect(reedLevel); warmth.connect(warmLevel);
    reedLevel.connect(tone); warmLevel.connect(tone); tone.connect(envelope); envelope.connect(buses.melody);
    reed.start(time); warmth.start(time); vibrato.start(time);
    reed.stop(time + duration + 0.04); warmth.stop(time + duration + 0.04); vibrato.stop(time + duration + 0.04);
  }

  function scheduleDrum(time, frequency, gain, open = false, destination = null) {
    if (!audioCtx || gain <= 0) return;
    const target = destination || buses.rhythm;
    const body = audioCtx.createOscillator(); body.type = 'triangle';
    body.frequency.setValueAtTime(frequency * 1.75, time);
    body.frequency.exponentialRampToValueAtTime(frequency, time + 0.055);
    const bodyEnvelope = audioCtx.createGain();
    transientEnvelope(bodyEnvelope.gain, time, gain, 0.003, open ? 0.27 : 0.15);
    body.connect(bodyEnvelope); bodyEnvelope.connect(target);
    body.start(time); body.stop(time + (open ? 0.3 : 0.18));

    if (open && noiseBuffer) {
      const noise = audioCtx.createBufferSource(); noise.buffer = noiseBuffer;
      const clickFilter = audioCtx.createBiquadFilter();
      clickFilter.type = 'bandpass'; clickFilter.frequency.value = 1250; clickFilter.Q.value = 0.85;
      const clickEnvelope = audioCtx.createGain();
      transientEnvelope(clickEnvelope.gain, time, gain * 0.2, 0.002, 0.07);
      noise.connect(clickFilter); clickFilter.connect(clickEnvelope); clickEnvelope.connect(target);
      noise.start(time, 0, 0.085); noise.stop(time + 0.09);
    }
  }

  function scheduleHoof(time, gain = 0.035, accent = false) {
    if (!audioCtx) return;
    const body = audioCtx.createOscillator(); body.type = 'triangle';
    body.frequency.setValueAtTime(accent ? 205 : 178, time);
    body.frequency.exponentialRampToValueAtTime(accent ? 88 : 74, time + 0.08);
    const envelope = audioCtx.createGain();
    transientEnvelope(envelope.gain, time, gain, 0.002, 0.1);
    body.connect(envelope); envelope.connect(buses.rhythm);
    body.start(time); body.stop(time + 0.115);
  }

  function scheduleManjira(time, gain = 0.02) {
    if (!audioCtx || !noiseBuffer) return;
    const noise = audioCtx.createBufferSource(); noise.buffer = noiseBuffer;
    const highpass = audioCtx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 5200;
    const envelope = audioCtx.createGain();
    transientEnvelope(envelope.gain, time, gain, 0.002, 0.17);
    noise.connect(highpass); highpass.connect(envelope); envelope.connect(buses.rhythm);
    noise.start(time, 0.18, 0.19); noise.stop(time + 0.2);
  }

  function scheduleSantoor(time, frequency, gain = 0.017) {
    if (!audioCtx) return;
    [1, 2.01].forEach((ratio, i) => {
      const oscillator = audioCtx.createOscillator(); oscillator.type = i ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency * ratio;
      const envelope = audioCtx.createGain();
      transientEnvelope(envelope.gain, time, gain / (i + 1), 0.003, 0.42 + i * 0.12);
      oscillator.connect(envelope); envelope.connect(buses.melody);
      oscillator.start(time); oscillator.stop(time + 0.58);
    });
  }

  function scheduleTempleBell(time, frequency = 622.25, gain = 0.028, destination = null) {
    if (!audioCtx) return;
    const target = destination || buses.melody;
    [1, 2.01, 2.72].forEach((ratio, i) => {
      const oscillator = audioCtx.createOscillator(); oscillator.type = 'sine';
      oscillator.frequency.value = frequency * ratio;
      const envelope = audioCtx.createGain();
      transientEnvelope(envelope.gain, time, gain / Math.pow(i + 1, 1.25), 0.006, 1.45 + i * 0.28);
      oscillator.connect(envelope); envelope.connect(target);
      oscillator.start(time); oscillator.stop(time + 2.35);
    });
  }

  function scheduleShankh(time, duration = 2.25, gain = 0.055) {
    if (!audioCtx || !fxBus) return;
    const fundamental = audioCtx.createOscillator(); fundamental.type = 'triangle';
    const overtone = audioCtx.createOscillator(); overtone.type = 'sine';
    fundamental.frequency.setValueAtTime(146.83, time);
    overtone.frequency.setValueAtTime(293.66, time);
    fundamental.frequency.exponentialRampToValueAtTime(155.56, time + duration * 0.72);
    overtone.frequency.exponentialRampToValueAtTime(311.13, time + duration * 0.72);
    const fundamentalLevel = audioCtx.createGain(); fundamentalLevel.gain.value = 0.76;
    const overtoneLevel = audioCtx.createGain(); overtoneLevel.gain.value = 0.28;
    const formant = audioCtx.createBiquadFilter(); formant.type = 'bandpass'; formant.frequency.value = 480; formant.Q.value = 0.75;
    const envelope = audioCtx.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + 0.08);
    envelope.gain.setValueAtTime(gain * 0.92, time + duration * 0.68);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    const vibrato = audioCtx.createOscillator(); vibrato.frequency.value = 4.6;
    const depth = audioCtx.createGain(); depth.gain.value = 5;
    vibrato.connect(depth); depth.connect(fundamental.detune); depth.connect(overtone.detune);
    fundamental.connect(fundamentalLevel); overtone.connect(overtoneLevel);
    fundamentalLevel.connect(formant); overtoneLevel.connect(formant); formant.connect(envelope); envelope.connect(fxBus);
    fundamental.start(time); overtone.start(time); vibrato.start(time);
    fundamental.stop(time + duration + 0.05); overtone.stop(time + duration + 0.05); vibrato.stop(time + duration + 0.05);
  }

  function scheduleFirecracker(time, gain = 0.045, pan = 0) {
    if (!audioCtx || !noiseBuffer || !fxBus) return;
    const noise = audioCtx.createBufferSource(); noise.buffer = noiseBuffer;
    const crack = audioCtx.createBiquadFilter(); crack.type = 'bandpass';
    crack.frequency.value = 1700 + Math.random() * 1200; crack.Q.value = 0.55;
    const envelope = audioCtx.createGain();
    transientEnvelope(envelope.gain, time, gain, 0.0015, 0.12);
    noise.connect(crack); crack.connect(envelope); connectWithPan(envelope, fxBus, pan);
    const maxOffset = Math.max(0, noiseBuffer.duration - 0.16);
    noise.start(time, Math.random() * maxOffset, 0.15); noise.stop(time + 0.155);

    const boom = audioCtx.createOscillator(); boom.type = 'sine';
    boom.frequency.setValueAtTime(125, time);
    boom.frequency.exponentialRampToValueAtTime(48, time + 0.15);
    const boomEnvelope = audioCtx.createGain();
    transientEnvelope(boomEnvelope.gain, time, gain * 0.24, 0.003, 0.18);
    boom.connect(boomEnvelope); connectWithPan(boomEnvelope, fxBus, pan);
    boom.start(time); boom.stop(time + 0.2);
  }

  function scheduleMusicStep(time, index) {
    const step = index % 16;
    const bar = Math.floor(index / 16);
    if (step === 0 && activePhase !== desiredPhase) applyPhase(desiredPhase, 0.42, time);
    const phase = activePhase || desiredPhase;
    const opening = phase === 'opening';
    const travelling = phase === 'procession' || phase === 'arrival';
    const intensity = phase === 'arrival' ? 1.06 : phase === 'celebration' ? 0.82 : 1;

    // When the cover is playing, it owns the harmony. The procedural layer
    // becomes sparse wedding ambience so it enriches the track without
    // fighting its tempo or melody. If media playback is unavailable, the
    // complete original score below remains as a graceful fallback.
    if (trackPlaying) {
      if (opening) {
        if (step === 0 && bar > 0 && bar % 4 === 0) scheduleTempleBell(time, 587.33, 0.018);
      } else {
        if (step === 0 || (step === 8 && phase !== 'celebration')) {
          scheduleDrum(time, 132, (phase === 'arrival' ? 0.09 : 0.065) * intensity, true);
        }
        if (step === 4 || step === 12) scheduleManjira(time, phase === 'arrival' ? 0.018 : 0.013);
        if (travelling && (step === 5 || step === 13)) {
          scheduleHoof(time, phase === 'arrival' ? 0.034 : 0.026, step === 13);
        }
        if (step === 0 && bar > 0 && bar % 6 === 0) scheduleTempleBell(time, 659.25, 0.016);
      }
      return;
    }

    if (opening) {
      if (step === 0 || step === 8) scheduleDrum(time, 132, 0.047, true);
    } else {
      if (DHOLAK[step]) scheduleDrum(time, 132, DHOLAK[step] * intensity, true);
      if (TABLA[step]) scheduleDrum(time, 225, TABLA[step] * intensity, false);
      if (MANJIRA[step]) scheduleManjira(time, MANJIRA[step] * (phase === 'arrival' ? 1.08 : 1));
      if (travelling && (step === 5 || step === 13)) scheduleHoof(time, phase === 'arrival' ? 0.04 : 0.033, step === 13);
    }

    const noteStride = opening ? 4 : 2;
    if (index % noteStride === 0) {
      const phraseIndex = Math.floor(index / noteStride) % WEDDING_PHRASE.length;
      const scaleIndex = WEDDING_PHRASE[phraseIndex];
      const nextScaleIndex = WEDDING_PHRASE[(phraseIndex + 1) % WEDDING_PHRASE.length];
      const duration = STEP_SECONDS * noteStride - 0.035;
      const ornament = phraseIndex % 8 === 7 ? WEDDING_SCALE[nextScaleIndex] : null;
      scheduleShehnai(time, WEDDING_SCALE[scaleIndex], duration, opening ? 0.041 : 0.052, ornament);
    }

    if (!opening && (step === 3 || step === 11) && bar % 2 === 0) {
      const scaleIndex = WEDDING_PHRASE[(Math.floor(index / 2) + 2) % WEDDING_PHRASE.length];
      scheduleSantoor(time, WEDDING_SCALE[scaleIndex] * 2, phase === 'arrival' ? 0.019 : 0.015);
    }
    if (step === 0 && bar > 0 && bar % (opening ? 2 : 4) === 0) {
      scheduleTempleBell(time, opening ? 587.33 : 659.25, opening ? 0.025 : 0.021);
    }
  }

  function pumpScheduler() {
    if (!audioCtx || audioCtx.state !== 'running' || audioMuted) return;
    const now = audioCtx.currentTime;
    if (nextStepTime < now - STEP_SECONDS) nextStepTime = now + 0.055;
    let guard = 0;
    while (nextStepTime < now + LOOKAHEAD_SECONDS && guard++ < 8) {
      scheduleMusicStep(nextStepTime, stepIndex);
      nextStepTime += STEP_SECONDS;
      stepIndex++;
    }
  }

  function duckMusic(time, duration = 2.75) {
    if (!musicBus) return;
    holdParam(musicBus.gain, time);
    musicBus.gain.linearRampToValueAtTime(0.29, time + 0.07);
    musicBus.gain.setValueAtTime(0.29, time + duration - 0.38);
    musicBus.gain.linearRampToValueAtTime(1, time + duration);
  }

  function playArrivalCue() {
    if (!audioCtx || !audioStarted || audioCtx.state !== 'running' || audioMuted) {
      pendingArrivalCue = desiredPhase === 'arrival';
      pendingArrivalRequestedAt = pendingArrivalCue ? performance.now() : 0;
      return;
    }
    if (desiredPhase !== 'arrival') {
      pendingArrivalCue = false;
      pendingArrivalRequestedAt = 0;
      return;
    }
    pendingArrivalCue = false;
    pendingArrivalRequestedAt = 0;
    blessingPlayed = true;
    const time = audioCtx.currentTime + 0.065;
    duckMusic(time, 3.75);
    scheduleShankh(time, 2.7, 0.074);
    // A compact dhol flourish and staggered stereo crackers make the single
    // arrival cue feel much larger without downloading or decoding more audio.
    [0, 0.18, 0.36, 0.56, 0.8, 1.08].forEach((offset, i) =>
      scheduleDrum(time + offset, i % 2 ? 215 : 132, 0.125 + i * 0.006, true, fxBus)
    );
    scheduleTempleBell(time + 0.82, 523.25, 0.052, fxBus);
    scheduleTempleBell(time + 1.02, 659.25, 0.038, fxBus);
    [
      [1.18, 0.078, -0.7], [1.36, 0.064, 0.62], [1.58, 0.073, -0.18],
      [1.9, 0.061, 0.34], [2.26, 0.069, -0.5], [2.7, 0.058, 0.7],
    ].forEach(([offset, gain, pan]) => scheduleFirecracker(time + offset, gain, pan));
  }

  function setButtonState() {
    const playing = audioStarted && !audioMuted && audioCtx?.state === 'running';
    if (button) {
      button.textContent = playing ? '🔊' : '🔇';
      button.setAttribute('aria-pressed', String(playing));
      const label = playing ? 'Mute wedding music' : 'Play wedding music';
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    if (typeof onStateChange === 'function') {
      try { onStateChange({ playing, musicPlaying: trackPlaying, muted: audioMuted }); }
      catch { /* audio must never fail because an optional UI callback did */ }
    }
  }

  function requestResume(forceGesture = false) {
    if (!audioCtx) return Promise.resolve(false);
    if (resumePromise && !forceGesture) return resumePromise;
    const generation = ++resumeGeneration;
    let timeoutId = 0;
    let operation;
    try {
      operation = audioCtx.state === 'running' ? Promise.resolve() : Promise.resolve(audioCtx.resume?.());
    } catch (error) {
      operation = Promise.reject(error);
    }
    const timeout = new Promise((resolve) => {
      timeoutId = window.setTimeout(resolve, forceGesture ? 900 : 650);
    });
    const pending = Promise.race([operation, timeout])
      .then(() => {
        audioStarted = audioCtx?.state === 'running';
        if (!audioStarted) return false;
        applyPhase(desiredPhase, 0.1);
        if (nextStepTime < audioCtx.currentTime + 0.025) nextStepTime = audioCtx.currentTime + 0.07;
        rampParam(masterGain?.gain, audioMuted ? 0.0001 : MASTER_VOLUME, 0.5);
        const pendingCueIsFresh = pendingArrivalRequestedAt > 0
          && performance.now() - pendingArrivalRequestedAt < 1400;
        if (pendingArrivalCue && desiredPhase === 'arrival' && pendingCueIsFresh) playArrivalCue();
        else {
          pendingArrivalCue = false;
          pendingArrivalRequestedAt = 0;
          if (!blessingPlayed && desiredPhase === 'opening') {
            blessingPlayed = true;
            scheduleTempleBell(audioCtx.currentTime + 0.1, 587.33, 0.026, fxBus);
          }
        }
        if (trackPlaying) unlockEvents.forEach((name) => window.removeEventListener(name, unlockAudio));
        return true;
      })
      .catch(() => { audioStarted = false; return false; })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (generation === resumeGeneration) resumePromise = null;
        setButtonState();
      });
    resumePromise = pending;
    return resumePromise;
  }

  function startAudio(forceGesture = false) {
    if (audioCtx) {
      const resume = requestResume(forceGesture);
      playPianoTrack(forceGesture);
      return resume;
    }
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      try { audioCtx = new AudioContextCtor({ latencyHint: 'balanced' }); }
      catch { audioCtx = new AudioContextCtor(); }

      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -15;
      compressor.knee.value = 14;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.24;
      masterGain = audioCtx.createGain(); masterGain.gain.value = 0.0001;
      musicBus = audioCtx.createGain(); musicBus.gain.value = 1;
      fxBus = audioCtx.createGain(); fxBus.gain.value = 0.92;
      musicBus.connect(masterGain); fxBus.connect(masterGain);
      masterGain.connect(compressor); compressor.connect(audioCtx.destination);

      for (const key of Object.keys(buses)) {
        buses[key] = audioCtx.createGain();
        buses[key].gain.value = 0.001;
        buses[key].connect(musicBus);
      }

      // Keep one persistent media element/source pair. Recreating a media
      // source is invalid, and decoding this five-minute track into an
      // AudioBuffer would cost roughly 100 MB on a phone.
      pianoTrack = new Audio();
      pianoTrack.src = pianoTrackUrl;
      pianoTrack.preload = 'metadata';
      pianoTrack.loop = true;
      pianoTrack.playsInline = true;
      pianoTrack.setAttribute('playsinline', '');
      pianoTrack.addEventListener('loadedmetadata', applyInitialTrackTime, { once: true });
      pianoSource = audioCtx.createMediaElementSource(pianoTrack);
      pianoGain = audioCtx.createGain(); pianoGain.gain.value = 0.0001;
      pianoSource.connect(pianoGain); pianoGain.connect(musicBus);
      pianoTrack.addEventListener('playing', () => setTrackPlaying(true));
      pianoTrack.addEventListener('pause', () => setTrackPlaying(false));
      pianoTrack.addEventListener('error', () => {
        trackFailed = true;
        setTrackPlaying(false);
      });

      // Tanpura-inspired Sa-Pa-Sa drone: always present beneath the melody.
      [130.81, 196.0, 261.63].forEach((frequency, i) => {
        const oscillator = audioCtx.createOscillator(); oscillator.type = i === 0 ? 'sine' : 'triangle';
        oscillator.frequency.value = frequency;
        const level = audioCtx.createGain(); level.gain.value = [0.14, 0.075, 0.045][i];
        const lowpass = audioCtx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 700;
        const lfo = audioCtx.createOscillator(); lfo.frequency.value = 0.075 + i * 0.028;
        const depth = audioCtx.createGain(); depth.gain.value = 2.2;
        lfo.connect(depth); depth.connect(oscillator.detune);
        oscillator.connect(level); level.connect(lowpass); lowpass.connect(buses.drone);
        oscillator.start(); lfo.start();
      });

      const noiseLength = audioCtx.sampleRate;
      noiseBuffer = audioCtx.createBuffer(1, noiseLength, audioCtx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseLength; i++) data[i] = (Math.random() * 2 - 1) * 0.45;
      const fadeSamples = Math.min(256, Math.floor(noiseLength / 4));
      for (let i = 0; i < fadeSamples; i++) {
        const mix = (i + 1) / fadeSamples;
        const endIndex = noiseLength - fadeSamples + i;
        data[endIndex] = data[endIndex] * (1 - mix) + data[i] * mix;
      }
      const air = audioCtx.createBufferSource(); air.buffer = noiseBuffer; air.loop = true;
      const airFilter = audioCtx.createBiquadFilter(); airFilter.type = 'bandpass'; airFilter.frequency.value = 1100; airFilter.Q.value = 0.55;
      const airLevel = audioCtx.createGain(); airLevel.gain.value = 0.022;
      air.connect(airFilter); airFilter.connect(airLevel); airLevel.connect(buses.air); air.start();

      nextStepTime = audioCtx.currentTime + 0.075;
      schedulerId = window.setInterval(pumpScheduler, 75);
      const resume = requestResume(forceGesture);
      // This call deliberately stays in the original pointer/click stack;
      // mobile browsers otherwise reject it even if AudioContext resumes.
      playPianoTrack(forceGesture);
      return resume;
    } catch {
      audioStarted = false;
      audioCtx = null;
      masterGain = null;
      if (schedulerId) window.clearInterval(schedulerId);
      schedulerId = null;
      setButtonState();
      return Promise.resolve();
    }
  }

  function toggleMute() {
    audioMuted = !audioMuted;
    const generation = ++muteGeneration;
    if (!audioMuted) {
      requestResume(true);
      playPianoTrack(true);
    } else {
      window.setTimeout(() => {
        if (audioMuted && generation === muteGeneration) pausePianoTrack();
      }, 320);
    }
    rampParam(masterGain?.gain, audioMuted ? 0.0001 : MASTER_VOLUME, 0.28);
    setButtonState();
  }

  function stayMuted() {
    audioMuted = true;
    ++muteGeneration;
    pausePianoTrack();
    rampParam(masterGain?.gain, 0.0001, 0.18);
    unlockEvents.forEach((name) => window.removeEventListener(name, unlockAudio));
    setButtonState();
  }

  const unlockEvents = window.PointerEvent ? ['pointerdown', 'keydown'] : ['touchstart', 'keydown'];
  function unlockAudio(event) {
    if (event.target instanceof Element && event.target.closest('#soundBtn')) return;
    audioMuted = false;
    startAudio(true);
    setButtonState();
  }
  unlockEvents.forEach((name) => window.addEventListener(name, unlockAudio, { passive: true }));

  button?.addEventListener('click', (event) => {
    event.stopPropagation();
    const audible = audioStarted && !audioMuted && audioCtx?.state === 'running';
    if (!audible) {
      audioMuted = false;
      startAudio(true);
    } else toggleMute();
    setButtonState();
  });

  document.addEventListener('visibilitychange', () => {
    if (!audioCtx) return;
    if (document.hidden) {
      pausePianoTrack();
      Promise.resolve(audioCtx.suspend?.()).catch(() => {});
    } else if (!audioMuted) {
      requestResume();
      playPianoTrack();
    }
  });

  setButtonState();
  return {
    setPhase,
    playArrivalCue,
    start: startAudio,
    stayMuted,
    isMusicPlaying: () => Boolean(trackPlaying && audioCtx?.state === 'running' && !audioMuted),
  };
}

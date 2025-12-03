import { initFieldState, fieldToWavePreset, fieldToReceiverMode, applySignal as applyFieldSignal, applyWaveObservation } from 'field'
import { PersonaWavetableSynth } from 'wave'
import { Visualizer } from 'wave/visualizer'

const STEP_DEFAULT_DT = 0.016
const VALUE_CENTER = 0.5
const VALUE_AMPLITUDE = 0.5
const VALUE_FREQ_BASE = 0.5
const JITTER_MAX = 0.1
const JITTER_DECAY = 0.98
const JITTER_STEP_BASE = 0.01
const JITTER_STEP_SCALE = 0.06
const HAS_WINDOW_AUDIO = typeof globalThis !== 'undefined' && globalThis.window && (window.AudioContext || window.webkitAudioContext)

function clamp01(x) { return Math.max(0, Math.min(1, x)) }
function clampSym(x, m) { return Math.max(-m, Math.min(m, x)) }

export class Receiver {
  constructor({
    seed = 0,
    audioContext = null,
    canvas = null,
    initialPreset = null,
    name = 'receiver'
  } = {}) {
    this.name = name
    this.fieldState = initFieldState(seed)
    let ctx = audioContext
    if (!ctx && HAS_WINDOW_AUDIO) {
      const AC = window.AudioContext || window.webkitAudioContext
      ctx = new AC()
    }
    this.audioContext = ctx
    this.synth = ctx ? new PersonaWavetableSynth(ctx) : null
    this._time = 0
    this._jitter = 0
    const basePreset = fieldToWavePreset(this.fieldState)
    this.preset = initialPreset || basePreset
    applyPresetToSynth(this.synth, this.preset)
    this.canvas = null
    this.visualizer = null
    if (canvas && this.synth) this._initVisualizer(canvas)
  }

  _initVisualizer(canvas) {
    this.canvas = canvas
    try {
      const v = new Visualizer(canvas)
      if (this.synth && typeof v.setSynth === 'function') v.setSynth(this.synth)
      if (typeof v.start === 'function') v.start()
      this.visualizer = v
    } catch {
      this.visualizer = null
    }
  }

  attachCanvas(canvas) {
    if (!this.synth) return
    this._initVisualizer(canvas)
  }

  async start() {
    if (!this.synth) return
    if (typeof this.synth.resume === 'function') await this.synth.resume()
  }

  async stop() {
    if (!this.synth) return
    if (typeof this.synth.stop === 'function') this.synth.stop()
    const ctx = this.synth.audioContext || this.synth.context || this.audioContext
    if (ctx && ctx.state === 'running' && typeof ctx.suspend === 'function') await ctx.suspend()
  }

  setPreset(preset) {
    if (!preset) return
    this.preset = preset
    applyPresetToSynth(this.synth, preset)
  }

  applySignal(signal) {
    this.fieldState = applyFieldSignal(this.fieldState, signal)
    const preset = fieldToWavePreset(this.fieldState)
    this.preset = preset
    applyPresetToSynth(this.synth, preset)
  }

  step(dt = STEP_DEFAULT_DT) {
    this._time += dt
    const mode = fieldToReceiverMode(this.fieldState)
    let waveState = null
    if (this.synth && typeof this.synth.getState === 'function') waveState = this.synth.getState()
    const entropy = waveState && typeof waveState.richnessNorm === 'number' ? clamp01(waveState.richnessNorm) : 0
    const persona = this.fieldState.persona || {}
    const plasticity = typeof persona.plasticity === 'number' ? clamp01(persona.plasticity) : 0.5
    const jitterStep = (Math.random() - 0.5) * (JITTER_STEP_BASE + JITTER_STEP_SCALE * plasticity)
    this._jitter = clampSym(this._jitter * JITTER_DECAY + jitterStep, JITTER_MAX)
    const freq = VALUE_FREQ_BASE * (0.5 + entropy)
    const base = VALUE_CENTER + VALUE_AMPLITUDE * Math.sin(this._time * Math.PI * freq)
    const t = clamp01(base + this._jitter)
    if (this.synth && typeof this.synth.setValue === 'function') this.synth.setValue(t)
    waveState = null
    if (this.synth && typeof this.synth.getState === 'function') waveState = this.synth.getState()
    if (this.visualizer) {
      if (typeof this.visualizer.setEntropy === 'function') this.visualizer.setEntropy(entropy)
      if (typeof this.visualizer.setRefinement === 'function') {
        const r = this.preset && typeof this.preset.refinement === 'number' ? this.preset.refinement : 0.5
        this.visualizer.setRefinement(r)
      }
      if (typeof this.visualizer.setSmear === 'function') this.visualizer.setSmear(plasticity)
    }
    const observation = waveState ? { entropy: waveState.richnessNorm ?? 0 } : { entropy }
    this.fieldState = applyWaveObservation(this.fieldState, observation)
    return { field: this.fieldState, mode, wave: waveState }
  }

  getSnapshot() {
    const mode = fieldToReceiverMode(this.fieldState)
    let waveState = null
    if (this.synth && typeof this.synth.getState === 'function') waveState = this.synth.getState()
    return { field: this.fieldState, mode, wave: waveState }
  }
}

function applyPresetToSynth(synth, preset) {
  if (!preset || !synth) return
  const { delay, entropy, refinement, coupling, value } = preset
  if (typeof delay === 'number' && synth.setDelay) synth.setDelay(delay)
  if (typeof entropy === 'number' && synth.setEntropy) synth.setEntropy(entropy)
  if (typeof refinement === 'number' && synth.setRefinement) synth.setRefinement(refinement)
  if (typeof coupling === 'number' && synth.setCoupling) synth.setCoupling(coupling)
  if (typeof value === 'number' && synth.setValue) synth.setValue(value)
}
import test from 'node:test'
import assert from 'node:assert/strict'
import { Receiver } from './index.mjs'

function banner(msg) {
  const line = '='.repeat(msg.length)
  console.log(`\n${msg}\n${line}`)
}

test('RECEIVER: closed-loop integration (field → wave → observation → field)', async () => {
  banner('RECEIVER INTEGRATION TEST')
  const receiver = new Receiver({ seed: 42, audioContext: null })
  const snap0 = receiver.getSnapshot()
  console.log('receiver: initial snapshot', {
    fieldPersona: snap0.field.persona,
    receiverMode: snap0.mode,
    waveState: snap0.wave
  })
  assert.equal(snap0.field.persona.phase, 'rut')
  assert.equal(snap0.field.persona.energy, 0.5)
  assert.equal(snap0.field.persona.plasticity, 0.5)
  assert.ok(snap0.mode && typeof snap0.mode.band === 'string')
  assert.ok(Array.isArray(snap0.mode ? Object.keys(snap0.mode) : []))

  const passive = []
  for (let i = 0; i < 3; i++) {
    const snap = receiver.step(0.1)
    passive.push(snap)
  }
  const lastPassive = passive[passive.length - 1]
  console.log('receiver: passive steps (no external signals)', {
    stepCount: passive.length,
    finalPersona: lastPassive.field.persona,
    finalMode: lastPassive.mode,
    finalWaveSummary: lastPassive.wave && {
      value: lastPassive.wave.value,
      richnessNorm: lastPassive.wave.richnessNorm,
      dominant: lastPassive.wave.dominant && lastPassive.wave.dominant.id
    }
  })
  assert.ok(lastPassive.field && lastPassive.field.persona)
  assert.ok(lastPassive.mode && typeof lastPassive.mode.band === 'string')
  if (lastPassive.wave) {
    assert.equal(typeof lastPassive.wave.value, 'number')
    assert.ok(Array.isArray(lastPassive.wave.weights))
  }

  const beforeBurst = receiver.getSnapshot()
  receiver.applySignal({ type: 'burst' })
  const afterBurst = receiver.getSnapshot()
  console.log('receiver: after burst signal', {
    beforePersona: beforeBurst.field.persona,
    afterPersona: afterBurst.field.persona,
    beforeMode: beforeBurst.mode,
    afterMode: afterBurst.mode
  })
  assert.ok(
    afterBurst.field.persona.energy >= beforeBurst.field.persona.energy,
    'burst should not reduce energy'
  )

  const stepAfterBurst = receiver.step(0.1)
  console.log('receiver: step after burst', {
    persona: stepAfterBurst.field.persona,
    mode: stepAfterBurst.mode,
    wave: stepAfterBurst.wave && {
      value: stepAfterBurst.wave.value,
      richnessNorm: stepAfterBurst.wave.richnessNorm
    }
  })
  assert.ok(stepAfterBurst.field.persona.energy >= afterBurst.field.persona.energy)
  const beforeQuiet = receiver.getSnapshot()
  receiver.applySignal({ type: 'silence' })
  const afterQuiet = receiver.getSnapshot()
  console.log('receiver: after silence signal', {
    beforePersona: beforeQuiet.field.persona,
    afterPersona: afterQuiet.field.persona
  })
  assert.ok(
    afterQuiet.field.persona.energy <= beforeQuiet.field.persona.energy,
    'silence should not increase energy'
  )

  const finalSnap = receiver.step(0.1)
  console.log('receiver: final snapshot after closed-loop steps', {
    persona: finalSnap.field.persona,
    mode: finalSnap.mode,
    wave: finalSnap.wave && {
      value: finalSnap.wave.value,
      richnessNorm: finalSnap.wave.richnessNorm,
      dominant: finalSnap.wave.dominant && finalSnap.wave.dominant.id
    }
  })
  assert.ok(finalSnap.field && finalSnap.mode)
})

test('RECEIVER: noop signal leaves field energy unchanged', () => {
  banner('RECEIVER NOOP CONTROL TEST')
  const receiver = new Receiver({ seed: 7, audioContext: null })
  const before = receiver.getSnapshot()
  console.log('receiver noop: before noop signal', {
    persona: before.field.persona,
    mode: before.mode
  })
  const noop = { type: 'noop' }
  receiver.applySignal(noop)
  const after = receiver.getSnapshot()
  console.log('receiver noop: after noop signal', {
    persona: after.field.persona,
    mode: after.mode
  })
  assert.equal(
    after.field.persona.energy,
    before.field.persona.energy,
    'noop signal should not change persona energy'
  )
})
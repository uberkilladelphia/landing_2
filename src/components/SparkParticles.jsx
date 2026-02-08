import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const MAX_PARTICLES = 360
const MAX_STREAKS = 92
const TAU = Math.PI * 2
const EMBER_SIZE_SCALE = 2.1
const SOURCE_X_BASE = 0.14
const TARGET_X_BASE = 0.52
const FLAME_AREA_SCALE = 5
const COLOR_STOPS = [
  [0.0, 86, 26, 8],
  [0.22, 148, 50, 12],
  [0.48, 210, 92, 20],
  [0.72, 255, 150, 44],
  [0.9, 255, 206, 118],
  [1.0, 255, 244, 216],
]

const LAYERS = [
  {
    weight: 0.44,
    speedMin: 24,
    speedMax: 62,
    sizeMin: 0.65,
    sizeMax: 1.25,
    alphaMin: 0.12,
    alphaMax: 0.36,
    haloMin: 2.2,
    haloMax: 3.2,
    drag: 0.992,
    buoyancy: 26,
    flow: 16,
    popChance: 0.02,
  },
  {
    weight: 0.36,
    speedMin: 42,
    speedMax: 94,
    sizeMin: 0.95,
    sizeMax: 1.85,
    alphaMin: 0.2,
    alphaMax: 0.58,
    haloMin: 2.8,
    haloMax: 3.9,
    drag: 0.989,
    buoyancy: 38,
    flow: 24,
    popChance: 0.06,
  },
  {
    weight: 0.2,
    speedMin: 68,
    speedMax: 138,
    sizeMin: 1.45,
    sizeMax: 2.65,
    alphaMin: 0.34,
    alphaMax: 0.86,
    haloMin: 3.4,
    haloMax: 4.8,
    drag: 0.985,
    buoyancy: 52,
    flow: 34,
    popChance: 0.1,
  },
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const mix = (a, b, t) => a + (b - a) * t
const random = (min, max) => min + Math.random() * (max - min)
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

const randNorm = () => {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v)
}

class SimplexNoise {
  constructor(seed = Math.random() * 65536) {
    const grad3 = [
      [1, 1, 0],
      [-1, 1, 0],
      [1, -1, 0],
      [-1, -1, 0],
      [1, 0, 1],
      [-1, 0, 1],
      [1, 0, -1],
      [-1, 0, -1],
      [0, 1, 1],
      [0, -1, 1],
      [0, 1, -1],
      [0, -1, -1],
    ]
    this.grad3 = grad3
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i += 1) p[i] = i

    let s = seed | 0
    const rnd = () => {
      s ^= s << 13
      s ^= s >>> 17
      s ^= s << 5
      return ((s >>> 0) % 10000) / 10000
    }

    for (let i = 255; i > 0; i -= 1) {
      const r = Math.floor(rnd() * (i + 1))
      const tmp = p[i]
      p[i] = p[r]
      p[r] = tmp
    }

    this.perm = new Uint8Array(512)
    this.permMod12 = new Uint8Array(512)
    for (let i = 0; i < 512; i += 1) {
      this.perm[i] = p[i & 255]
      this.permMod12[i] = this.perm[i] % 12
    }
  }

  noise3D(xin, yin, zin) {
    const permMod12 = this.permMod12
    const perm = this.perm
    const grad3 = this.grad3

    const F3 = 1 / 3
    const G3 = 1 / 6
    let n0 = 0
    let n1 = 0
    let n2 = 0
    let n3 = 0

    const s = (xin + yin + zin) * F3
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const k = Math.floor(zin + s)
    const t = (i + j + k) * G3
    const X0 = i - t
    const Y0 = j - t
    const Z0 = k - t
    const x0 = xin - X0
    const y0 = yin - Y0
    const z0 = zin - Z0

    let i1 = 0
    let j1 = 0
    let k1 = 0
    let i2 = 0
    let j2 = 0
    let k2 = 0

    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1
        i2 = 1
        j2 = 1
      } else if (x0 >= z0) {
        i1 = 1
        i2 = 1
        k2 = 1
      } else {
        k1 = 1
        i2 = 1
        k2 = 1
      }
    } else if (y0 < z0) {
      k1 = 1
      j2 = 1
      k2 = 1
    } else if (x0 < z0) {
      j1 = 1
      j2 = 1
      k2 = 1
    } else {
      j1 = 1
      i2 = 1
      j2 = 1
    }

    const x1 = x0 - i1 + G3
    const y1 = y0 - j1 + G3
    const z1 = z0 - k1 + G3
    const x2 = x0 - i2 + 2 * G3
    const y2 = y0 - j2 + 2 * G3
    const z2 = z0 - k2 + 2 * G3
    const x3 = x0 - 1 + 3 * G3
    const y3 = y0 - 1 + 3 * G3
    const z3 = z0 - 1 + 3 * G3

    const ii = i & 255
    const jj = j & 255
    const kk = k & 255

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
    if (t0 > 0) {
      t0 *= t0
      const gi0 = permMod12[ii + perm[jj + perm[kk]]]
      const g0 = grad3[gi0]
      n0 = t0 * t0 * (g0[0] * x0 + g0[1] * y0 + g0[2] * z0)
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
    if (t1 > 0) {
      t1 *= t1
      const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]
      const g1 = grad3[gi1]
      n1 = t1 * t1 * (g1[0] * x1 + g1[1] * y1 + g1[2] * z1)
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
    if (t2 > 0) {
      t2 *= t2
      const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]
      const g2 = grad3[gi2]
      n2 = t2 * t2 * (g2[0] * x2 + g2[1] * y2 + g2[2] * z2)
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
    if (t3 > 0) {
      t3 *= t3
      const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]
      const g3 = grad3[gi3]
      n3 = t3 * t3 * (g3[0] * x3 + g3[1] * y3 + g3[2] * z3)
    }

    return 32 * (n0 + n1 + n2 + n3)
  }
}

const createParticle = () => ({
  active: false,
  layer: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  age: 0,
  life: 1,
  size: 1,
  halo: 3,
  alpha: 0.5,
  drag: 0.99,
  buoyancy: 40,
  flow: 20,
  startY: 0,
  rotation: 0,
  spin: 0,
  aspect: 1,
  chip: 0,
  skew: 0,
  rectBaseW: 1,
  rectBaseH: 1,
  roundness: 0.1,
  morphSpeed: 2.5,
  morphPhase: 0,
  flickerHz: 8,
  flickerPhase: 0,
  coolCurve: 1.8,
  rampIn: 0.08,
  seed: 0,
  baseHeat: 1,
  coolingRate: 1,
  tonguePhase: 0,
  tongueAmp: 0,
  tongueFreq: 0,
  pop: false,
  popLen: 0,
  popAlpha: 0,
})

const createStreak = () => ({
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  age: 0,
  life: 1,
  length: 12,
  width: 1.3,
  alpha: 0.4,
  drag: 0.987,
  flow: 18,
  riseBoost: 38,
  rotation: 0,
  spin: 0,
  flickerHz: 9,
  flickerPhase: 0,
  heat: 0.82,
  seed: 0,
  startY: 0,
  popBoost: 1,
})

const pickLayerIndex = () => {
  const r = Math.random()
  if (r < LAYERS[0].weight) return 0
  if (r < LAYERS[0].weight + LAYERS[1].weight) return 1
  return 2
}

const topFadeForY = (y, topStart, topEnd) => {
  if (y >= topStart) return 1
  if (y <= topEnd) return 0
  return (y - topEnd) / (topStart - topEnd)
}

const sampleHeatColor = (t) => {
  const heat = clamp(t, 0, 1)
  for (let i = 0; i < COLOR_STOPS.length - 1; i += 1) {
    const a = COLOR_STOPS[i]
    const b = COLOR_STOPS[i + 1]
    if (heat <= b[0]) {
      const lt = (heat - a[0]) / (b[0] - a[0] || 1)
      return {
        r: Math.round(mix(a[1], b[1], lt)),
        g: Math.round(mix(a[2], b[2], lt)),
        b: Math.round(mix(a[3], b[3], lt)),
      }
    }
  }
  const last = COLOR_STOPS[COLOR_STOPS.length - 1]
  return { r: last[1], g: last[2], b: last[3] }
}

const rgba = (rgb, alpha) => `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(alpha, 0, 1)})`

const roundedRectPath = (ctx, x, y, width, height, radius) => {
  const w = Math.max(0.001, width)
  const h = Math.max(0.001, height)
  const r = Math.min(Math.max(0, radius), w * 0.5, h * 0.5)
  const left = x - w * 0.5
  const top = y - h * 0.5
  const right = left + w
  const bottom = top + h

  ctx.beginPath()
  ctx.moveTo(left + r, top)
  ctx.lineTo(right - r, top)
  ctx.quadraticCurveTo(right, top, right, top + r)
  ctx.lineTo(right, bottom - r)
  ctx.quadraticCurveTo(right, bottom, right - r, bottom)
  ctx.lineTo(left + r, bottom)
  ctx.quadraticCurveTo(left, bottom, left, bottom - r)
  ctx.lineTo(left, top + r)
  ctx.quadraticCurveTo(left, top, left + r, top)
  ctx.closePath()
}

const initEmberSystem = (canvas, options = {}) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      start() {},
      stop() {},
      setIntensity() {},
      setWindStrength() {},
      destroy() {},
    }
  }

  const state = {
    width: 1,
    height: 1,
    dpr: 1,
    running: options.autoStart !== false,
    intensity: clamp(options.intensity ?? 1, 0.2, 2.8),
    windStrength: clamp(options.windStrength ?? 1, 0, 2.5),
    raf: 0,
    time: 0,
    last: 0,
  }

  const noise = new SimplexNoise()
  const particles = Array.from({ length: MAX_PARTICLES }, createParticle)
  const streaks = Array.from({ length: MAX_STREAKS }, createStreak)
  let nextPoolIndex = 0
  let nextStreakPoolIndex = 0
  let activeCount = 0
  let activeStreakCount = 0
  let emitAccumulator = 0
  let streakAccumulator = 0

  const wind = {
    from: 34,
    to: 52,
    value: 42,
    elapsed: 0,
    duration: random(6, 12),
  }

  const burst = {
    active: false,
    remain: 0,
    elapsed: 0,
    duration: 0,
    accumulator: 0,
    cooldown: random(3.6, 8.6),
  }

  const vortex = {
    active: false,
    x: 0,
    y: 0,
    radius: 0,
    strength: 0,
    elapsed: 0,
    duration: 0,
    cooldown: random(9, 17),
  }

  const resize = () => {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2)
    state.width = window.innerWidth
    state.height = window.innerHeight
    canvas.width = Math.round(state.width * state.dpr)
    canvas.height = Math.round(state.height * state.dpr)
    canvas.style.width = `${state.width}px`
    canvas.style.height = `${state.height}px`
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0)
  }

  const spawnParticle = (fromBurst = false) => {
    const maxActive = Math.round((58 + state.intensity * 62) * 1.75)
    if (activeCount >= maxActive) return

    for (let k = 0; k < particles.length; k += 1) {
      const i = (nextPoolIndex + k) % particles.length
      const p = particles[i]
      if (p.active) continue

      const layerIndex = pickLayerIndex()
      const layer = LAYERS[layerIndex]
      const pop = Math.random() < (fromBurst ? layer.popChance * 2.4 : layer.popChance)
      const plumeMeander =
        noise.noise3D(state.time * 0.06, 14.7, 3.1) * state.width * 0.06 * FLAME_AREA_SCALE
      const sourceCenterX = state.width * SOURCE_X_BASE + plumeMeander
      const sourceRadius =
        state.width * (0.04 + 0.012 * state.intensity) * FLAME_AREA_SCALE
      const sourceX = sourceCenterX + randNorm() * sourceRadius
      const sourceY = random(state.height * 0.915, state.height * 1.03)

      const speedBase = random(layer.speedMin, layer.speedMax) * 1.22
      const speed = pop ? speedBase * random(1.9, 2.8) : speedBase
      const windLean = clamp(wind.value * 0.002, 0.08, 0.35)
      const angle = random(-1.25, -0.95) + windLean

      p.active = true
      p.layer = layerIndex
      p.x = sourceX
      p.y = sourceY
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.age = 0
      p.life = pop ? random(0.55, 1.45) : random(3.2, 6.8)
      p.size = random(layer.sizeMin, layer.sizeMax)
      p.halo = random(layer.haloMin, layer.haloMax)
      p.alpha = random(layer.alphaMin, layer.alphaMax)
      p.drag = layer.drag
      p.buoyancy = layer.buoyancy
      p.flow = layer.flow
      p.startY = sourceY
      p.rotation = random(0, TAU)
      p.spin = random(-1.4, 1.4)
      p.aspect = random(0.7, 1.35)
      p.chip = random(0.14, 0.52)
      p.skew = random(-0.35, 0.35)
      p.rectBaseW = random(0.28, 0.82)
      p.rectBaseH = random(0.95, 2.25)
      p.roundness = random(0.02, 0.18)
      p.morphSpeed = random(1.9, 5.1)
      p.morphPhase = random(0, TAU)
      p.flickerHz = random(6, 12)
      p.flickerPhase = random(0, TAU)
      p.coolCurve = random(0.88, 1.42)
      p.rampIn = random(0.04, 0.11)
      p.seed = random(0, 1024)
      p.baseHeat = clamp(random(0.56 + p.layer * 0.12, 0.98), 0.42, 1)
      p.coolingRate = random(0.72, 1.24)
      if (pop) p.baseHeat = clamp(p.baseHeat + 0.16, 0, 1)
      p.tonguePhase = random(0, TAU)
      p.tongueAmp = random(state.width * 0.01, state.width * 0.035) * FLAME_AREA_SCALE
      p.tongueFreq = random(0.8, 1.9)
      p.pop = pop
      p.popLen = pop ? random(10, 24) : 0
      p.popAlpha = pop ? random(0.2, 0.5) : 0

      nextPoolIndex = (i + 1) % particles.length
      activeCount += 1
      return
    }
  }

  const spawnStreak = (fromBurst = false) => {
    const maxActive = Math.round((12 + state.intensity * 12) * 1.45)
    if (activeStreakCount >= maxActive) return

    for (let k = 0; k < streaks.length; k += 1) {
      const i = (nextStreakPoolIndex + k) % streaks.length
      const s = streaks[i]
      if (s.active) continue

      const plumeMeander =
        noise.noise3D(state.time * 0.055, 28.3, 4.7) * state.width * 0.058 * FLAME_AREA_SCALE
      const sourceCenterX = state.width * SOURCE_X_BASE + plumeMeander
      const midTargetX =
        state.width * TARGET_X_BASE +
        noise.noise3D(state.time * 0.05, 7.6, 24.9) * state.width * 0.05 * FLAME_AREA_SCALE
      const progress = Math.pow(Math.random(), 0.8) * 0.76
      const channelX = mix(sourceCenterX, midTargetX, progress)
      const lateralSpread = state.width * mix(0.018, 0.09, progress)
      const verticalSpread = state.height * mix(0.012, 0.04, progress)
      const sourceX = channelX + randNorm() * lateralSpread
      const sourceY = state.height * mix(0.95, 0.38, progress) + randNorm() * verticalSpread
      const popBoost = fromBurst ? random(1.2, 1.75) : 1
      const speed = random(170, 310) * popBoost
      const windLean = clamp(wind.value * 0.0018, 0.05, 0.22)
      const angle = random(-1.07, -0.69) + windLean

      s.active = true
      s.x = sourceX
      s.y = sourceY
      s.vx = Math.cos(angle) * speed
      s.vy = Math.sin(angle) * speed
      s.age = 0
      s.life = random(0.34, 1.05) / popBoost
      s.length = random(18, 46) * popBoost
      s.width = random(0.9, 1.95)
      s.alpha = random(0.24, 0.7)
      s.drag = random(0.98, 0.991)
      s.flow = random(14, 26)
      s.riseBoost = random(34, 76)
      s.rotation = random(0, TAU)
      s.spin = random(-1.8, 1.8)
      s.flickerHz = random(7.5, 12.6)
      s.flickerPhase = random(0, TAU)
      s.heat = random(0.72, 1)
      s.seed = random(0, 1024)
      s.startY = sourceY
      s.popBoost = popBoost

      nextStreakPoolIndex = (i + 1) % streaks.length
      activeStreakCount += 1
      return
    }
  }

  const updateWind = (dt) => {
    wind.elapsed += dt
    if (wind.elapsed >= wind.duration) {
      wind.elapsed = 0
      wind.from = wind.value
      wind.to = random(28, 66) * state.windStrength
      wind.duration = random(5, 15)
    }
    const t = wind.elapsed / wind.duration
    const eased = t * t * (3 - 2 * t)
    wind.value = mix(wind.from, wind.to, eased)
  }

  const updateBurst = (dt) => {
    if (!burst.active) {
      burst.cooldown -= dt
      if (burst.cooldown <= 0) {
        burst.active = true
        burst.remain = Math.round(random(10, 30))
        burst.duration = random(0.2, 0.5)
        burst.elapsed = 0
        burst.accumulator = 0
        burst.cooldown = random(4.2, 9.2)
      }
      return
    }

    burst.elapsed += dt
    const rate = burst.remain / Math.max(0.001, burst.duration - burst.elapsed + dt)
    burst.accumulator += rate * dt
    while (burst.accumulator >= 1 && burst.remain > 0) {
      burst.accumulator -= 1
      burst.remain -= 1
      spawnParticle(true)
      if (Math.random() < 0.08) spawnStreak(true)
    }
    if (burst.elapsed >= burst.duration || burst.remain <= 0) {
      burst.active = false
    }
  }

  const updateVortex = (dt) => {
    if (!vortex.active) {
      vortex.cooldown -= dt
      if (vortex.cooldown <= 0 && Math.random() < 0.66) {
        vortex.active = true
        vortex.elapsed = 0
        vortex.duration = random(1.2, 2.4)
        vortex.x = state.width * random(0.38, 0.64)
        vortex.y = state.height * random(0.32, 0.62)
        vortex.radius = state.width * random(0.09, 0.18)
        vortex.strength = random(22, 56)
        vortex.cooldown = random(10, 18)
      } else if (vortex.cooldown <= 0) {
        vortex.cooldown = random(7, 12)
      }
      return
    }
    vortex.elapsed += dt
    if (vortex.elapsed >= vortex.duration) {
      vortex.active = false
    }
  }

  const drawIrregularEmber = (p, alpha, size, speed) => {
    const haloAlpha = alpha * (0.16 + p.layer * 0.04)
    const coreAlpha = alpha
    const lifeT = p.age / p.life
    const coolT = Math.pow(lifeT, 0.72)
    const morphWave = Math.sin(state.time * p.morphSpeed + p.morphPhase)
    const flowMorph = noise.noise3D(p.seed * 0.017, state.time * 0.95, 2.8)
    const motionStretch = clamp(speed / 220, 0, 1)

    const rectW =
      size *
      p.rectBaseW *
      (1 + morphWave * 0.2 + flowMorph * 0.12 - motionStretch * 0.06 + p.skew * 0.14)
    const rectH =
      size *
      p.rectBaseH *
      (1 - morphWave * 0.12 + flowMorph * 0.07 + motionStretch * 0.44 - coolT * 0.15)
    const round =
      Math.min(rectW, rectH) *
      clamp(p.roundness + morphWave * 0.03 + flowMorph * 0.03 + coolT * 0.04, 0.015, 0.22)
    const velocityTilt = Math.atan2(p.vy, p.vx) + Math.PI * 0.5
    const thermalShimmer =
      0.985 + Math.sin(state.time * (7.2 + p.layer * 1.1) + p.flickerPhase) * 0.03
    const heat = clamp(
      p.baseHeat * Math.pow(Math.max(0, 1 - lifeT * 0.98), p.coolingRate) * thermalShimmer,
      0,
      1,
    )
    const haloRgb = sampleHeatColor(Math.max(0, heat - 0.25))
    const midRgb = sampleHeatColor(Math.max(0, heat - 0.1))
    const coreRgb = sampleHeatColor(Math.min(1, heat + 0.06))
    const chipRgb = sampleHeatColor(Math.min(1, heat + 0.14))

    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation * 0.72 + velocityTilt * 0.28)
    ctx.scale(p.aspect, 1 / p.aspect)

    // rectangular soft glow pass (no circular aura)
    ctx.shadowColor = rgba(haloRgb, haloAlpha * 0.95)
    ctx.shadowBlur = size * (2.2 + p.halo * 0.85)
    ctx.fillStyle = rgba(haloRgb, haloAlpha * 0.62)
    roundedRectPath(
      ctx,
      p.skew * size * 0.14,
      0,
      rectW * 1.22,
      rectH * 1.14,
      round * 1.05,
    )
    ctx.fill()
    ctx.shadowBlur = 0

    // mid rectangular glow
    ctx.fillStyle = rgba(midRgb, haloAlpha)
    roundedRectPath(
      ctx,
      p.skew * size * 0.12,
      -size * 0.01,
      rectW * 1.05,
      rectH * 1.02,
      round * 0.92,
    )
    ctx.fill()

    // bright rectangular core
    ctx.fillStyle = rgba(coreRgb, coreAlpha * 0.92)
    roundedRectPath(
      ctx,
      size * 0.04,
      -size * 0.02,
      rectW * 0.78,
      rectH * 0.76,
      round * 0.62,
    )
    ctx.fill()

    // chipped highlight fragment
    ctx.fillStyle = rgba(chipRgb, coreAlpha * 0.68)
    roundedRectPath(
      ctx,
      -rectW * (0.28 + p.chip * 0.18),
      rectH * (0.1 + p.chip * 0.06),
      rectW * 0.24,
      rectH * 0.14,
      Math.min(rectW, rectH) * 0.03,
    )
    ctx.fill()
    ctx.restore()

    if (p.pop && speed > 120 && p.age < p.life * 0.55) {
      const dirX = p.vx / speed
      const dirY = p.vy / speed
      const streakLen = p.popLen + Math.min(28, speed * 0.038)
      const tailX = p.x - dirX * streakLen
      const tailY = p.y - dirY * streakLen
      const gradient = ctx.createLinearGradient(tailX, tailY, p.x, p.y)
      const streakRgb = sampleHeatColor(Math.min(1, heat + 0.12))
      gradient.addColorStop(0, rgba(streakRgb, 0))
      gradient.addColorStop(0.55, rgba(streakRgb, alpha * p.popAlpha * 0.55))
      gradient.addColorStop(1, rgba(streakRgb, alpha * p.popAlpha))

      ctx.strokeStyle = gradient
      ctx.lineWidth = Math.max(0.7, size * 1.35)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
  }

  const drawFlashStreak = (s, alpha, speed) => {
    const speedFactor = clamp(speed / 340, 0.65, 1.45)
    const flicker =
      1 +
      Math.sin(state.time * s.flickerHz * TAU + s.flickerPhase) * 0.11 +
      noise.noise3D(s.seed * 0.013, state.time * 0.92, 6.4) * 0.08
    const finalAlpha = clamp(alpha * flicker, 0, 1)
    if (finalAlpha <= 0.008) return

    const emberRgb = sampleHeatColor(clamp(s.heat, 0, 1))
    const brightRgb = sampleHeatColor(clamp(s.heat + 0.1, 0, 1))
    const len = s.length * speedFactor
    const wid = s.width * mix(1.24, 0.74, s.age / s.life)
    const r = Math.min(wid * 0.35, 0.9)

    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(Math.atan2(s.vy, s.vx) + s.rotation * 0.12)

    ctx.shadowColor = rgba(emberRgb, finalAlpha * 0.95)
    ctx.shadowBlur = len * 0.3
    ctx.fillStyle = rgba(emberRgb, finalAlpha * 0.4)
    roundedRectPath(ctx, -len * 0.12, 0, len, wid * 1.45, r)
    ctx.fill()
    ctx.shadowBlur = 0

    const grad = ctx.createLinearGradient(-len * 0.5, 0, len * 0.45, 0)
    grad.addColorStop(0, rgba(emberRgb, 0))
    grad.addColorStop(0.18, rgba(emberRgb, finalAlpha * 0.26))
    grad.addColorStop(0.62, rgba(brightRgb, finalAlpha * 0.78))
    grad.addColorStop(1, rgba(brightRgb, finalAlpha))
    ctx.fillStyle = grad
    roundedRectPath(ctx, -len * 0.06, 0, len * 0.82, wid, r)
    ctx.fill()

    ctx.fillStyle = rgba(brightRgb, finalAlpha * 0.95)
    roundedRectPath(ctx, len * 0.18, 0, len * 0.26, Math.max(0.4, wid * 0.46), r * 0.7)
    ctx.fill()
    ctx.restore()
  }

  const step = (ts) => {
    state.raf = window.requestAnimationFrame(step)
    if (!state.running) {
      ctx.clearRect(0, 0, state.width, state.height)
      return
    }

    const dt = Math.min((ts - state.last) / 1000 || 0.016, 0.05)
    state.last = ts
    state.time = ts * 0.001

    updateWind(dt)
    updateBurst(dt)
    updateVortex(dt)

    const emitRate = 11.8 * state.intensity * 1.6
    emitAccumulator += emitRate * dt
    while (emitAccumulator >= 1) {
      emitAccumulator -= 1
      spawnParticle(false)
    }

    const streakRate = 0.32 * state.intensity
    streakAccumulator += streakRate * dt
    if (streakAccumulator >= 1) {
      streakAccumulator -= 1
      spawnStreak(false)
    }

    ctx.clearRect(0, 0, state.width, state.height)
    ctx.globalCompositeOperation = 'lighter'

    const topFadeStart = state.height * 0.26
    const topFadeEnd = state.height * 0.085
    const plumeCenter =
      state.width * SOURCE_X_BASE +
      noise.noise3D(state.time * 0.07, 12.2, 91.3) * state.width * 0.08 * FLAME_AREA_SCALE
    const midTargetX =
      state.width * TARGET_X_BASE +
      noise.noise3D(state.time * 0.05, 7.6, 24.9) * state.width * 0.05 * FLAME_AREA_SCALE

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i]
      if (!p.active) continue

      p.age += dt
      if (p.age >= p.life) {
        p.active = false
        activeCount -= 1
        continue
      }

      const lifeT = p.age / p.life
      const rise = clamp((p.startY - p.y) / (p.startY - topFadeEnd), 0, 1)
      const spread = mix(0.22, 1.2, rise)

      const fx = p.x * 0.0023
      const fy = p.y * 0.0021
      const ft = state.time * 0.18 + p.seed * 0.0017
      const e = 0.0012
      const ndy =
        (noise.noise3D(fx, fy + e, ft) - noise.noise3D(fx, fy - e, ft)) / (2 * e)
      const ndx =
        (noise.noise3D(fx + e, fy, ft) - noise.noise3D(fx - e, fy, ft)) / (2 * e)
      const curlX = ndy
      const curlY = -ndx

      const tongueProgress = smoothstep(0.04, 0.78, rise)
      const baseChannel = mix(plumeCenter, midTargetX, tongueProgress)
      const tongueSwayEnvelope = 1 - smoothstep(0.62, 0.96, rise)
      const tongueSway =
        Math.sin(state.time * p.tongueFreq + p.tonguePhase + rise * 4.2) *
        p.tongueAmp *
        tongueSwayEnvelope
      const channelCenter = baseChannel + tongueSway
      const centerPull = (channelCenter - p.x) * mix(0.18, 0.07, rise)
      const wander =
        Math.sin(state.time * (1 + p.layer * 0.4) + p.seed * 0.4) *
        (1.6 + spread * 4.3) *
        (0.4 + tongueSwayEnvelope)
      const rightBias = 11 + 9 * spread
      const upwardPulse =
        Math.sin(state.time * (2.1 + p.layer * 0.25) + p.tonguePhase) *
        24 *
        tongueSwayEnvelope
      let ax =
        centerPull +
        wind.value * (0.2 + spread * 0.37) +
        curlX * p.flow * spread +
        wander +
        rightBias
      let ay =
        -p.buoyancy * mix(1.45, 0.46, Math.pow(lifeT, 0.68)) +
        curlY * p.flow * 0.3 +
        upwardPulse

      if (vortex.active) {
        const dx = p.x - vortex.x
        const dy = p.y - vortex.y
        const dist = Math.hypot(dx, dy)
        if (dist < vortex.radius) {
          const inf = 1 - dist / vortex.radius
          const s = vortex.strength * inf * (1 - vortex.elapsed / vortex.duration)
          ax += (-dy / (dist || 1)) * s
          ay += (dx / (dist || 1)) * s
        }
      }

      p.vx += ax * dt
      p.vy += ay * dt
      p.vx *= p.drag
      p.vy *= p.drag * 0.996
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rotation += p.spin * dt

      if (p.x < -state.width * 0.24 || p.x > state.width * 1.35 || p.y < topFadeEnd - 20) {
        p.active = false
        activeCount -= 1
        continue
      }

      const brightRamp = smoothstep(0, p.rampIn, lifeT)
      const cool = Math.pow(1 - lifeT * 0.84, p.coolCurve)
      const topFade = topFadeForY(p.y, topFadeStart, topFadeEnd)
      const disperseFade = 1 - smoothstep(0.72, 0.985, rise)
      const flicker =
        1 +
        Math.sin(state.time * p.flickerHz * TAU + p.flickerPhase) * 0.08 +
        noise.noise3D(p.seed * 0.01, state.time * 0.8, 3.2) * 0.05
      const alpha = clamp(p.alpha * brightRamp * cool * topFade * disperseFade * flicker, 0, 1)
      const size = p.size * mix(1.05, 0.78, lifeT) * EMBER_SIZE_SCALE
      if (alpha <= 0.004 || size <= 0.12) continue

      const speed = Math.hypot(p.vx, p.vy)
      drawIrregularEmber(p, alpha, size, speed)
    }

    for (let i = 0; i < streaks.length; i += 1) {
      const s = streaks[i]
      if (!s.active) continue

      s.age += dt
      if (s.age >= s.life) {
        s.active = false
        activeStreakCount -= 1
        continue
      }

      const lifeT = s.age / s.life
      const rise = clamp((s.startY - s.y) / (s.startY - topFadeEnd), 0, 1)
      const fx = s.x * 0.0021
      const fy = s.y * 0.0018
      const ft = state.time * 0.2 + s.seed * 0.002
      const e = 0.0013
      const ndy = (noise.noise3D(fx, fy + e, ft) - noise.noise3D(fx, fy - e, ft)) / (2 * e)
      const ndx = (noise.noise3D(fx + e, fy, ft) - noise.noise3D(fx - e, fy, ft)) / (2 * e)
      const curlX = ndy
      const curlY = -ndx
      const windPush = wind.value * mix(0.26, 0.36, rise)
      const channelBias = 18 + 16 * rise

      let ax = windPush + channelBias + curlX * s.flow
      let ay = -s.riseBoost * mix(1.55, 0.7, lifeT) + curlY * s.flow * 0.22

      if (vortex.active) {
        const dx = s.x - vortex.x
        const dy = s.y - vortex.y
        const dist = Math.hypot(dx, dy)
        if (dist < vortex.radius) {
          const inf = 1 - dist / vortex.radius
          const swirl = vortex.strength * inf * 0.8
          ax += (-dy / (dist || 1)) * swirl
          ay += (dx / (dist || 1)) * swirl
        }
      }

      s.vx += ax * dt
      s.vy += ay * dt
      s.vx *= s.drag
      s.vy *= s.drag * 0.994
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.rotation += s.spin * dt

      if (s.x < -state.width * 0.18 || s.x > state.width * 1.18 || s.y < topFadeEnd - 16) {
        s.active = false
        activeStreakCount -= 1
        continue
      }

      const topFade = topFadeForY(s.y, topFadeStart, topFadeEnd)
      const riseFade = 1 - smoothstep(0.69, 0.985, rise)
      const flash = Math.pow(Math.sin(Math.PI * lifeT), 0.45)
      const alpha = clamp(s.alpha * flash * topFade * riseFade, 0, 1)
      const speed = Math.hypot(s.vx, s.vy)
      drawFlashStreak(s, alpha, speed)
    }

    ctx.globalCompositeOperation = 'source-over'
  }

  const onResize = () => resize()
  resize()
  window.addEventListener('resize', onResize)
  state.raf = window.requestAnimationFrame(step)

  return {
    start() {
      state.running = true
    },
    stop() {
      state.running = false
    },
    setIntensity(nextIntensity) {
      state.intensity = clamp(nextIntensity, 0.2, 2.8)
    },
    setWindStrength(nextWindStrength) {
      state.windStrength = clamp(nextWindStrength, 0, 2.5)
    },
    destroy() {
      window.removeEventListener('resize', onResize)
      if (state.raf) window.cancelAnimationFrame(state.raf)
      ctx.clearRect(0, 0, state.width, state.height)
    },
  }
}

const SparkParticles = forwardRef(function SparkParticles(
  { intensity = 1, windStrength = 1, autoStart = true },
  ref,
) {
  const canvasRef = useRef(null)
  const controllerRef = useRef(null)
  const initialOptionsRef = useRef({ intensity, windStrength, autoStart })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const controller = initEmberSystem(canvas, initialOptionsRef.current)
    controllerRef.current = controller
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    controllerRef.current?.setIntensity(intensity)
  }, [intensity])

  useEffect(() => {
    controllerRef.current?.setWindStrength(windStrength)
  }, [windStrength])

  useEffect(() => {
    if (!controllerRef.current) return
    if (autoStart) controllerRef.current.start()
    else controllerRef.current.stop()
  }, [autoStart])

  useImperativeHandle(
    ref,
    () => ({
      start() {
        controllerRef.current?.start()
      },
      stop() {
        controllerRef.current?.stop()
      },
      setIntensity(nextIntensity) {
        controllerRef.current?.setIntensity(nextIntensity)
      },
      setWindStrength(nextWindStrength) {
        controllerRef.current?.setWindStrength(nextWindStrength)
      },
    }),
    [],
  )

  return <canvas ref={canvasRef} className="spark-canvas" aria-hidden="true" />
})

export default SparkParticles

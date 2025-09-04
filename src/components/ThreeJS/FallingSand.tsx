'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useThree, useFrame, Canvas } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import {
  Fn,
  uniform,
  int,
  uint,
  ivec2,
  float,
  hash,
  storageTexture,
  screenUV,
  ivec3,
  instanceIndex,
  ivec4,
  textureStore,
  textureLoad,
  If,
  texture,
  bool,
  assign,
  vec2,
  compute,
  vec4,
  vec3,
  positionLocal,
  varying,
  step,
  screenCoordinate,
  screenSize,
  instancedArray,
  color,
  time,
  floor,
  mul,
  add,
  sub,
  length,
  smoothstep,
  abs,
  mix,
  clamp,
} from 'three/tsl'
import { OrthographicCamera, ScreenQuad, ScreenSizer, ScreenSpace, Stats } from '@react-three/drei'

function FallingSand({ pointerRef }: { pointerRef: React.RefObject<any> }) {
  const { size, gl, pointer } = useThree()
  const dpr = gl.getPixelRatio()
  const renderer = gl as unknown as THREE.WebGPURenderer
  const canvas = gl.domElement

  // === Settings ===
  const scale = 0.1
  const W = Math.round(size.width * dpr * scale)
  const H = Math.round(size.height * dpr * scale)

  const { uniforms, material, textures } = useMemo(() => {
    //* Set Uniforms
    const uniforms = {
      simSize: uniform(new THREE.Vector2(1, 1)),
      frame: uniform(uint(0)),
      pointerPos: uniform(new THREE.Vector2(0, 0)),
      brushActive: uniform(bool(false)),
      cellSize: uniform(new THREE.Vector2(W, H)),
      texel: uniform(new THREE.Vector2(1 / W, 1 / H)),
    }

    //* Create Ping Pong Textures
    const textures = {
      a: new THREE.StorageTexture(512, 512),
      b: new THREE.StorageTexture(512, 512),
    }

    //* Create Display Material
    const mat = new THREE.MeshBasicNodeMaterial({
      depthTest: false,
      depthWrite: false,
    })
    mat.toneMapped = false

    mat.vertexNode = Fn(() => {
      // return vec4(position in clip space)
      return vec4(positionLocal.xy, 0.0, 1.0)
    })()

    mat.fragmentNode = Fn(() => {
      // sim size in texels

      // screen in physical pixels
      const scr = screenSize // vec2
      const frag = screenCoordinate
      const uv = screenUV

      // const d = length(sub(frag, uniforms.pointerPos)) // float distance in px

      const ix = int(uv.x.mul(uniforms.simSize.x)).clamp(0, int(uniforms.simSize.x).sub(1))
      const iy = int(uv.y.mul(uniforms.simSize.y)).clamp(0, int(uniforms.simSize.y).sub(1))

      const cellIndex = floor(uv.mul(uniforms.cellSize)) // ivec2 (cell coords)
      const cellCenterUV = cellIndex.add(0.5)

      const pointerCell = uniforms.pointerPos.mul(uniforms.cellSize)

      // const r = textureLoad(textures.a, ivec2(ix, iy)).x // 0..1

      // READ FROM STORAGE (display must be storageTexture)
      // const r = textureLoad(display.value, ivec2(ixC, iyC)).x // 0..1

      // simple color
      const air = vec3(0.0)
      const sand = vec3(194 / 255, 178 / 255, 128 / 255)
      // const base = air.mix(sand, r.clamp(0.0, 1.0))

      // const ring = smoothstep(1.0, 0.0, abs(d.sub(uniforms.cellSize.mul(1.2))).div(uniforms.cellSize.mul(0.25)))
      const base = vec3(0, 0, 0.01) // dark background
      const hi = vec3(0.3, 0.2, 0)

      const d = length(cellCenterUV.sub(pointerCell)) // distance in "cells"

      // return length(frag.sub(uniforms.pointerPos)).mul(0.001)
      return d.mul(0.01).pow(2)
    })()

    return {
      uniforms,
      material: mat,
      textures,
    }
  }, [])

  const uBrushPos = useRef(uniform(new THREE.Vector2(-9999, -9999))).current
  const uBrushRadius = useRef(uniform(6)).current // pixels in grid space
  const uBrushActive = useRef(uniform(0)).current // 0 or 1 (int)

  // === Kernels (we keep them in refs; rebuild on size change) ===
  const seed = Fn(() => {
    const w = int(uniforms.simSize.x)
    const id = int(instanceIndex)
    const x = id.mod(w)
    const y = id.div(w)
    const isSand = y.lessThan(int(10))
    const val = isSand.select(float(1), float(0))
    textureStore(textures.a, ivec2(x, y), vec4(val, 0, 0, 1))
  })().compute(W * H)

  const paint = Fn(() => {
    const w = int(uniforms.simSize.x)
    const id = int(instanceIndex)
    const x = id.mod(w)
    const y = id.div(w)

    const bx = int(uBrushPos.x)
    const by = int(uBrushPos.y)
    const r = int(uBrushRadius)
    const active = int(uBrushActive)

    const dx = x.sub(bx)
    const dy = y.sub(by)
    const inside = dx.mul(dx).add(dy.mul(dy)).lessThanEqual(r.mul(r)).and(active.greaterThan(0))

    // Write directly into the *source* so the next update reads it
    If(inside, () => {
      textureStore(textures.a, ivec2(x, y), vec4(1.0, 0.0, 0.0, 1.0)) // R=1 => sand
    })
  })().compute(W * H)

  // const updateCells = Fn(() => {
  //   const w = int(uniforms.simSize.x)
  //   const h = int(uniforms.simSize.y)
  //   const id = int(instanceIndex)
  //   const x = id.mod(w)
  //   const y = id.div(w)

  //   const xy = ivec2(x, y)

  //   const u = y.sub(1).max(0)
  //   const d = y.add(1).min(h.sub(1))
  //   const l = x.sub(1).max(0)
  //   const r = x.add(1).min(w.sub(1))

  //   const donorBit = (ix: any, iy: any) => ix.add(iy).add(int(uniforms.frame)).and(1).equal(0)

  //   const here = textureLoad(textures.a, xy).x
  //   // const down = textureLoad(src.value, ivec2(x, d)).x
  //   // const left = textureLoad(src.value, ivec2(l, y)).x
  //   // const right = textureLoad(src.value, ivec2(r, y)).x
  //   // const downLeft = textureLoad(src.value, ivec2(l, d)).x
  //   // const downRight = textureLoad(src.value, ivec2(r, d)).x

  //   const EMPTY = float(0)
  //   const SAND = float(1)

  //   const next = float(0).toVar()

  //   //! Cell is empty -> check if any cells will fall here
  //   If(here.equal(EMPTY), () => {
  //     const up = textureLoad(src.value, ivec2(x, u)).x // check above cell value

  //     //If up is sand and we're empty, assign next = sand
  //     If(up.equal(SAND), () => {
  //       next.assign(SAND)
  //     }).Else(() => {
  //       //Else if up not equal sand, check if upper diagonals are sand
  //       const upLeft = textureLoad(src.value, ivec2(l, u)).x // above-left
  //       const upRight = textureLoad(src.value, ivec2(r, u)).x // above-right

  //       //Check if top left can't fall down and wants to fall here
  //       const fillLeft = bool(false).toVar()
  //       If(upLeft.equal(SAND), () => {
  //         const downLeft = textureLoad(src.value, ivec2(l, d)).x
  //         fillLeft.assign(downLeft.notEqual(EMPTY))
  //       })

  //       //Check if top right can't fall down and wants to fall here
  //       const fillRight = bool(false).toVar()
  //       If(upRight.equal(SAND), () => {
  //         const downRight = textureLoad(src.value, ivec2(r, d)).x
  //         fillRight.assign(downRight.notEqual(EMPTY))
  //       })

  //       //If both upper diagonals want to fall here, deterministically pick one.
  //       const prefRight = donorBit(l, u)
  //       const prefLeft = donorBit(r, u).not()

  //       const takeL = fillLeft.and(fillRight.not().or(prefRight))
  //       const takeR = fillRight.and(fillLeft.not().or(prefLeft))

  //       If(takeL.or(takeR), () => next.assign(SAND))
  //     })
  //   })

  //   //! Cell contains sand -> Check if it can fall anywhere
  //   If(next.equal(EMPTY).and(here.equal(SAND)), () => {
  //     //Check below cell
  //     const fallDown = textureLoad(src.value, ivec2(x, d)).x.equal(EMPTY)

  //     //If below cell full, check bottom diagonal cells
  //     If(fallDown.not(), () => {
  //       const fallLeft = textureLoad(src.value, ivec2(l, d)).x.equal(EMPTY)
  //       const fallRight = textureLoad(src.value, ivec2(r, d)).x.equal(EMPTY)

  //       //If bottom diagonal cells also fall, cell stays sand
  //       If(fallLeft.not().and(fallRight.not()), () => {
  //         next.assign(SAND)
  //       })
  //     })
  //   })

  //   textureStore(dst.value, xy, vec4(next, 0, 0, 1))

  //   // const val = float(x).div(float(w))
  //   // textureStore(dst.value, ivec2(x, y), vec4(val, 0.0, 0.0, 1.0))
  // })().compute(W * H)

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      // canvas CSS size
      const rect = canvas.getBoundingClientRect()
      const wCss = rect.width
      const hCss = rect.height
      const dpr = gl.getPixelRatio()

      // sim = % of drawing buffer (scale ∈ (0,1])
      const wSim = Math.max(1, Math.round(wCss * dpr * scale))
      const hSim = Math.max(1, Math.round(hCss * dpr * scale))

      uniforms.cellSize.value.set(wSim, hSim)
      // if you ping-pong RTs, recreate them here at wSim×hSim
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [canvas, gl])

  //* Initialise Simulation on start
  useEffect(() => {
    if (!('computeAsync' in renderer)) return

    // choose size — fixed W/H or use getSimSize(renderer, size, simScale)
    const { W: w0, H: h0 } = { W, H }
    // const { W: w0, H: h0 } = getSimSize(renderer, size, simScale)

    // allocate textures
    textures.a = makeStorageTex(w0, h0)
    textures.b = makeStorageTex(w0, h0)

    // point nodes & uniforms
    uniforms.simSize.value.set(w0, h0)

    console.log('Init')

    // build kernels for this size and seed once
  }, [renderer])

  const flip = useRef(false)
  useFrame(({ gl }) => {
    // if (!(gl as any).device) return
    if (!('computeAsync' in renderer)) return
    uniforms.frame.value++
    // ping-pong pointers for this step
    // const readTex = flip.current ? texA : texB
    // const writeTex = flip.current ? texB : texA
    flip.current = !flip

    // src.value = readTex
    // dst.value = writeTex
    // run compute for this frame
    // renderer.computeAsync(updateRef.current)

    // show what we just wrote
    // display.value = writeTex

    // console.log(uniforms.brushActive.value)
    // uniforms.pointerPos.value = pointer
    uniforms.pointerPos.value.set((pointer.x + 1) * 0.5, 1 - (pointer.y + 1) * 0.5)
    if (!pointerRef.current.down) return
    console.log(uniforms.pointerPos.value)
  })

  return <ScreenQuad material={material} />
}

function makeStorageTex(W: number, H: number) {
  const t = new THREE.StorageTexture(W, H)
  t.format = THREE.RGBAFormat
  t.type = THREE.UnsignedByteType
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}

export default function SandCanvas() {
  const pointerRef = useRef({
    down: false,
    posPx: new THREE.Vector2(),
    shift: false,
    alt: false,
    ctrl: false,
  })

  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator

  return (
    <>
      <Stats />
      <Canvas
        gl={
          hasWebGPU
            ? async (props) => {
                const r = new THREE.WebGPURenderer({ ...(props as any), antialias: false })
                await r.init()
                return r
              }
            : undefined
        }
        dpr={[1, 2]}
        onPointerDown={(e) => {
          pointerRef.current.down = true
        }}
        onPointerUp={() => {
          pointerRef.current.down = false
        }}
        onPointerLeave={(e) => {
          pointerRef.current.down = false
        }}
      >
        <FallingSand pointerRef={pointerRef} />
      </Canvas>
    </>
  )
}

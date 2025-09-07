'use client'

import React, { act, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useThree, useFrame, Canvas, Vector2 } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { Leva, useControls } from 'leva'
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
  div,
  deltaTime,
  uniformTexture,
  NodeAccess,
} from 'three/tsl'
import { Html, ScreenQuad, ScreenSizer, ScreenSpace, Stats } from '@react-three/drei'

function FallingSand({ pointerRef }: { pointerRef: React.RefObject<any> }) {
  const { size, gl, pointer } = useThree()
  const renderer = gl as unknown as THREE.WebGPURenderer
  const canvas = renderer.domElement

  const canvasSize = useRef({ x: canvas.getBoundingClientRect().x, y: canvas.getBoundingClientRect().y })

  //* Create Texture Objects
  const tex = useMemo(
    () => ({
      a: new THREE.StorageTexture(1, 1),
      b: new THREE.StorageTexture(1, 1),
    }),
    [],
  )

  const src = storageTexture(tex.a).toReadWrite()
  const dst = storageTexture(tex.b)
  //! === Settings ===
  //* Build Gui Controls
  const options = useMemo(() => {
    return {
      play: false,
      tickRate: { value: 10, min: 1, max: 500, step: 1 },
      colour: {
        value: 'white',
        onChange: (v: string) => {
          // zero-alloc update
          uniforms.displayColour.value.set(v)
        },
      },
      brushSize: {
        value: 10,
        min: 1,
        max: 64,
        step: 1,
        onChange: (v: any) => {
          uniforms.brushSize.value = v
        },
      },
    }
  }, [])
  const controls = useControls('Life', options)

  const cellSizePx = 5

  const tickInterval = 1 / controls.tickRate
  const tick = useRef(0)

  //* Set Uniforms
  const uniforms = useMemo(
    () => ({
      simSize: uniform(ivec2(1, 1)),
      cellSize: uniform(float(cellSizePx)),
      display: uniformTexture(tex.a),
      displayColour: uniform(color('white')),
      brushSize: uniform(1),
      frame: uniform(uint(0)),
      pointerPos: uniform(vec2(0, 0)),
      pointerDown: uniform(bool(false)),
    }),
    [],
  )

  //* Create Material
  const material = useMemo(() => {
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
      const cellIndex = floor(screenUV.mul(uniforms.simSize)) // ivec2 (cell coords)
      const cellCenterUV = cellIndex.add(0.5)

      const pointerCell = uniforms.pointerPos.mul(uniforms.simSize)

      const d = length(cellCenterUV.sub(pointerCell)) // distance in "cells"

      const screen = uniforms.display

      const col = screen.sample(screenUV)

      const shaded = col.r.greaterThan(0.5).select(uniforms.displayColour, vec3(0, 0, 0))

      // return length(frag.sub(uniforms.pointerPos)).mul(0.001)
      // return d.mul(0.01).pow(2)
      return shaded
    })()

    return mat
  }, [])

  const life = useMemo(
    () =>
      Fn(({ src, dst }: { src: THREE.StorageTexture; dst: THREE.StorageTexture }) => {
        const readCell = (ix: any, iy: any) => {
          const w = int(uniforms.simSize.x),
            h = int(uniforms.simSize.y)
          const x = clamp(ix, 0, w.sub(1)),
            y = clamp(iy, 0, h.sub(1))
          return textureLoad(src, ivec2(x, y)).r.greaterThan(0.5).select(int(1), int(0))
        }

        //* Cell Coordinates
        const w = int(uniforms.simSize.x)
        const id = int(instanceIndex)
        const x = id.mod(w)
        const y = id.div(w)

        const alive = textureLoad(src, ivec2(x, y)).r.greaterThan(0.5)

        //* Neighbour Count
        const n = readCell(x.sub(1), y.sub(1))
          .add(readCell(x, y.sub(1)))
          .add(readCell(x.add(1), y.sub(1)))
          .add(readCell(x.sub(1), y))
          .add(readCell(x.add(1), y))
          .add(readCell(x.sub(1), y.add(1)))
          .add(readCell(x, y.add(1)))
          .add(readCell(x.add(1), y.add(1)))

        const stay = n.equal(2).or(n.equal(3))
        const born = n.equal(3)
        const live = alive.and(stay).or(alive.not().and(born))
        const col = live.select(1, 0)

        textureStore(dst, ivec2(x, y), vec4(col, 0.0, 0.0, 1.0))
      }),
    [],
  )

  const paintLife = useMemo(
    () =>
      Fn(({ src }: { src: THREE.StorageTexture }) => {
        //* Cell Coordinates
        const w = int(uniforms.simSize.x)
        const id = int(instanceIndex)
        const cellIndex = ivec2(id.mod(w), id.div(w))

        //* Centred Cell Position
        const cellPos = cellIndex.add(0.5).mul(uniforms.cellSize)

        //* Pointer position in cells
        const pointerCell = clamp(
          ivec2(floor(uniforms.pointerPos.div(uniforms.cellSize))),
          ivec2(0),
          uniforms.simSize.sub(ivec2(1)), // <-- (1,1), not (1,0)
        )

        //* Cell distance to pointer in pixels
        const distPx = length(uniforms.pointerPos.sub(cellPos))

        //* Cell distance to pointer in cells
        const distCell = length(pointerCell.sub(cellIndex))

        //* Radius
        const r = float(30)

        const draw = distPx.lessThan(uniforms.brushSize)

        const hit = cellIndex.equal(pointerCell)

        If(draw, () => {
          textureStore(src, cellIndex, vec4(1.0, 0.0, 0.0, 1.0))
          // rw.load(cellIndex)
        })
      }),
    [],
  )

  //* Build Kernels
  const buildKernels = useCallback((W: number, H: number) => {
    const cells = W * H

    const lifeAB = life({ src: tex.a, dst: tex.b }).compute(cells)
    const lifeBA = life({ src: tex.b, dst: tex.a }).compute(cells)

    const paintA = paintLife({ src: tex.a }).compute(cells)
    const paintB = paintLife({ src: tex.b }).compute(cells)

    const cellUpdate = Fn(() => {
      const w = int(uniforms.simSize.x)
      const h = int(uniforms.simSize.y)
      const x = instanceIndex.mod(w)
      const y = instanceIndex.div(w)

      const xy = ivec2(x, y)

      const u = y.sub(1).max(0)
      const d = y.add(1).min(h.sub(1))
      const l = x.sub(1).max(0)
      const r = x.add(1).min(w.sub(1))

      const donorBit = (ix: any, iy: any) => ix.add(iy).add(int(uniforms.frame)).and(1).equal(0)

      const here = textureLoad(tex.a, xy).x
      // const down = textureLoad(src.value, ivec2(x, d)).x
      // const left = textureLoad(src.value, ivec2(l, y)).x
      // const right = textureLoad(src.value, ivec2(r, y)).x
      // const downLeft = textureLoad(src.value, ivec2(l, d)).x
      // const downRight = textureLoad(src.value, ivec2(r, d)).x

      const EMPTY = float(0)
      const SAND = float(1)

      const next = float(0).toVar()

      //! Cell is empty -> check if any cells will fall here
      If(here.equal(EMPTY), () => {
        const up = textureLoad(tex.a, ivec2(x, u)).x // check above cell value

        //If up is sand and we're empty, assign next = sand
        If(up.equal(SAND), () => {
          next.assign(SAND)
        }).Else(() => {
          //Else if up not equal sand, check if upper diagonals are sand
          const upLeft = textureLoad(tex.a, ivec2(l, u)).x // above-left
          const upRight = textureLoad(tex.a, ivec2(r, u)).x // above-right

          //Check if top left can't fall down and wants to fall here
          const fillLeft = bool(false).toVar()
          If(upLeft.equal(SAND), () => {
            const downLeft = textureLoad(tex.a, ivec2(l, d)).x
            fillLeft.assign(downLeft.notEqual(EMPTY))
          })

          //Check if top right can't fall down and wants to fall here
          const fillRight = bool(false).toVar()
          If(upRight.equal(SAND), () => {
            const downRight = textureLoad(tex.a, ivec2(r, d)).x
            fillRight.assign(downRight.notEqual(EMPTY))
          })

          //If both upper diagonals want to fall here, deterministically pick one.
          const prefRight = donorBit(l, u)
          const prefLeft = donorBit(r, u).not()

          const takeL = fillLeft.and(fillRight.not().or(prefRight))
          const takeR = fillRight.and(fillLeft.not().or(prefLeft))

          If(takeL.or(takeR), () => next.assign(SAND))
        })
      })

      //! Cell contains sand -> Check if it can fall anywhere
      If(next.equal(EMPTY).and(here.equal(SAND)), () => {
        //Check below cell
        const fallDown = textureLoad(tex.a, ivec2(x, d)).x.equal(EMPTY)

        //If below cell full, check bottom diagonal cells
        If(fallDown.not(), () => {
          const fallLeft = textureLoad(tex.a, ivec2(l, d)).x.equal(EMPTY)
          const fallRight = textureLoad(tex.a, ivec2(r, d)).x.equal(EMPTY)

          //If bottom diagonal cells also fall, cell stays sand
          If(fallLeft.not().and(fallRight.not()), () => {
            next.assign(SAND)
          })
        })
      })

      textureStore(tex.b, xy, vec4(next, 0, 0, 1))

      // const val = float(x).div(float(w))
      // textureStore(dst.value, ivec2(x, y), vec4(val, 0.0, 0.0, 1.0))
    })().compute(cells)

    //Return Kernels
    return { paintA, paintB, cellUpdate, lifeAB, lifeBA }
  }, [])

  const kernels = useRef<ReturnType<typeof buildKernels> | null>(null)

  //* Update Canvas Size
  // useEffect(() => {
  //   const canvas = renderer.domElement
  //   const context = renderer.getContext() as any
  //   const gpuDevice: GPUDevice | undefined = context.device
  //   const maxTex = gpuDevice?.limits?.maxTextureDimension2D ?? 8192
  //   const observer = new ResizeObserver((entries) => {
  //     const entry = entries[0]
  //     const dp = entry.devicePixelContentBoxSize?.[0]
  //     const cb = entry.contentBoxSize?.[0]

  //     let w = dp?.inlineSize || cb.inlineSize * devicePixelRatio
  //     let h = dp?.blockSize || cb.blockSize * devicePixelRatio

  //     w = Math.min(Math.floor(w * scale), maxTex)
  //     h = Math.min(Math.floor(h * scale), maxTex)

  //     uniforms.simSize.value.set(w, h)

  //     tex.a = makeStorageTex(w, h)
  //     tex.b = makeStorageTex(w, h)

  //     kernels.current = buildKernels(w, h)
  //   })

  //   try {
  //     observer.observe(canvas, { box: 'device-pixel-content-box' })
  //   } catch {
  //     observer.observe(canvas, { box: 'content-box' })
  //   }
  //   return () => observer.disconnect()
  // }, [canvas, gl, renderer])

  //* Initialise Simulation on start
  useEffect(() => {
    if (!('computeAsync' in renderer)) return

    // console.log(navigator.gpu?.wgslLanguageFeatures?.has('readonly_and_readwrite_storage_textures'))

    const canvas = renderer.domElement
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    const dpr = devicePixelRatio || 1
    const canvasW = Math.max(1, Math.floor(cssW * dpr))
    const canvasH = Math.max(1, Math.floor(cssH * dpr))

    //* Set Canvas Size (pixels)
    canvasSize.current = { x: canvasW, y: canvasH }

    //* Set Sim Size (cells)
    const simW = Math.max(1, Math.floor(canvasW / cellSizePx))
    const simH = Math.max(1, Math.floor(canvasH / cellSizePx))
    uniforms.simSize.value.set(simW, simH)

    //* Set Cell Size
    uniforms.cellSize.value = cellSizePx

    //* Create Textures
    tex.a = makeStorageTex(simW, simH)
    tex.b = makeStorageTex(simW, simH)

    uniforms.display.value = tex.a
    // material.map = tex.a

    //* Build Compute Shader Kernels
    kernels.current = buildKernels(simW, simH)

    console.log('Init')
    // if (kernels.current) renderer.compute(kernels.current!.seed)

    // build kernels for this size and seed once
  }, [renderer, gl])

  const phase = useRef(false)

  useFrame((state, delta) => {
    if (!('computeAsync' in renderer) || !kernels.current) return

    //? If pointer clicked
    if (pointerRef.current.down) {
      //* Transform Pointer Coordinates (flips y)
      const pointerPos = {
        x: (pointer.x + 1) * 0.5 * canvasSize.current.x,
        y: (-pointer.y + 1) * 0.5 * canvasSize.current.y,
      }

      //* Update Pointer Uniform, Dispatch paint compute
      uniforms.pointerPos.value.set(pointerPos.x, pointerPos.y)
      // renderer.computeAsync(kernels.current.paint)
      renderer.computeAsync(phase.current ? kernels.current.paintB : kernels.current.paintA)
    }

    if (!controls.play) return

    tick.current += delta
    if (tick.current >= tickInterval) {
      renderer.computeAsync(phase.current ? kernels.current.lifeBA : kernels.current.lifeAB)

      uniforms.display.value = phase.current ? tex.a : tex.b

      phase.current = !phase.current

      tick.current -= tickInterval
    }
  })

  return (
    <>
      <ScreenQuad material={material} />
    </>
  )
}

function makeStorageTex(W: number, H: number) {
  const t = new THREE.StorageTexture(W, H)
  t.format = THREE.RGBAFormat
  t.type = THREE.UnsignedByteType
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  // t.generateMipmaps = false
  // t.needsUpdate = true
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
      <div className="fixed top-20 right-5 z-100">
        <Leva fill hideCopyButton />
      </div>
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

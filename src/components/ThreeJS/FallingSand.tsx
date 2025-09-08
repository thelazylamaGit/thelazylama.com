'use client'

import React, { act, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useThree, useFrame, Canvas, Vector2, dispose } from '@react-three/fiber'
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
import { read } from 'fs'

function FallingSand({ pointerRef }: { pointerRef: React.RefObject<any> }) {
  const { size, gl, pointer, clock } = useThree()
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

  function updateOrigin() {
    const W = canvas.width // render target width in device px
    const H = canvas.height // render target height in device px
    const simW = uniforms.simSize.value.x
    const simH = uniforms.simSize.value.y

    const ox = Math.floor((W - simW) / 2)
    const oy = Math.floor((H - simH) / 2)

    uniforms.originPx.value.set(ox, oy)
  }

  const src = storageTexture(tex.a).toReadWrite()
  const dst = storageTexture(tex.b)
  //! === Settings ===
  //* Build Gui Controls
  const options = useMemo(() => {
    return {
      play: true,
      cellSize: { value: 8, min: 1, max: 64, step: 1, onEditEnd: (v: number) => setCellSize(v) },
      tickRate: { value: 10, min: 1, max: 200, step: 1 },
      colour: {
        value: 'white',
        onChange: (v: string) => {
          // zero-alloc update
          uniforms.displayColour.value.set(v)
        },
      },
      probability: {
        value: 0.25,
        min: 0,
        max: 1,
        step: 0.05,
        onChange: (v: any) => {
          uniforms.probability.value = 1 - Math.pow(1 - v, 1 / 4)
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

  const tickInterval = 1 / controls.tickRate
  const tick = useRef(0)

  const phase = useRef(false)
  const [cellSize, setCellSize] = useState(controls.cellSize)

  //* Set Uniforms
  const uniforms = useMemo(
    () => ({
      simSize: uniform(ivec2(1, 1)),
      cellSize: uniform(float(controls.cellSize)),
      display: uniformTexture(tex.a),
      displayColour: uniform(color('white')),
      brushSize: uniform(1),
      originPx: uniform(vec2(0, 0)),
      frame: uniform(uint(0)),
      probability: uniform(float(0.25)),
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
      // const col = uniforms.display.sample(screenUV)
      const col = uniforms.display.sample(screenUV)

      const shaded = col.r.greaterThan(0.5).select(uniforms.displayColour, vec3(0, 0, 0))

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

  const sandOld = useMemo(
    () =>
      Fn(({ src, dst }: { src: THREE.StorageTexture; dst: THREE.StorageTexture }) => {
        const readCell = (ix: any, iy: any) => {
          const x = clamp(ix, 0, w.sub(1))
          const y = clamp(iy, 0, h.sub(1))
          return textureLoad(src, ivec2(x, y)).x.greaterThan(0.5).select(int(1), int(0))
        }

        //Cell Index
        const w = int(uniforms.simSize.x)
        const h = int(uniforms.simSize.y)
        const id = int(instanceIndex)
        const x = id.mod(w)
        const y = id.div(w)

        const atBottom = y.equal(h.sub(1))

        //Directions
        const u = y.sub(1)
        const d = y.add(1)
        const l = x.sub(1)
        const r = x.add(1)

        //Deterministic Random
        const donorBit = (ix: any, iy: any) => ix.add(iy).add(int(uniforms.frame)).and(1).equal(0)

        //Cell Value
        const here = readCell(x, y)

        //Material ID
        const EMPTY = int(0)
        const SAND = int(1)

        //Future Value
        const next = int(0)

        //! Reciever Phase
        //? Cell is empty -> check if any cells will fall here
        If(here.equal(EMPTY), () => {
          const up = readCell(x, u)

          //? If up is sand and we're empty, become sand
          If(up.equal(SAND), () => {
            next.assign(SAND)
          }).Else(() => {
            //? Else if up isn't sand check its neighbours
            const upLeft = readCell(l, u)
            const upRight = readCell(r, u)

            //? If top left is sand and left is blocked, it'll might fall here
            const fillLeft = bool(false)
            If(upLeft.equal(SAND), () => {
              const left = readCell(l, y)
              fillLeft.assign(left.notEqual(EMPTY))
            })

            //? If top right is sand and right is blocked, it'll might fall here
            const fillRight = bool(false)
            If(upRight.equal(SAND), () => {
              const right = readCell(r, y)
              fillRight.assign(right.notEqual(EMPTY))
            })

            //? If both top neighbours want to fall here, deterministically pick one
            const prefRight = donorBit(l, u)
            const prefLeft = donorBit(r, u).not()

            const takeL = fillLeft.and(fillRight.not().or(prefRight))
            const takeR = fillRight.and(fillLeft.not().or(prefLeft))

            If(takeL.or(takeR), () => next.assign(SAND))
          })
        })

        //? If cell contains sand, check if it can fall anywhere
        If(next.equal(EMPTY).and(here.equal(SAND)), () => {
          //? Check if we can fall straight down

          If(atBottom, () => {
            next.assign(SAND)
          }).Else(() => {
            const fallDown = readCell(x, d).equal(EMPTY)

            //? If we can fall down cell becomes empty
            If(fallDown, () => {}).Else(() => {
              //? Otherwise check bottom diagonals
              const fallLeft = readCell(l, d).equal(EMPTY)
              const fallRight = readCell(r, d).equal(EMPTY)

              //? If bottom diagonals are full we stay sand
              If(fallLeft.not().and(fallRight.not()), () => {
                next.assign(SAND)
              })
            })
          })
        })
        textureStore(dst, ivec2(x, y), vec4(next, 0, 0, 1))
      }),
    [],
  )

  const sand = useMemo(
    () =>
      Fn(({ src, dst }: { src: THREE.StorageTexture; dst: THREE.StorageTexture }) => {
        const readCell = (ix: any, iy: any) => textureLoad(src, ivec2(ix, iy)).x.greaterThan(0.5).select(int(1), int(0))

        // hash→[0,1) for stochastic rules (no big helpers)
        const rand = (ix: any, iy: any, t: any) => {
          const z = ix
            .mul(int(1664525))
            .bitXor(iy.mul(int(1013904223)))
            .bitXor(t.mul(int(69069)))
          return z.bitAnd(int(0x7fffffff)).toFloat().div(float(2147483647))
        }

        //Cell Index
        const w = int(uniforms.simSize.x)
        const h = int(uniforms.simSize.y)

        const evenW = w.add(int(1)).bitAnd(int(-2)) // (W+1)&~1
        const evenH = h.add(int(1)).bitAnd(int(-2)) // (H+1)&~1

        const bw = evenW.div(2)
        const bh = evenH.div(2)

        const bid = int(instanceIndex)
        const bx = bid.mod(bw)
        const by = bid.div(bw)

        const phase = int(uniforms.frame).bitAnd(int(3)) // 0..3
        const dx = phase.bitAnd(int(1)) // 0,1,0,1
        const dy = phase.shiftRight(int(1)).bitXor(dx) // 0,1,1,0

        // --- this block's coords
        const x0 = bx.mul(int(2)).add(dx)
        const y0 = by.mul(int(2)).add(dy)
        const x1 = x0.add(1)
        const y1 = y0.add(1)

        const mA = x0.lessThan(w).and(y0.lessThan(h))
        const mB = x1.lessThan(w).and(y0.lessThan(h))
        const mC = x0.lessThan(w).and(y1.lessThan(h))
        const mD = x1.lessThan(w).and(y1.lessThan(h))

        // const A = readCell(x0, y0)
        // const B = readCell(x1, y0)
        // const C = readCell(x0, y1)
        // const D = readCell(x1, y1)

        // const A = readCell(x0, y0.lessThanEqual(h).select(int(1), int(0)))
        // const B = readCell(x1, y0.lessThanEqual(h).select(int(1), int(0)))
        // const C = readCell(x0, y1.lessThanEqual(h).select(int(1), int(0)))
        // const D = readCell(x1, y1.lessThanEqual(h).select(int(1), int(0)))

        const A = mA.select(readCell(x0, y0), y0.greaterThanEqual(h).select(int(1), int(0)))
        const B = mB.select(readCell(x1, y0), y0.greaterThanEqual(h).select(int(1), int(0)))
        const C = mC.select(readCell(x0, y1), y1.greaterThanEqual(h).select(int(1), int(0)))
        const D = mD.select(readCell(x1, y1), y1.greaterThanEqual(h).select(int(1), int(0)))

        const A2 = A.toVar()
        const B2 = B.toVar()
        const C2 = C.toVar()
        const D2 = D.toVar()

        // 1) Straight down where possible
        If(A.equal(int(1)).and(C.equal(int(0))), () => {
          A2.assign(int(0))
          C2.assign(int(1))
        })
        If(B.equal(int(1)).and(D.equal(int(0))), () => {
          B2.assign(int(0))
          D2.assign(int(1))
        })

        // 2) If still blocked straight down, try diagonal inside the block
        If(
          A2.equal(int(1))
            .and(C2.equal(int(1)))
            .and(D2.equal(int(0))),
          () => {
            A2.assign(int(0))
            D2.assign(int(1))
          },
        )
        If(
          B2.equal(int(1))
            .and(D2.equal(int(1)))
            .and(C2.equal(int(0))),
          () => {
            B2.assign(int(0))
            C2.assign(int(1))
          },
        )

        const p = float(uniforms.probability)

        // left column full, right empty: [A=1;C=1] & [B=0;D=0]
        const leftFull_rightEmpty = A2.equal(int(1))
          .and(C2.equal(int(1)))
          .and(B2.equal(int(0)))
          .and(D2.equal(int(0)))

        If(leftFull_rightEmpty, () => {
          // choose topple direction (alternate a bit with coords+phase)
          const r = rand(x0.add(y0), x1.add(y1), phase)
          If(r.lessThan(p), () => {
            // topple to the right column: A2,C2 → 0; B2,D2 → 1
            A2.assign(int(0))
            C2.assign(int(0))
            B2.assign(int(1))
            D2.assign(int(1))
          })
        })

        // right column full, left empty
        const rightFull_leftEmpty = B2.equal(int(1))
          .and(D2.equal(int(1)))
          .and(A2.equal(int(0)))
          .and(C2.equal(int(0)))

        If(rightFull_leftEmpty, () => {
          const r = rand(x0.add(y0).add(int(17)), x1.add(y1).add(int(53)), phase)
          If(r.lessThan(p), () => {
            // topple to the left column
            B2.assign(int(0))
            D2.assign(int(0))
            A2.assign(int(1))
            C2.assign(int(1))
          })
        })

        A2.assign(mA.select(A2, y0.greaterThanEqual(h).select(int(1), int(0))))
        B2.assign(mB.select(B2, y0.greaterThanEqual(h).select(int(1), int(0))))
        C2.assign(mC.select(C2, y1.greaterThanEqual(h).select(int(1), int(0))))
        D2.assign(mD.select(D2, y1.greaterThanEqual(h).select(int(1), int(0))))

        textureStore(dst, ivec2(x0, y0), vec4(A2.toFloat(), 0, 0, 1))
        textureStore(dst, ivec2(x1, y0), vec4(B2.toFloat(), 0, 0, 1))
        textureStore(dst, ivec2(x0, y1), vec4(C2.toFloat(), 0, 0, 1))
        textureStore(dst, ivec2(x1, y1), vec4(D2.toFloat(), 0, 0, 1))
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

    const W2 = (W + 1) & ~1
    const H2 = (H + 1) & ~1
    const blocks = (W2 / 2) * (H2 / 2)

    const paintA = paintLife({ src: tex.a }).compute(cells)
    const paintB = paintLife({ src: tex.b }).compute(cells)

    const lifeAB = life({ src: tex.a, dst: tex.b }).compute(cells)
    const lifeBA = life({ src: tex.b, dst: tex.a }).compute(cells)

    // const sandAB = sand({ src: tex.a, dst: tex.b }).compute(cells)
    // const sandBA = sand({ src: tex.b, dst: tex.a }).compute(cells)

    const sandAB = sand({ src: tex.a, dst: tex.b }).compute(blocks)
    const sandBA = sand({ src: tex.b, dst: tex.a }).compute(blocks)

    //Return Kernels
    return { paintA, paintB, lifeAB, lifeBA, sandAB, sandBA }
  }, [])

  const kernels = useRef<ReturnType<typeof buildKernels> | null>(null)

  //* Update Canvas Size
  // useEffect(() => {
  //   const observer = new ResizeObserver(() => {
  //     updateOrigin()
  //   })

  //   observer.observe(canvas) // canvas is renderer.domElement
  //   return () => observer.disconnect()
  // }, [canvas])

  //* User Input
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
    }

    const onPointerDown = (e: PointerEvent) => {
      // capture so we keep events even if the pointer leaves
      ;(e.target as Element).setPointerCapture?.(e.pointerId)

      if (e.button === 0) {
        uniforms.pointerDown.value = true
      }
    }

    const onPointerMove = (e: PointerEvent) => {}

    const onPointerUpOrLeave = (e: PointerEvent) => {
      if (e.button === 0) {
        uniforms.pointerDown.value = false
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUpOrLeave)
    canvas.addEventListener('pointerleave', onPointerUpOrLeave)
    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUpOrLeave)
      canvas.removeEventListener('pointerleave', onPointerUpOrLeave)
    }
  }, [canvas])

  //* Pause time when page not open
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        clock.stop() // freeze time; no accumulation while hidden
      } else {
        clock.start() // resets lastTime to now -> next delta is tiny
        tick.current = 0 // drop any app-level backlog
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [clock])

  //* Initialise Simulation
  useEffect(() => {
    if (!('computeAsync' in renderer)) return

    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    const dpr = devicePixelRatio || 1
    const canvasW = Math.max(1, Math.floor(cssW * dpr))
    const canvasH = Math.max(1, Math.floor(cssH * dpr))

    //* Set Canvas Size (pixels)
    canvasSize.current = { x: canvasW, y: canvasH }

    //* Set Sim Size (cells)
    const simW = Math.max(1, Math.floor(canvasW / cellSize))
    const simH = Math.max(1, Math.floor(canvasH / cellSize))

    uniforms.simSize.value.set(simW, simH)

    const originU = ((canvasW - simW) * 0.5) / canvasW
    const originV = ((canvasH - simH) * 0.5) / canvasH
    uniforms.originPx.value.set(originU, originV)

    //* Set Cell Size
    uniforms.cellSize.value = cellSize

    tex.a?.dispose()
    tex.b?.dispose()

    //* Create Textures
    tex.a = makeStorageTex(simW, simH)
    tex.b = makeStorageTex(simW, simH)
    uniforms.display.value = tex.a

    //* Build Compute Shader Kernels
    kernels.current = buildKernels(simW, simH)

    console.log('Init')
  }, [renderer, cellSize])

  useFrame((state, delta) => {
    if (!('computeAsync' in renderer) || !kernels.current || document.hidden) return

    uniforms.frame.value++

    //? If pointer clicked
    if (uniforms.pointerDown.value) {
      //* Transform to canvas pixel coordinates (centre origin to top left origin, [-1, 1] to [0, 1])
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
      // renderer.computeAsync(phase.current ? kernels.current.lifeBA : kernels.current.lifeAB)

      // renderer.computeAsync(phase.current ? kernels.current.sandBA : kernels.current.sandAB)

      for (let i = 0; i < 4; i++) {
        renderer.computeAsync(phase.current ? kernels.current.sandBA : kernels.current.sandAB)
        uniforms.frame.value++ // advances phase: 0→1→2→3
        phase.current = !phase.current
      }

      uniforms.display.value = phase.current ? tex.a : tex.b

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
      >
        <FallingSand pointerRef={pointerRef} />
      </Canvas>
    </>
  )
}

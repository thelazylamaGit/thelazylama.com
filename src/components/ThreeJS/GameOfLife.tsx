import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScreenQuad, useTexture, useFBO } from '@react-three/drei'
import * as THREE from 'three'

import simFrag from '@/shaders/simulateCells.frag'
import displayFrag from '@/shaders/displayCells.frag'
import vert from '@/shaders/vertGL2.vert'

const W = 512
const H = 512

function Life() {
  const { gl, size } = useThree()

  // 2 render targets for ping-pong
  const rtA = useFBO(W, H, {
    format: THREE.RedFormat,
    type: THREE.UnsignedByteType,
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  })
  const rtB = useFBO(W, H, {
    format: THREE.RedFormat,
    type: THREE.UnsignedByteType,
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  })

  // One full-screen quad + one ortho camera we’ll reuse for both passes
  const cam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const quad = useMemo(() => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    mesh.frustumCulled = false
    return mesh
  }, [])

  const simMat = useMemo(
    () =>
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: vert,
        fragmentShader: simFrag,
        uniforms: {
          u_state: { value: rtA.texture }, // will update each frame
          u_gridSize: { value: new THREE.Vector2(W, H) },
          u_mouse: { value: new THREE.Vector2(-1, -1) }, // -1,-1 = inactive
          u_brush: { value: 4.0 },
          u_seed: { value: 0.0 },
        },
      }),
    [],
  )

  const displayMat = useMemo(
    () =>
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: vert,
        fragmentShader: displayFrag,
        uniforms: {
          u_state: { value: rtA.texture }, // current state to visualize
          u_viewSize: { value: new THREE.Vector2(size.width, size.height) },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [size],
  )

  // Mount a single quad into the main scene once
  useEffect(() => {
    quad.material = displayMat
    // add to the R3F scene
    // we can grab the internal scene via three.js renderer; simpler: just create a group component instead.
  }, [quad, displayMat])

  // Mouse → [0,1] UV (screen space)
  const [isDown, setDown] = useState(false)
  const mouse = useRef(new THREE.Vector2(-1, -1))
  useEffect(() => {
    const el = gl.domElement
    const rect = () => el.getBoundingClientRect()
    const toUV = (e: PointerEvent) => {
      const r = rect()
      mouse.current.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height)
    }
    const down = (e: PointerEvent) => {
      toUV(e)
      setDown(true)
    }
    const move = (e: PointerEvent) => {
      if (isDown) toUV(e)
    }
    const up = () => {
      setDown(false)
      mouse.current.set(-1, -1)
    }

    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [gl, isDown])

  // Seed rtA once
  useEffect(() => {
    const seed = new Uint8Array(W * H)
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random() < 0.15 ? 255 : 0
    const tex = new THREE.DataTexture(seed, W, H, THREE.RedFormat)
    tex.needsUpdate = true
    const old = gl.getRenderTarget()
    const mat = new THREE.MeshBasicMaterial({ map: tex })
    quad.material = mat
    gl.setRenderTarget(rtA)
    gl.clear(true, true, true)
    gl.render(quad, cam)
    gl.setRenderTarget(old)
    mat.dispose()
    tex.dispose()
    quad.material = displayMat
  }, [gl])

  useFrame(({ clock, scene }) => {
    // 1) SIM PASS: render sim shader to rtB using rtA.texture as input
    simMat.uniforms.u_state.value = rtA.texture
    simMat.uniforms.u_mouse.value.copy(mouse.current)
    simMat.uniforms.u_seed.value = clock.getElapsedTime()

    const oldTarget = gl.getRenderTarget()
    const oldMat = quad.material

    quad.material = simMat
    gl.setRenderTarget(rtB)
    gl.clear(true, true, true)
    gl.render(quad, cam)

    // 2) DISPLAY PASS: render to screen using display shader sampling newest texture
    ;[rtA.texture, rtB.texture] = [rtB.texture, rtA.texture] // swap textures
    displayMat.uniforms.u_state.value = rtA.texture

    gl.setRenderTarget(null)
    quad.material = displayMat
    gl.render(quad, cam)

    // restore
    quad.material = oldMat
    gl.setRenderTarget(oldTarget)
  })

  // Render nothing from JSX; we drive the quad imperatively
  return null
}

function GameOfLife() {
  return (
    <Canvas
      style={{ width: '100vw', height: '100vh' }}
      dpr={[1, 1]}
      gl={{ antialias: false, depth: false, stencil: false }}
    >
      <Life />
    </Canvas>
  )
}
export default GameOfLife

'use client'

import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import * as THREE from 'three/webgpu' // WebGPURenderer, Sprite, materials...
import Particles from './Particles'

const ParticleScene = () => {
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator

  return (
    <>
      <Stats />
      <Canvas
        className="h-full w-full"
        // WebGPU path (async)
        gl={
          hasWebGPU
            ? async (props) => {
                const renderer = new THREE.WebGPURenderer({ ...(props as any), antialias: false })
                await renderer.init() // important!
                return renderer
              }
            : undefined
        } // else WebGL fallback (R3F default)
        dpr={[1, 2]}
        camera={{ fov: 50, position: [0, 5, 20] }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 1)} // solid black
      >
        <Particles count={1_000_000} />
      </Canvas>
    </>
  )
}

export default ParticleScene

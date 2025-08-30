import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScreenQuad, useTexture } from '@react-three/drei'
import * as THREE from 'three'

import vertex from '@/shaders/vertexShader.glsl'
import fragment from '@/shaders/fragmentShader.glsl'

const Scene = () => {
  const matRef = useRef<THREE.ShaderMaterial>(null!)
  const tmp = useMemo(() => new THREE.Vector2(), [])

  const { gl, clock, size } = useThree()

  // Load the noise texture and update the shader uniform
  const noise = useTexture('/noise2.png')

  // Define the shader uniforms with memoization to optimize performance
  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(0, 0) },
      iBaseScale: { value: 1 },
      iChannel0: { value: null as unknown as THREE.Texture }, // placeholder
    }),
    [],
  )

  useEffect(() => {
    if (!noise || !matRef.current) return
    noise.generateMipmaps = false
    noise.minFilter = THREE.LinearFilter
    noise.magFilter = THREE.LinearFilter
    matRef.current.uniforms.iChannel0.value = noise // assign once loaded
  }, [noise])

  useEffect(() => {
    if (!matRef.current) return
    matRef.current.uniforms.iResolution.value.set(size.width, size.height) // CSS px
  }, [size.width, size.height])

  useEffect(() => {
    if (!matRef.current) return
    // choose ONE:
    // 1) Lock to initial HEIGHT scale (my go-to for backgrounds):
    matRef.current.uniforms.iBaseScale.value = size.height / 10
  }, [])

  useFrame(() => {
    if (!matRef.current) return
    matRef.current.uniforms.iTime.value = clock.getElapsedTime()
  })

  return (
    <ScreenQuad>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        side={THREE.DoubleSide}
      />
    </ScreenQuad>
  )
}

function ShaderTest() {
  return (
    <Canvas
      style={{ width: '100vw', height: '100vh' }}
      dpr={[1, 1]}
      gl={{ antialias: false, depth: false, stencil: false }}
    >
      <Scene />
    </Canvas>
  )
}
export default ShaderTest

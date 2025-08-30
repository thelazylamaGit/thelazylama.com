import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

const ShaderBG = () => {
  return (
    <Canvas
      className="pointer-events-none h-lvh w-lvw"
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
    >
      <mesh>
        <boxGeometry></boxGeometry>
      </mesh>
      <OrbitControls />
    </Canvas>
  )
}

export default ShaderBG

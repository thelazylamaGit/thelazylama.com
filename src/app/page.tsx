'use client'
import dynamic from 'next/dynamic'

import TiltCard from '@/components/ParallaxEffect/TiltCard'
import ShaderBG from '@/components/ThreeJS/Canvas'
import ShaderTest from '@/components/ThreeJS/shaderDisplay'
import GameOfLife from '@/components/ThreeJS/GameOfLife'
import ParticleScene from '@/components/ThreeJS/ParticleDemo/ParticleScene'
import FallingSand from '@/components/ThreeJS/FallingSand'

export default function Home() {
  return (
    <div className="">
      <div className="fixed inset-0 z-0">
        {/* <ParticleScene /> */}
        <FallingSand />
      </div>
      <main className="flex">
        {/* <div className="from to pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-teal-900 to-indigo-900" /> */}
        {/* <ShaderTest /> */}
        {/* <GameOfLife /> */}
        {/* <Scene /> */}
        {/* <TiltCard /> */}
      </main>
    </div>
  )
}

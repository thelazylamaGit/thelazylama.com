'use client'

import TiltCard from '@/components/ParallaxEffect/TiltCard'
import ShaderBG from '@/components/ThreeJS/Canvas'
import ShaderTest from '@/components/ThreeJS/shaderTest'
import GameOfLife from '@/components/ThreeJS/GameOfLife'

export default function Home() {
  return (
    <main className="">
      {/* <ShaderTest /> */}
      {/* <GameOfLife /> */}
      <TiltCard></TiltCard>
    </main>
  )
}

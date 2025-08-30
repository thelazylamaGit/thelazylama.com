'use client'

import TiltCard from '@/components/ParallaxEffect/TiltCard'
import ShaderBG from '@/components/ThreeJS/Canvas'
import ShaderTest from '@/components/ThreeJS/shaderTest'

export default function Home() {
  return (
    <div className="fixed inset-0">
      <ShaderTest />
      {/* <TiltCard></TiltCard> */}
    </div>
  )
}

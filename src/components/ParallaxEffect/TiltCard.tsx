import React from 'react'
import { TiltBox, ZLayer } from '@/components/ParallaxEffect'

function TiltCard() {
  return (
    <main className="absolute inset-0 grid place-items-center overflow-hidden">
      <TiltBox width={384} height={500} className="overflow-hidden">
        <ZLayer depth={100} shadow={{ offset: 1, blur: 8, alpha: 0.2 }}>
          <div className="absolute inset-12 grid place-content-center rounded-xl bg-sky-200">
            <span className="text-6xl text-black">text</span>
          </div>
        </ZLayer>
      </TiltBox>
    </main>
  )
}

export default TiltCard

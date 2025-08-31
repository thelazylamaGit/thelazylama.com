import React from 'react'
import { TiltBox, ZLayer } from '@/components/ParallaxEffect'

function TiltCard() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <TiltBox width={384} height={500} liftHeight={100} className="">
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

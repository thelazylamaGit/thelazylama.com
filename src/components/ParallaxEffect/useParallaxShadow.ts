// src/components/tilt/useParallaxShadow.ts
'use client'

import { useMotionTemplate, useTransform, useSpring } from 'framer-motion'
import { useTilt } from './TiltBox'
import { Shadow } from '@react-three/drei'

export type ParallaxShadowOptions = {
  /** Global multiplier for total offset. Default: 1 */
  offset?: number
  /** Base direction (px) the shadow leans regardless of tilt. Default: { x: 5, y: 20 } */
  direction?: { x: number; y: number }
  /** Pixels contributed per unit tilt (-0.5..0.5). Default: { x: -15, y: -20 } */
  tiltStrength?: { x: number; y: number }
  /** Constant blur radius (px). Default: 8 */
  blur?: number
  /** Constant alpha (0..1). Default: 0.16 */
  alpha?: number
}

const DEF: Required<ParallaxShadowOptions> = {
  offset: 1,
  direction: { x: 5, y: 10 },
  tiltStrength: { x: -40, y: -40 },
  blur: 8,
  alpha: 0.16,
}

export function useParallaxShadow(opts: ParallaxShadowOptions = {}) {
  const { mouseX, mouseY } = useTilt()
  const { offset, direction, tiltStrength, blur, alpha } = { ...DEF, ...opts }

  const shadowX = useSpring(mouseX, { stiffness: 1000, damping: 20 })
  const shadowY = useSpring(mouseY, { stiffness: 1000, damping: 20 })

  // Offsets react to tilt; everything else is constant
  // const offX = useTransform(
  //   shadowX,
  //   (v) => (direction.x + v * tiltStrength.x) * offset,
  // )
  // const offY = useTransform(
  //   shadowY,
  //   (v) => (direction.y + v * tiltStrength.y) * offset,
  // )

  const offX = useTransform(
    mouseX,
    (v) => (direction.x + v * tiltStrength.x) * offset,
  )
  const offY = useTransform(
    mouseY,
    (v) => (direction.y + v * tiltStrength.y) * offset,
  )

  const boxShadow = useMotionTemplate`${offX}px ${offY}px ${blur}px rgba(0,0,0,${alpha})`
  const textShadow = useMotionTemplate`${offX}px ${offY}px ${blur}px rgba(0,0,0,${alpha})`
  const dropShadow = useMotionTemplate`drop-shadow(${offX}px ${offY}px ${blur}px rgba(0,0,0,${alpha}))`

  return { boxShadow, textShadow, dropShadow, offX, offY }
}

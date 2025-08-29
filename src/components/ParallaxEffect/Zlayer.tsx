// src/components/tilt/ZLayer.tsx
'use client'
import React from 'react'
import { motion, type MotionValue } from 'framer-motion'
import { useParallaxShadow } from './useParallaxShadow'

type ZLayerShadow = {
  /** Multiplier for how far the shadow offsets with tilt (default 0.7) */
  offset?: number
  /** Fixed blur in px (default 8) */
  blur?: number
  /** Fixed alpha (0–1) (default 0.16) */
  alpha?: number
}

type Props = {
  /** translateZ in px (can be MotionValue) */
  depth?: number | MotionValue<number>
  shadow?: ZLayerShadow
  children: React.ReactElement<any>
}

export function ZLayer({ depth = 50, shadow, children }: Props) {
  const MotionChild = React.useMemo(
    () => motion.create(children.type as any),
    [children.type],
  )

  // Compute fixed values (don’t guard the hook; keep call order stable)
  const offset = shadow?.offset ?? 0.7
  const blur = shadow?.blur ?? 8
  const alpha = shadow?.alpha ?? 0.16

  // ✅ Call hooks at top level (not inside useMemo / conditionals)
  const parallax = useParallaxShadow({ offset, blur, alpha })

  return (
    <MotionChild
      {...children.props}
      style={{
        ...(children.props.style || {}),
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        // Framer Motion composes this as translateZ()
        z: depth as any,
        ...(shadow ? { boxShadow: parallax.boxShadow as any } : null),
      }}
    />
  )
}

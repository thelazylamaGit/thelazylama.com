'use client'
import React, { useRef } from 'react'
import {
  clamp,
  motion,
  motionValue,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import { Yrsa } from 'next/font/google'

const Example = () => {
  return (
    <div className="grid h-screen w-full place-content-center bg-gradient-to-tl from-indigo-800 to-red-950 px-4 py-12 text-slate-900">
      <TiltCard />
    </div>
  )
}

const MAX_TILT = 20

const SPRING_OPTIONS = {
  stiffness: 250,
  damping: 10,
  mass: 1,
  restSpeed: 0.01,
  restDelta: 0.01,
}

const LIFT_SPRING = {
  stiffness: 250,
  damping: 10,
  mass: 1,
  restSpeed: 0.01,
  restDelta: 0.01,
}

const SHADOW = {
  blur: [8, 32],
  alpha: [0.15, 0.3],
  offsetX: [25, -40],
  offsetY: [40, -25],
}

const TiltCard = () => {
  const planeRef = useRef<HTMLDivElement>(null)

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const mouseXSpring = useSpring(x, SPRING_OPTIONS)
  const mouseYSpring = useSpring(y, SPRING_OPTIONS)

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [MAX_TILT, -MAX_TILT])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-MAX_TILT, MAX_TILT])

  const z = useMotionValue(0)
  const zSpring = useSpring(z, LIFT_SPRING)

  const shadowOffsetX = useTransform(mouseXSpring, [-0.5, 0.5], SHADOW.offsetX)
  const shadowOffsetY = useTransform(mouseYSpring, [-0.5, 0.5], SHADOW.offsetY)
  const shadowBlur = useTransform(zSpring, [0, 40], SHADOW.blur)
  const shadowOpacity = useTransform(zSpring, [0, 40], SHADOW.alpha)

  const boxShadow = useMotionTemplate`${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px rgba(0,0,0,${shadowOpacity})`

  const brightness = useTransform(mouseYSpring, [0.5, -0.5], [0.9, 1.1])
  const filter = useMotionTemplate`brightness(${brightness})`

  const sheenAngle = useTransform(
    [mouseXSpring, mouseYSpring],
    ([x, y]: number[]) => (Math.atan2(y, x) * 180) / Math.PI,
  )

  const tiltMag = useTransform(
    [mouseXSpring, mouseYSpring],
    ([x, y]: number[]) => Math.min(1, Math.hypot(x, y) * 3),
  )

  const sheenRot = useMotionTemplate`${sheenAngle}deg`

  const sheenBaseOpacity = useTransform(zSpring, [0, 40], [0.12, 0.35])

  const sheenOpacity = useTransform(
    [sheenBaseOpacity, tiltMag],
    ([o, m]: number[]) => o * m,
  )

  const hue = useTransform(sheenAngle, [0, 360], [200, 320]) // bluish → magenta
  const iridescence = useMotionTemplate`hue-rotate(${hue}deg) saturate(1.15)`

  const handleMouseMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = planeRef.current!.getBoundingClientRect()

    const width = rect.width
    const height = rect.height

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const xRel = mouseX / width - 0.5
    const yRel = mouseY / height - 0.5

    console.log(xRel + ' : ' + yRel)

    x.set(clamp(-0.5, 0.5, xRel))
    y.set(clamp(-0.5, 0.5, yRel))
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
    z.set(0)
  }

  const handleMouseEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    z.set(40)
  }

  return (
    <div
      ref={planeRef}
      className="p-8 [perspective:1000px]"
      onPointerEnter={handleMouseEnter}
      onPointerMove={handleMouseMove}
      onPointerLeave={handleMouseLeave}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          z: zSpring,
          boxShadow,
          filter,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          transformOrigin: 'center',
        }}
        transition={{
          boxShadow: { type: 'tween', duration: 0.35, ease: 'easeInOut' },
        }}
        className="relative h-96 w-72 overflow-hidden rounded-xl bg-gradient-to-br from-blue-900 to-sky-400"
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 mix-blend-screen"
          style={{
            background:
              'conic-gradient(from var(--sheen-rot), transparent 0deg, rgba(255,255,255,0.7) 60deg, transparent 120deg)',
            mixBlendMode: 'screen', // add light without washing color
            opacity: sheenOpacity as unknown as number, // FM style typing convenience
            filter: iridescence,
            // expose the angle as a CSS var so the gradient can read it
            ['--sheen-rot' as any]: sheenRot,
          }}
        ></motion.div>
        <div
          style={{
            transform: 'translateZ(1000px)',
            transformStyle: 'preserve-3d',
          }}
          className="pointer-events-none absolute inset-6 grid place-content-center rounded-xl bg-blue-200 shadow-lg"
        >
          Bush did 9/11
        </div>
      </motion.div>
    </div>
  )
}

export default Example

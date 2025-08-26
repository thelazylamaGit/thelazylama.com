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

const Example = () => {
  return (
    <div className="grid h-screen w-full place-content-center bg-gradient-to-tl from-indigo-800 to-red-950 px-4 py-12 text-slate-900">
      <TiltCard />
    </div>
  )
}

const MAX_TILT = 20

const SPRING_OPTIONS = {
  stiffness: 400,
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

  //* Mouse Transform and Rotation

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const mouseXSpring = useSpring(x, SPRING_OPTIONS)
  const mouseYSpring = useSpring(y, SPRING_OPTIONS)

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [MAX_TILT, -MAX_TILT])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-MAX_TILT, MAX_TILT])

  //* Lift Settings

  const z = useMotionValue(0)
  const zSpring = useSpring(z, LIFT_SPRING)

  //* Shadow Settings

  //? shadow rotate
  const shadowOffsetX = useTransform(mouseXSpring, [-0.5, 0.5], SHADOW.offsetX)
  const shadowOffsetY = useTransform(mouseYSpring, [-0.5, 0.5], SHADOW.offsetY)

  //? shadow lift
  const shadowBlur = useTransform(zSpring, [0, 40], SHADOW.blur)
  const shadowOpacity = useTransform(zSpring, [0, 40], SHADOW.alpha)

  const boxShadow = useMotionTemplate`${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px rgba(0,0,0,${shadowOpacity})`

  //* Brightness Settings

  const brightness = useTransform(mouseYSpring, [0.5, -0.5], [0.9, 1.1])
  const filter = useMotionTemplate`brightness(${brightness})`

  //* Sheen Settings

  const tiltMag = useTransform(
    [mouseXSpring, mouseYSpring],
    ([x, y]: number[]) => Math.min(1, Math.hypot(x, y) * 3),
  )

  const sheenAngle = useTransform(
    [mouseXSpring, mouseYSpring],
    ([x, y]: number[]) => (Math.atan2(y, x) * 180) / Math.PI,
  )

  const sheenRot = useMotionTemplate`${sheenAngle}deg`

  const sheenBaseOpacity = useTransform(zSpring, [0, 40], [0.12, 0.35])

  const sheenOpacity = useTransform(
    [sheenBaseOpacity, tiltMag],
    ([o, m]: number[]) => o * m,
  )

  //* Iridescence Effect

  const hue = useTransform(sheenAngle, [0, 360], [200, 320]) // bluish → magenta
  const iridescence = useMotionTemplate`hue-rotate(${hue}deg) saturate(1.15)`

  //! Animation Functions

  const handleMouseMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = planeRef.current!.getBoundingClientRect()

    const width = rect.width
    const height = rect.height

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const xRel = mouseX / width - 0.5
    const yRel = mouseY / height - 0.5

    x.set(clamp(-0.5, 0.5, xRel))
    y.set(clamp(-0.5, 0.5, yRel))
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
    z.set(0)
  }

  const handleMouseEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    z.set(300)
  }

  //! Actual Card

  return (
    <motion.div
      ref={planeRef}
      className="p-8"
      style={{ transformStyle: 'preserve-3d', perspective: 1000, filter }}
      onPointerEnter={handleMouseEnter}
      onPointerMove={handleMouseMove}
      onPointerLeave={handleMouseLeave}
    >
      {/* 
      //*Card Tilt Effect Div
      */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          z: zSpring,
          boxShadow,
          willChange: 'transform',
          transformOrigin: 'center',
          transformStyle: 'preserve-3d',
        }}
        className="relative h-96 w-72 rounded-xl bg-gradient-to-br from-blue-900 to-sky-400"
      >
        {/* Shimmer/Iridescence Effect, above base card but below children */}
        {/* <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-screen"
            style={{
              background:
                'conic-gradient(from var(--sheen-rot), transparent 0deg, rgba(255,255,255,0.7) 60deg, transparent 180deg)',
              mixBlendMode: 'screen', // add light without washing color
              opacity: sheenOpacity as unknown as number,
              filter: iridescence,
              transformStyle: 'preserve-3d',
              ['--sheen-rot' as any]: sheenRot,
            }}
          ></motion.div> */}
        {/* Front Card */}
        <div
          style={{
            transform: 'translateZ(30px)',
            transformStyle: 'preserve-3d',
          }}
          className="absolute inset-12 grid place-content-center rounded-xl bg-sky-200 drop-shadow-xl drop-shadow-gray-900"
        >
          Yabby Dabby Doo
        </div>
      </motion.div>
    </motion.div>
  )
}

export default Example

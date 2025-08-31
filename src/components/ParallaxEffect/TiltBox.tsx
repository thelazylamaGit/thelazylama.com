'use client'
import React, { createContext, useContext, useMemo, useRef } from 'react'
import {
  clamp,
  motion,
  useMotionTemplate,
  useMotionValue,
  motionValue,
  MotionValue,
  useSpring,
  useTransform,
  number,
} from 'framer-motion'

export type TiltContext = {
  mouseX: MotionValue<number> // -0.5..0.5 (springed)
  mouseY: MotionValue<number>
  rotateX: MotionValue<number> // degrees
  rotateY: MotionValue<number>
  z: MotionValue<number>
  zSpring: MotionValue<number>
  maxTilt: number
  liftHeight: number
}
const Ctx = createContext<TiltContext | null>(null)
export const useTilt = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTilt must be used inside <TiltArea>')
  return v
}

type SpringCfg = {
  stiffness?: number
  damping?: number
  mass?: number
  restSpeed?: number
  restDelta?: number
}

type ShadowCfg = {
  blur?: [number, number] // px over lift
  alpha?: [number, number] // 0..1 over lift
  direction?: { x: number; y: number } // base dir in px
  tiltStrength?: { x: number; y: number } // additional dir from tilt
  offsetZ?: [number, number] // scales direction with lift
  scale?: [number, number] // global scale over lift
  foreshorten?: number // 0..~0.2
  originShift?: number // %
}

export type TiltAreaProps = {
  children?: React.ReactNode

  // sizing (applies to card + shadow)
  width?: number // px
  height?: number // px
  radius?: number // px

  className?: string
  style?: React.CSSProperties

  // core behavior
  maxTilt?: number // deg
  liftHeight?: number // px translateZ on hover
  perspective?: number // px
  brightnessRange?: [number, number] | null // null = disable filter

  // framer springs (native format)
  spring?: SpringCfg // for mouseX/mouseY
  liftSpring?: SpringCfg // for z
  shadow?: ShadowCfg | false // false disables the separate shadow plane
}

const DEF_SPRING: Required<SpringCfg> = {
  stiffness: 400,
  damping: 10,
  mass: 1,
  restSpeed: 0.01,
  restDelta: 0.01,
}
const DEF_LIFT_SPRING: Required<SpringCfg> = {
  stiffness: 250,
  damping: 10,
  mass: 1,
  restSpeed: 0.01,
  restDelta: 0.01,
}
const DEF_SHADOW: Required<Omit<ShadowCfg, 'blur' | 'alpha' | 'offsetZ' | 'scale'>> & {
  blur: [number, number]
  alpha: [number, number]
  offsetZ: [number, number]
  scale: [number, number]
} = {
  blur: [4, 14],
  alpha: [0.15, 0.3],
  direction: { x: 5, y: 20 },
  tiltStrength: { x: -15, y: -20 },
  offsetZ: [0.5, 5],
  scale: [1, 1.4],
  foreshorten: 0.1,
  originShift: -50,
}

export function TiltBox({
  children,
  className,
  style,
  /* sizing */
  width = 288, // 18rem
  height = 384, // 24rem
  radius = 15,
  /* behavior */
  maxTilt = 20,
  liftHeight = 300,
  perspective = 1000,
  brightnessRange = [0.9, 1.1],
  /* springs */
  spring,
  liftSpring,
  /* shadow config */
  shadow = DEF_SHADOW,
}: TiltAreaProps) {
  const planeRef = useRef<HTMLDivElement>(null)

  //* Mouse Transform and Rotation

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const z = useMotionValue(0)
  // springs (Framer's native config objects)
  const xSpring = useSpring(x, { ...DEF_SPRING, ...(spring ?? {}) })
  const ySpring = useSpring(y, { ...DEF_SPRING, ...(spring ?? {}) })
  const zSpring = useSpring(z, { ...DEF_LIFT_SPRING, ...(liftSpring ?? {}) })

  const rotateX = useTransform(ySpring, [-0.5, 0.5], [maxTilt, -maxTilt])
  const rotateY = useTransform(xSpring, [-0.5, 0.5], [-maxTilt, maxTilt])

  //* Shadow Effects

  const S = shadow === false ? null : { ...DEF_SHADOW, ...(shadow ?? {}) }

  const tiltX = useTransform(xSpring, [-0.5, 0.5], [-(S?.tiltStrength.x ?? 0), S?.tiltStrength.x ?? 0])
  const tiltY = useTransform(ySpring, [-0.5, 0.5], [-(S?.tiltStrength.y ?? 0), S?.tiltStrength.y ?? 0])

  const shadowOffsetZ = useTransform(zSpring, [0, liftHeight], S ? S.offsetZ : [0, 0])
  const shadowScale = useTransform(zSpring, [0, liftHeight], S ? S.scale : [1, 1])

  const shadowScaleX = useTransform(rotateY, (v) => 1 + (Math.abs(v) * (S?.foreshorten ?? 0)) / maxTilt)
  const shadowScaleY = useTransform(rotateX, (v) => 1 + (Math.abs(v) * (S?.foreshorten ?? 0)) / maxTilt)

  const originX = useTransform(rotateY, (v) => `${50 - (S?.originShift ?? 0) * (v / maxTilt)}%`)
  const originY = useTransform(rotateX, (v) => `${50 + (S?.originShift ?? 0) * (v / maxTilt)}%`)

  const shadowOrigin = useMotionTemplate`${originX} ${originY}`

  const shadowOffsetX = useTransform([tiltX, shadowOffsetZ], (values: number[]) => {
    const [tx, s] = values as [number, number]
    const dirX = S?.direction.x ?? 0
    return (dirX + tx) * s
  })

  const shadowOffsetY = useTransform([tiltY, shadowOffsetZ], (values: number[]) => {
    const [ty, s] = values as [number, number]
    const dirY = S?.direction.y ?? 0
    return (dirY + ty) * s
  })

  const shadowBlur = useTransform(zSpring, [0, liftHeight], S ? S.blur : [0, 0])
  const shadowAlpha = useTransform(zSpring, [0, liftHeight], S ? S.alpha : [0, 0])

  //* Brightness Settings

  const filter = brightnessRange
    ? useMotionTemplate`brightness(${useTransform(ySpring, [0.5, -0.5], brightnessRange)})`
    : undefined

  const ctx = useMemo<TiltContext>(
    () => ({
      mouseX: xSpring,
      mouseY: ySpring,
      rotateX,
      rotateY,
      z,
      zSpring: zSpring,
      maxTilt,
      liftHeight,
    }),
    [xSpring, ySpring, rotateX, rotateY, z, zSpring, maxTilt, liftHeight],
  )

  // CSS variables for simple sizing across card + shadow
  const vars: React.CSSProperties = {
    ['--card-w' as any]: `${width}px`,
    ['--card-h' as any]: `${height}px`,
    ['--card-r' as any]: `${radius}px`,
  }

  //! Get Pointer Location

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

  //! Reset Transform

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
    z.set(0)
  }

  //! Start Hover

  const handleMouseEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    z.set(liftHeight)
  }

  //! Actual Card

  return (
    <Ctx.Provider value={ctx}>
      <motion.div
        ref={planeRef}
        className="relative p-8"
        style={{
          ...vars,
          ...style,
          perspective,
          transformStyle: 'preserve-3d',
          filter,
          willChange: brightnessRange ? 'filter' : undefined,
          position: 'relative',
        }}
        onPointerEnter={handleMouseEnter}
        onPointerMove={handleMouseMove}
        onPointerLeave={handleMouseLeave}
      >
        {S && (
          <motion.div
            aria-hidden
            style={{
              position: 'absolute',
              width,
              height,
              borderRadius: radius,
              transformStyle: 'flat',
              backgroundColor: 'black',
              mixBlendMode: 'multiply',

              transformOrigin: shadowOrigin,
              x: shadowOffsetX,
              y: shadowOffsetY,
              scaleX: shadowScaleX,
              scaleY: shadowScaleY,
              rotateX,
              rotateY,
              scale: shadowScale,
              opacity: shadowAlpha,
              filter: useMotionTemplate`blur(${shadowBlur}px)`,
              willChange: 'transform',
              pointerEvents: 'none',
            }}
          />
        )}
        <motion.div
          className="relative bg-gradient-to-br from-blue-900 to-sky-400"
          style={{
            width,
            height,
            borderRadius: radius,
            rotateX,
            rotateY,
            z: zSpring,
            willChange: 'transform',
            transformOrigin: 'center',
            transformStyle: 'preserve-3d',
          }}
        >
          {children}
        </motion.div>
      </motion.div>
    </Ctx.Provider>
  )
}

export default TiltBox

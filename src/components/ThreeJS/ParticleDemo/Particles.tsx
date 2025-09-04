'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { OrbitControls } from '@react-three/drei'

import { Fn, If, uniform, uv, vec3, instancedArray, instanceIndex, shapeCircle, hash, float } from 'three/tsl'

type Props = { count: number }

const Particles = ({ count }: Props) => {
  const { gl, camera, viewport } = useThree()
  const renderer = gl as unknown as THREE.WebGPURenderer

  //* uniforms
  const gravity = useRef(uniform(-0.00098)).current
  const bounce = useRef(uniform(0.8)).current
  const friction = useRef(uniform(0.99)).current
  const size = useRef(uniform(0.12)).current
  const clickPos = useRef(uniform(new THREE.Vector3())).current

  //* storage buffers
  const positions = useMemo(() => instancedArray(count, 'vec3'), [count])
  const velocities = useMemo(() => instancedArray(count, 'vec3'), [count])
  const colors = useMemo(() => instancedArray(count, 'vec3'), [count])

  //* --- compute: init (lay out a grid + color)
  const computeInit = useMemo(() => {
    const amount = Math.floor(Math.sqrt(count))
    const sep = float(0.2) // 👈 wrap as TSL float
    const offset = float(amount / 2) // 👈 wrap as TSL float

    return Fn(() => {
      const p = positions.element(instanceIndex)
      const c = colors.element(instanceIndex)

      const x = instanceIndex.mod(amount)
      const z = instanceIndex.div(amount)

      p.x = offset.sub(x).mul(sep) // now Node math, not number math
      p.z = offset.sub(z).mul(sep)

      c.x = hash(instanceIndex)
      c.y = hash(instanceIndex.add(2))
    })().compute(count)
  }, [count])

  //* --- compute: per-frame update
  const computeParticles = useMemo(() => {
    const update = Fn(() => {
      const p = positions.element(instanceIndex)
      const v = velocities.element(instanceIndex)
      v.addAssign(vec3(0.0, gravity, 0.0))
      p.addAssign(v)
      v.mulAssign(friction)
      If(p.y.lessThan(0), () => {
        p.y.assign(float(0))
        v.y = v.y.negate().mul(bounce)
        v.x = v.x.mul(0.9)
        v.z = v.z.mul(0.9)
      })
    })
    return update().compute(count)
  }, [count])

  //* --- compute: cursor impulse
  const computeHit = useMemo(() => {
    return Fn(() => {
      const p = positions.element(instanceIndex)
      const v = velocities.element(instanceIndex)
      const dist = p.distance(clickPos)
      const dir = p.sub(clickPos).normalize()
      const area = float(5.0).sub(dist).max(0.0)
      const power = area.mul(0.01)
      const jitter = hash(instanceIndex).mul(1.5).add(0.5)
      v.assign(v.add(dir.mul(power.mul(jitter))))
    })().compute(count)
  }, [count])

  //* --- sprite material + object
  const sprite = useMemo(() => {
    const mat = new THREE.SpriteNodeMaterial()
    mat.colorNode = uv().mul(colors.element(instanceIndex))
    mat.positionNode = positions.toAttribute()
    mat.scaleNode = size
    mat.opacityNode = shapeCircle()
    mat.transparent = true
    mat.alphaToCoverage = true
    const s = new THREE.Sprite(mat)
    s.count = count
    s.frustumCulled = true
    return s
  }, [count])

  //* one-time init compute
  useEffect(() => {
    if ('gpu' in navigator) renderer.computeAsync(computeInit)
  }, [renderer, computeInit])

  //* per-frame compute
  useFrame(() => {
    if ('gpu' in navigator) renderer.computeAsync(computeParticles)
  })

  //* pointer impulse (raycast a big ground plane)
  useFrame(({ pointer, raycaster, scene }) => {
    //* simple hit plane at y = -1
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1) // y = -1
    const ray = raycaster.ray
    raycaster.setFromCamera(pointer, camera)
    const hit = new THREE.Vector3()
    if (ray.intersectPlane(plane, hit)) {
      clickPos.value.copy(hit)
      renderer.computeAsync(computeHit)
    }
  })

  return (
    <>
      <primitive object={sprite} />
      <OrbitControls makeDefault enableDamping minDistance={5} maxDistance={200} target={[0, -8, 0]} />
      {/* optional visual ground helper */}
      <gridHelper args={[90, 45, 0x303030, 0x303030]} />
    </>
  )
}

export default Particles

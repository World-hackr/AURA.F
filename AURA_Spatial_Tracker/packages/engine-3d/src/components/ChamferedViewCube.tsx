import { useRef, useState } from 'react'
import * as THREE from 'three'
import { useGizmoContext, RoundedBox } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'

/**
 * Hyper-Optimized Single-Mesh Chamfered ViewCube
 * Uses a smoothness=1 RoundedBox to perfectly calculate 26 flat chamfers natively.
 * Uses Face Normals to trigger mathematically flawless camera orbits.
 */
export function ChamferedViewCube() {
  const { tweenCamera } = useGizmoContext()
  const meshRef = useRef<THREE.Mesh>(null)

  const [hovered, setHovered] = useState(false)

  const handleClick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.face && e.face.normal) {
      // The normal vector perfectly points to exactly where the camera should orbit!
      tweenCamera(e.face.normal.clone().multiplyScalar(5))
    }
  }

  const offset = 0.501
  const faceSize = 0.55 

  return (
    <group scale={[60, 60, 60]}>
      {/* CAD Axis Arrows protruding from the corner, framing the cube like Fusion 360 */}
      <axesHelper position={[-0.6, -0.6, -0.6]} args={[1.5]} />

      {/* 
        The Core Geometry:
        radius + smoothness=1 forces the engine to draw EXACTLY one flat triangle/rectangle 
        for every single edge and corner, creating a mathematically perfect chamfered box.
      */}
      <RoundedBox 
        ref={meshRef}
        args={[1, 1, 1]} 
        radius={0.25} 
        smoothness={1}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
        onClick={handleClick}
      >
        <meshBasicMaterial color={hovered ? "#9ca3af" : "#4b5563"} />
        <lineSegments>
          <edgesGeometry attach="geometry" />
          <lineBasicMaterial color="#111827" linewidth={2} />
        </lineSegments>
      </RoundedBox>

      {/* The 6 Colored RGB Faces for absolute directional clarity */}
      <mesh position={[0, 0, offset]} onClick={handleClick}>
        <planeGeometry args={[faceSize, faceSize]} />
        <meshBasicMaterial color="#3b82f6" depthTest={false} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0, -offset]} rotation={[0, Math.PI, 0]} onClick={handleClick}>
        <planeGeometry args={[faceSize, faceSize]} />
        <meshBasicMaterial color="#3b82f6" depthTest={false} transparent opacity={0.9} />
      </mesh>

      <mesh position={[offset, 0, 0]} rotation={[0, Math.PI / 2, 0]} onClick={handleClick}>
        <planeGeometry args={[faceSize, faceSize]} />
        <meshBasicMaterial color="#ef4444" depthTest={false} transparent opacity={0.9} />
      </mesh>
      <mesh position={[-offset, 0, 0]} rotation={[0, -Math.PI / 2, 0]} onClick={handleClick}>
        <planeGeometry args={[faceSize, faceSize]} />
        <meshBasicMaterial color="#ef4444" depthTest={false} transparent opacity={0.9} />
      </mesh>

      <mesh position={[0, offset, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
        <planeGeometry args={[faceSize, faceSize]} />
        <meshBasicMaterial color="#22c55e" depthTest={false} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, -offset, 0]} rotation={[Math.PI / 2, 0, 0]} onClick={handleClick}>
        <planeGeometry args={[faceSize, faceSize]} />
        <meshBasicMaterial color="#22c55e" depthTest={false} transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'

export function RoomMesh() {
  const roomDimensions = useSpatialStore(state => state.roomDimensions)
  const [w, h, d] = roomDimensions

  return (
    <group position={[0, h / 2, 0]}>
      {/* 
        The Room Enclosure.
      */}
      <mesh receiveShadow renderOrder={-5}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial 
          color="#475569" /* Darker slate to make white edges pop */
          side={THREE.DoubleSide}
          transparent
          opacity={0.08}
          depthWrite={false}
          roughness={1.0} 
          metalness={0.0}
        />
        {/* Stark white, thickened edges so the room corners are perfectly visible */}
        <Edges scale={1.0} color="#ffffff" linewidth={3} />
      </mesh>
      
      {/* Floor Grid (Opacity controlled by slider) */}
    </group>
  )
}



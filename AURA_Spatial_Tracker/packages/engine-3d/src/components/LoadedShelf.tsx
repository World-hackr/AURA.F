import { useMemo, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { useSpatialStore } from '@aura/state-store'
import { useRawPointerInteraction } from '../hooks/useRawPointerInteraction'

interface LoadedShelfProps {
  id: string
}

export function LoadedShelf({ id }: LoadedShelfProps) {
  const obj = useLoader(OBJLoader as any, '/models/shelf.obj') as THREE.Group
  const clonedObj = useMemo(() => obj.clone(), [obj])

  useMemo(() => {
    clonedObj.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: '#1e293b', 
          roughness: 0.8,
          metalness: 0.2
        })
      }
    })
  }, [clonedObj])

  const furnitureData = useSpatialStore(state => state.furniture.find(f => f.id === id))
  const focusFurniture = useSpatialStore(state => state.focusFurniture)
  const setCameraTarget = useSpatialStore(state => state.setCameraTarget)

  const { onPointerDown, onPointerUp } = useRawPointerInteraction({
    onSingleClick: () => focusFurniture(id),
    onDoubleClick: () => setCameraTarget(id)
  })

  if (!furnitureData) return null

  const [w, h, d] = furnitureData.dimensions
  const baseScale = 0.02

  return (
    <group 
      position={furnitureData.position} 
      name={`furniture-${id}`}
    >
      <primitive 
        object={clonedObj} 
        scale={[baseScale * w, baseScale * h, baseScale * d]} 
        position={[0, 0, 0]} 
      />
      <mesh 
        visible={false} 
        position={[0, h/2, 0]} 
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
         <boxGeometry args={[w, h, d]} />
      </mesh>
    </group>
  )
}


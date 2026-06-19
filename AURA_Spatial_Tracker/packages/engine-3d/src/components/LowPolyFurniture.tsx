import { useMemo } from 'react'
import { defaultHologramPalette as holo, useSpatialStore } from '@aura/state-store'
import { useRawPointerInteraction } from '../hooks/useRawPointerInteraction'
import { BoxOutline } from './BoxOutline'

type PrimitivePart = {
  name: string
  position: [number, number, number]
  size: [number, number, number]
  role?: 'outer' | 'inner' | 'detail'
}

const part = (name: string, position: [number, number, number], size: [number, number, number], role: PrimitivePart['role'] = 'outer'): PrimitivePart => ({
  name,
  position,
  size,
  role,
})

export function createLowPolyFurnitureParts(modelId: string, dimensions: [number, number, number]): PrimitivePart[] {
  const [w, h, d] = dimensions
  const leg = Math.max(0.08, Math.min(w, d) * 0.08)
  const top = Math.max(0.08, h * 0.08)

  switch (modelId) {
    case 'low-table':
      return [
        part('Top', [0, h - top / 2, 0], [w, top, d]),
        part('Leg FL', [-w * 0.42, h / 2, d * 0.38], [leg, h, leg], 'inner'),
        part('Leg FR', [w * 0.42, h / 2, d * 0.38], [leg, h, leg], 'inner'),
        part('Leg BL', [-w * 0.42, h / 2, -d * 0.38], [leg, h, leg], 'inner'),
        part('Leg BR', [w * 0.42, h / 2, -d * 0.38], [leg, h, leg], 'inner'),
      ]
    case 'low-chair':
      return [
        part('Seat', [0, h * 0.45, 0], [w, top * 1.4, d * 0.75]),
        part('Back', [0, h * 0.72, -d * 0.38], [w, h * 0.5, top * 1.4], 'inner'),
        part('Leg FL', [-w * 0.38, h * 0.22, d * 0.25], [leg, h * 0.44, leg], 'inner'),
        part('Leg FR', [w * 0.38, h * 0.22, d * 0.25], [leg, h * 0.44, leg], 'inner'),
        part('Leg BL', [-w * 0.38, h * 0.22, -d * 0.25], [leg, h * 0.44, leg], 'inner'),
        part('Leg BR', [w * 0.38, h * 0.22, -d * 0.25], [leg, h * 0.44, leg], 'inner'),
      ]
    case 'low-sofa':
      return [
        part('Base', [0, h * 0.25, 0], [w, h * 0.45, d]),
        part('Back', [0, h * 0.63, -d * 0.42], [w, h * 0.75, d * 0.16], 'inner'),
        part('Left Arm', [-w * 0.46, h * 0.45, 0], [w * 0.08, h * 0.55, d], 'inner'),
        part('Right Arm', [w * 0.46, h * 0.45, 0], [w * 0.08, h * 0.55, d], 'inner'),
        part('Cushion A', [-w * 0.25, h * 0.53, d * 0.08], [w * 0.44, top * 1.3, d * 0.62], 'detail'),
        part('Cushion B', [w * 0.25, h * 0.53, d * 0.08], [w * 0.44, top * 1.3, d * 0.62], 'detail'),
      ]
    case 'low-bed':
      return [
        part('Frame', [0, h * 0.18, 0], [w, h * 0.32, d]),
        part('Mattress', [0, h * 0.42, d * 0.04], [w * 0.92, h * 0.18, d * 0.86], 'inner'),
        part('Headboard', [0, h * 0.64, -d * 0.46], [w, h * 0.72, d * 0.08], 'outer'),
      ]
    case 'low-wardrobe':
      return [
        part('Body', [0, h / 2, 0], [w, h, d]),
        part('Left Door', [-w * 0.25, h / 2, d * 0.51], [w * 0.46, h * 0.92, d * 0.04], 'inner'),
        part('Right Door', [w * 0.25, h / 2, d * 0.51], [w * 0.46, h * 0.92, d * 0.04], 'inner'),
        part('Handle L', [-w * 0.06, h * 0.52, d * 0.56], [w * 0.025, h * 0.28, d * 0.035], 'detail'),
        part('Handle R', [w * 0.06, h * 0.52, d * 0.56], [w * 0.025, h * 0.28, d * 0.035], 'detail'),
      ]
    case 'low-desk':
      return [
        part('Top', [0, h * 0.78, 0], [w, top, d]),
        part('Left Pedestal', [-w * 0.34, h * 0.38, 0], [w * 0.22, h * 0.72, d * 0.78], 'inner'),
        part('Right Legs', [w * 0.34, h * 0.36, 0], [w * 0.18, h * 0.68, d * 0.72], 'inner'),
        part('Modesty Panel', [0, h * 0.55, -d * 0.38], [w * 0.76, h * 0.34, d * 0.06], 'detail'),
      ]
    case 'low-rack':
      return [
        part('Shelf 1', [0, h * 0.15, 0], [w, top, d]),
        part('Shelf 2', [0, h * 0.42, 0], [w, top, d], 'inner'),
        part('Shelf 3', [0, h * 0.69, 0], [w, top, d], 'inner'),
        part('Top', [0, h * 0.96, 0], [w, top, d]),
        part('Post FL', [-w * 0.46, h / 2, d * 0.43], [leg, h, leg], 'detail'),
        part('Post FR', [w * 0.46, h / 2, d * 0.43], [leg, h, leg], 'detail'),
        part('Post BL', [-w * 0.46, h / 2, -d * 0.43], [leg, h, leg], 'detail'),
        part('Post BR', [w * 0.46, h / 2, -d * 0.43], [leg, h, leg], 'detail'),
      ]
    case 'low-fridge':
      return [
        part('Body', [0, h / 2, 0], [w, h, d]),
        part('Top Door', [0, h * 0.68, d * 0.51], [w * 0.94, h * 0.5, d * 0.04], 'inner'),
        part('Bottom Door', [0, h * 0.28, d * 0.51], [w * 0.94, h * 0.28, d * 0.04], 'inner'),
        part('Handle', [w * 0.36, h * 0.5, d * 0.56], [w * 0.06, h * 0.55, d * 0.035], 'detail'),
      ]
    case 'low-workbench':
      return [
        part('Bench Top', [0, h * 0.62, 0], [w, h * 0.1, d]),
        part('Back Board', [0, h * 0.82, -d * 0.46], [w, h * 0.36, d * 0.08], 'inner'),
        part('Cabinet L', [-w * 0.32, h * 0.3, 0], [w * 0.26, h * 0.5, d * 0.72], 'inner'),
        part('Cabinet R', [w * 0.32, h * 0.3, 0], [w * 0.26, h * 0.5, d * 0.72], 'inner'),
      ]
    case 'low-storage-bin':
      return [
        part('Bin Body', [0, h * 0.42, 0], [w, h * 0.78, d]),
        part('Lid', [0, h * 0.86, 0], [w * 1.05, h * 0.12, d * 1.05], 'inner'),
        part('Front Lip', [0, h * 0.55, d * 0.52], [w * 0.72, h * 0.08, d * 0.06], 'detail'),
      ]
    default:
      return [part('Body', [0, h / 2, 0], [w, h, d])]
  }
}

interface LowPolyFurnitureProps {
  id: string
}

export function LowPolyFurniture({ id }: LowPolyFurnitureProps) {
  const furnitureData = useSpatialStore(state => state.furniture.find(f => f.id === id))
  const focusFurniture = useSpatialStore(state => state.focusFurniture)
  const setCameraTarget = useSpatialStore(state => state.setCameraTarget)
  const isFocused = useSpatialStore(state => state.focusedFurnitureId === id)
  const doubleClickDelay = useSpatialStore(state => state.doubleClickDelay)
  const assetDefinitions = useSpatialStore(state => state.assetDefinitions)

  const { onPointerDown, onPointerUp } = useRawPointerInteraction({
    onSingleClick: () => focusFurniture(id),
    onDoubleClick: () => setCameraTarget(id),
    doubleClickDelay
  })

  if (!furnitureData) return null

  const asset = assetDefinitions[furnitureData.modelId]
  const material = asset?.materials[0]
  const parts = useMemo(
    () => createLowPolyFurnitureParts(furnitureData.modelId, furnitureData.dimensions),
    [furnitureData.dimensions, furnitureData.modelId]
  )

  const getPartColor = (role: PrimitivePart['role']) => {
    if (role === 'inner') return holo.innerFill
    if (role === 'detail') return holo.itemFill
    return material?.color ?? holo.furnitureFill
  }

  const getPartEdge = (role: PrimitivePart['role']) => {
    if (isFocused) return holo.selectionEdge
    if (role === 'inner') return holo.innerEdge
    if (role === 'detail') return holo.itemEdge
    return holo.furnitureEdge
  }

  return (
    <group position={furnitureData.position} rotation={[0, furnitureData.rotation || 0, 0]} name={`furniture-${id}`}>
      {parts.map(item => (
        <mesh key={item.name} position={item.position} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          <boxGeometry args={item.size} />
          <meshBasicMaterial color={getPartColor(item.role)} transparent opacity={material?.opacity ?? 0.2} depthWrite={false} />
          <BoxOutline size={item.size} color={getPartEdge(item.role)} opacity={0.92} />
        </mesh>
      ))}
    </group>
  )
}


import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'
import { getFurnitureFootprint } from '../furnitureGeometry'

export function SnapFootprints() {
  const furniture = useSpatialStore(state => state.furniture)
  const focusedFurnitureId = useSpatialStore(state => state.focusedFurnitureId)
  const showSnapFootprints = useSpatialStore(state => state.showSnapFootprints)
  const draggingPosition = useSpatialStore(state => state.draggingPosition)

  const footprints = useMemo(() => {
    if (!showSnapFootprints) return null

    return furniture.map(item => {
      const footprint = getFurnitureFootprint({
        ...item,
        position: item.id === focusedFurnitureId && draggingPosition ? draggingPosition : item.position,
      })
      const points: [number, number, number][] = [
        [footprint.minX, 0.035, footprint.minZ],
        [footprint.maxX, 0.035, footprint.minZ],
        [footprint.maxX, 0.035, footprint.maxZ],
        [footprint.minX, 0.035, footprint.maxZ],
        [footprint.minX, 0.035, footprint.minZ],
      ]

      return (
        <Line
          key={item.id}
          points={points}
          color={item.id === focusedFurnitureId ? '#22c55e' : '#f59e0b'}
          lineWidth={1.25}
          transparent
          opacity={0.95}
          depthTest={false}
          renderOrder={9}
        />
      )
    })
  }, [draggingPosition, focusedFurnitureId, furniture, showSnapFootprints])

  return <>{footprints}</>
}

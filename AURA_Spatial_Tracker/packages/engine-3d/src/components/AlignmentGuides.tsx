import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'

export function AlignmentGuides() {
  const activeAlignments = useSpatialStore(state => state.activeAlignments)

  const lines = useMemo(() => {
    const extent = 2500
    return activeAlignments.map((guide, index) => {
      const points =
        guide.axis === 'X'
          ? [[guide.position, 0.018, -extent], [guide.position, 0.018, extent]]
          : [[-extent, 0.018, guide.position], [extent, 0.018, guide.position]]

      return (
        <Line
          key={`${guide.axis}-${guide.position}-${index}`}
          points={points as [number, number, number][]}
          color="#ef4444"
          lineWidth={1.5}
          dashed
          dashSize={1.5}
          gapSize={0.8}
          transparent
          opacity={0.9}
          depthTest={false}
          renderOrder={10}
        />
      )
    })
  }, [activeAlignments])

  return <>{lines}</>
}

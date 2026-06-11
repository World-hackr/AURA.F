import { Suspense } from 'react'
import { useSpatialStore } from '@aura/state-store'
import { LoadedShelf } from './components/LoadedShelf'
import { ParametricCabinet } from './components/ParametricCabinet'

export function SceneManager() {
  const furnitureList = useSpatialStore(state => state.furniture)

  return (
    <Suspense fallback={null}>
      {furnitureList.map(furniture => {
        if (furniture.modelId === 'shelf') {
          return <LoadedShelf key={furniture.id} id={furniture.id} />
        } else {
          // Default to the interactive cabinet
          return <ParametricCabinet key={furniture.id} id={furniture.id} />
        }
      })}
    </Suspense>
  )
}

import { useState } from 'react'
import { Search, PackagePlus, Box, Layers, Settings2, X, ArrowRight, Expand } from 'lucide-react'
import { useSpatialStore } from '@aura/state-store'

type AppMode = 'FIND' | 'EDIT'

export function CanvasUI() {
  const [mode, setMode] = useState<AppMode>('FIND')
  
  const searchQuery = useSpatialStore(state => state.searchQuery)
  const setSearchQuery = useSpatialStore(state => state.setSearchQuery)
  const focusFurniture = useSpatialStore(state => state.focusFurniture)
  const furniture = useSpatialStore(state => state.furniture)
  
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  const firstShelfId = furniture[0]?.id || ''
  const secondShelfId = furniture[1]?.id || ''

  const fakeResults = [
    { id: 1, name: 'Red LEDs (5mm)', location: 'Left Rack > Drawer 3', targetId: firstShelfId },
    { id: 2, name: '555 Timer IC', location: 'Right Rack > Small Bin', targetId: secondShelfId },
  ].filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleResultClick = (name: string, targetId: string) => {
    setSelectedItem(name)
    focusFurniture(targetId)
  }

  const handleResetCamera = () => {
    setSelectedItem(null)
    focusFurniture(null)
  }

  // We expose the Left and Right panels as separate functions so App.tsx can mount them in the fixed layout
  return null;
}

export function LeftPanel() {
  const [mode, setMode] = useState<AppMode>('FIND')
  const searchQuery = useSpatialStore(state => state.searchQuery)
  const setSearchQuery = useSpatialStore(state => state.setSearchQuery)
  const focusFurniture = useSpatialStore(state => state.focusFurniture)
  const furniture = useSpatialStore(state => state.furniture)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  const handleResultClick = (name: string, targetId: string) => {
    setSelectedItem(name)
    focusFurniture(targetId)
  }

  const fakeResults = [
    { id: 1, name: 'Red LEDs (5mm)', location: 'Left Rack > Drawer 3', targetId: furniture[0]?.id || '' },
    { id: 2, name: '555 Timer IC', location: 'Right Rack > Small Bin', targetId: furniture[1]?.id || '' },
  ].filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="sidebar">
       <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button style={{ flex: 1, padding: '10px', background: mode==='FIND'?'#fff':'#111', color: mode==='FIND'?'#000':'#fff', border: '1px solid #333', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setMode('FIND')}>FIND</button>
          <button style={{ flex: 1, padding: '10px', background: mode==='EDIT'?'#fff':'#111', color: mode==='EDIT'?'#000':'#fff', border: '1px solid #333', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setMode('EDIT')}>EDIT</button>
       </div>

      {mode === 'FIND' ? (
        <>
          <h2>Search Inventory</h2>
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="e.g. 'LED' or '555'" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="results-list">
            {searchQuery.length > 0 && fakeResults.map((res) => (
              <div key={res.id} className="result-item" onClick={() => handleResultClick(res.name, res.targetId)}>
                <h4>{res.name}</h4>
                <p><ArrowRight size={12} /> {res.location}</p>
              </div>
            ))}
            {searchQuery.length > 0 && fakeResults.length === 0 && (
              <p className="no-results">No items found.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <h2>Furniture Catalog</h2>
          <p className="subtitle">Drag into the room</p>
          <div className="catalog-grid">
            <div className="catalog-item">
              <Layers size={32} />
              <span>Rack</span>
            </div>
            <div className="catalog-item">
              <Box size={32} />
              <span>Box</span>
            </div>
            <div className="catalog-item">
              <PackagePlus size={32} />
              <span>Pouch</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function RightPanel() {
  const focusedFurnitureId = useSpatialStore(state => state.focusedFurnitureId)
  const focusFurniture = useSpatialStore(state => state.focusFurniture)

  if (!focusedFurnitureId) {
    return (
      <div className="sidebar" style={{ justifyContent: 'center', alignItems: 'center', color: '#444' }}>
        <p>Select a container to view properties.</p>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Details</h2>
        <button className="close-btn" onClick={() => focusFurniture(null)}>
          <X size={20} />
        </button>
      </div>
      
      <div className="property-group">
        <label>Target Container</label>
        <input type="text" readOnly value="Selected Drawer" />
      </div>
      
      <div className="property-group">
        <label>Contents</label>
        <ul className="contents-list">
          <li>Item inside (Qty: 100)</li>
        </ul>
      </div>

      <div className="property-group" style={{ marginTop: 'auto' }}>
        <button className="reset-camera-btn" style={{ position: 'relative', left: '0', transform: 'none', width: '100%', marginTop: '20px' }} onClick={() => focusFurniture(null)}>
          <Expand size={20} /> Reset View
        </button>
      </div>
    </div>
  )
}


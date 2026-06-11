import { useState } from 'react';
import { Search, Layers, Box, Maximize, Rotate3D, Plus } from 'lucide-react';
import { useSpatialStore } from '@aura/state-store';
import type { Container } from '@aura/state-store';

export function LeftPanel() {
  const [tab, setTab] = useState<'SEARCH' | 'FURNITURE'>('SEARCH');
  const searchQuery = useSpatialStore(state => state.searchQuery);
  const setSearchQuery = useSpatialStore(state => state.setSearchQuery);
  const addFurniture = useSpatialStore(state => state.addFurniture);
  const focusFurniture = useSpatialStore(state => state.focusFurniture);
  const selectContainer = useSpatialStore(state => state.selectContainer);
  const searchResults = useSpatialStore(state => state.getSearchResults());
  
  const handleResultClick = (furnitureId: string, containerId: string) => {
    focusFurniture(furnitureId);
    selectContainer(containerId);
  }

  const spawnFurniture = (type: string) => {
    // Spawn in the center of the room (roughly 0, 0, 0)
    // We add slight randomness so multiple spawns don't perfectly overlap
    const randomOffset = Math.floor(Math.random() * 4) - 2;
    addFurniture(type, [randomOffset, 0, randomOffset]);
  }

  return (
    <div className="panel left-panel">
      <div className="panel-tabs">
        <button className={`tab-btn ${tab === 'SEARCH' ? 'active' : ''}`} onClick={() => setTab('SEARCH')}>Search</button>
        <button className={`tab-btn ${tab === 'FURNITURE' ? 'active' : ''}`} onClick={() => setTab('FURNITURE')}>Furniture</button>
      </div>

      <div className="panel-content">
        {tab === 'SEARCH' && (
          <>
            <div className="input-group">
              <div className="search-container">
                <Search size={16} />
                <input 
                  type="text" 
                  className="text-input" 
                  placeholder="Find item or location..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="item-list">
              {searchResults.map(res => (
                <div key={res.item.id} className="list-item" onClick={() => handleResultClick(res.furnitureId, res.containerId)}>
                  <p className="list-item-title">{res.item.name}</p>
                  <p className="list-item-subtitle">{res.furnitureName} &gt; {res.containerName} · Qty {res.item.quantity}</p>
                </div>
              ))}
              {searchQuery.length > 0 && searchResults.length === 0 && (
                <p style={{ color: '#888', fontStyle: 'italic' }}>No items found.</p>
              )}
              {searchQuery.length === 0 && (
                <p style={{ color: '#666', fontSize: '0.8rem', lineHeight: 1.5 }}>Search item names or tags after adding containers and items in the inspector.</p>
              )}
            </div>
          </>
        )}

        {tab === 'FURNITURE' && (
          <div className="catalog-grid">
            <div className="catalog-card" onClick={() => spawnFurniture('parametric')}>
              <Layers size={24} />
              <span>Cabinet</span>
            </div>
            <div className="catalog-card" onClick={() => spawnFurniture('shelf')}>
              <Box size={24} />
              <span>Metal Shelf</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RightPanel() {
  const focusedFurnitureId = useSpatialStore(state => state.focusedFurnitureId);
  const selectedContainerId = useSpatialStore(state => state.selectedContainerId);
  const furniture = useSpatialStore(state => state.furniture);
  const updateFurnitureDimensions = useSpatialStore(state => state.updateFurnitureDimensions);
  const updateFurnitureName = useSpatialStore(state => state.updateFurnitureName);
  const addContainer = useSpatialStore(state => state.addContainer);
  const addItem = useSpatialStore(state => state.addItem);
  const selectContainer = useSpatialStore(state => state.selectContainer);
  const [containerName, setContainerName] = useState('');
  const [containerType, setContainerType] = useState<Container['type']>('drawer');
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);

  // Find the exact object the user clicked on
  const selectedObj = furniture.find(f => f.id === focusedFurnitureId);
  const selectedContainer = selectedObj?.containers.find(c => c.id === selectedContainerId) ?? null;

  if (!selectedObj) {
    return (
      <div className="panel right-panel">
        <div className="panel-header">Inspector</div>
        <div className="panel-content" style={{ alignItems: 'center', justifyContent: 'center', color: '#555' }}>
          Select an object in the room to edit its properties.
        </div>
      </div>
    );
  }

  return (
    <div className="panel right-panel">
      <div className="panel-header">Inspector</div>
      
      <div className="panel-content">
        <div className="input-group">
          <label>Name</label>
          <input
            type="text"
            className="text-input"
            value={selectedObj.name}
            onChange={(e) => updateFurnitureName(selectedObj.id, e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Dimensions (W x H x D)</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input 
              type="number" 
              className="text-input" 
              value={selectedObj.dimensions[0]} 
              onChange={(e) => updateFurnitureDimensions(selectedObj.id, [Number(e.target.value), selectedObj.dimensions[1], selectedObj.dimensions[2]])}
              style={{ width: '100%' }} 
            />
            <input 
              type="number" 
              className="text-input" 
              value={selectedObj.dimensions[1]} 
              onChange={(e) => updateFurnitureDimensions(selectedObj.id, [selectedObj.dimensions[0], Number(e.target.value), selectedObj.dimensions[2]])}
              style={{ width: '100%' }} 
            />
            <input 
              type="number" 
              className="text-input" 
              value={selectedObj.dimensions[2]} 
              onChange={(e) => updateFurnitureDimensions(selectedObj.id, [selectedObj.dimensions[0], selectedObj.dimensions[1], Number(e.target.value)])}
              style={{ width: '100%' }} 
            />
          </div>
        </div>

        <div className="input-group">
          <label>Position (X, Y, Z)</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input type="number" className="text-input" readOnly value={selectedObj.position[0]} style={{ width: '100%' }} />
            <input type="number" className="text-input" readOnly value={selectedObj.position[1]} style={{ width: '100%' }} />
            <input type="number" className="text-input" readOnly value={selectedObj.position[2]} style={{ width: '100%' }} />
          </div>
        </div>

        <hr style={{ border: '0', borderTop: '1px solid #333', margin: '10px 0' }} />

        <div className="input-group">
          <label>Containers inside ({selectedObj.containers.length})</label>
          <div className="item-list">
            {selectedObj.containers.length === 0 ? (
               <p style={{ fontSize: '0.8rem', color: '#666' }}>No containers added yet.</p>
            ) : (
              selectedObj.containers.map((c: Container) => (
                <div
                  key={c.id}
                  className="list-item"
                  onClick={() => selectContainer(c.id)}
                  style={{ borderColor: c.id === selectedContainerId ? '#3b82f6' : undefined }}
                >
                  <p className="list-item-title">{c.name}</p>
                  <p className="list-item-subtitle">{c.items.length} Items inside</p>
                </div>
              ))
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginTop: '10px' }}>
            <input
              className="text-input"
              value={containerName}
              placeholder="Container name"
              onChange={(e) => setContainerName(e.target.value)}
            />
            <select
              className="text-input"
              value={containerType}
              onChange={(e) => setContainerType(e.target.value as Container['type'])}
            >
              <option value="drawer">Drawer</option>
              <option value="bin">Bin</option>
              <option value="box">Box</option>
              <option value="pouch">Pouch</option>
            </select>
          </div>
          <button
            className="action-btn"
            style={{ justifyContent: 'center', marginTop: '10px' }}
            onClick={() => {
              const name = containerName.trim();
              if (!name) return;
              addContainer(selectedObj.id, name, containerType);
              setContainerName('');
            }}
          >
            <Plus size={16} /> Add Container
          </button>
        </div>

        {selectedContainer && (
          <div className="input-group">
            <label>Add item to {selectedContainer.name}</label>
            <input
              className="text-input"
              value={itemName}
              placeholder="Item name"
              onChange={(e) => setItemName(e.target.value)}
            />
            <input
              type="number"
              min="1"
              className="text-input"
              value={itemQuantity}
              onChange={(e) => setItemQuantity(Math.max(1, Number(e.target.value)))}
            />
            <button
              className="action-btn"
              style={{ justifyContent: 'center' }}
              onClick={() => {
                const name = itemName.trim();
                if (!name) return;
                addItem(selectedObj.id, selectedContainer.id, name, itemQuantity);
                setItemName('');
                setItemQuantity(1);
              }}
            >
              <Plus size={16} /> Add Item
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CenterOverlays() {
  const setCameraView = useSpatialStore(state => state.setCameraView)
  const cameraProjection = useSpatialStore(state => state.cameraProjection)
  const setCameraProjection = useSpatialStore(state => state.setCameraProjection)
  const gridOpacity = useSpatialStore(state => state.gridOpacity)
  const setGridOpacity = useSpatialStore(state => state.setGridOpacity)
  const focusFurniture = useSpatialStore(state => state.focusFurniture)

  const toggleProjection = () => {
    setCameraProjection(cameraProjection === 'PERSPECTIVE' ? 'ORTHOGRAPHIC' : 'PERSPECTIVE')
  }

  const handleReset = () => {
    focusFurniture(null); // Unfocus object
    setCameraView('ISO'); // Return camera to default angle
  }

  return (
    <>
      <div className="canvas-overlay-top-left" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span>Room Bounds: 40 x 40 units</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '4px' }}>
          <label style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Grid</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.1" 
            value={gridOpacity} 
            onChange={(e) => setGridOpacity(parseFloat(e.target.value))} 
            style={{ width: '80px', cursor: 'pointer' }}
          />
        </div>
      </div>
      <div className="canvas-overlay-bottom-right" style={{ display: 'flex', gap: '8px' }}>
        <button className="action-btn" onClick={toggleProjection} style={{ marginRight: '20px', border: '1px solid #3b82f6', color: '#3b82f6' }}>
          <Rotate3D size={16} /> {cameraProjection === 'PERSPECTIVE' ? 'Persp' : 'Ortho'}
        </button>
        <button className="action-btn" onClick={() => setCameraView('TOP')}>
          Top
        </button>
        <button className="action-btn" onClick={() => setCameraView('FRONT')}>
          Front
        </button>
        <button className="action-btn" onClick={() => setCameraView('ISO')}>
          Iso
        </button>
        <button className="action-btn" onClick={handleReset} style={{ marginLeft: '10px', backgroundColor: '#333' }}>
          <Maximize size={16} /> Reset View
        </button>
      </div>
    </>
  );
}

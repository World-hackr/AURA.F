import { useState, useMemo, type ReactNode } from 'react';
import { Search, Layers, Box, Rotate3D, Plus, Trash2 } from 'lucide-react';
import { hologramMaterialSwatches, useSpatialStore } from '@aura/state-store';
import type { AuraAssetDefinition, Container, Item } from '@aura/state-store';

type SearchResult = {
  item: Item;
  containerName: string;
  furnitureName: string;
  furnitureId: string;
  containerId: string;
};

type LeftPanelProps = {
  onOpenAssets: () => void;
};

export function LeftPanel({ onOpenAssets }: LeftPanelProps) {
  const [tab, setTab] = useState<'SEARCH' | 'FURNITURE'>('SEARCH');
  const searchQuery = useSpatialStore(state => state.searchQuery);
  const setSearchQuery = useSpatialStore(state => state.setSearchQuery);
  const focusFurniture = useSpatialStore(state => state.focusFurniture);
  const setCameraTarget = useSpatialStore(state => state.setCameraTarget);
  const selectContainer = useSpatialStore(state => state.selectContainer);
  const furniture = useSpatialStore(state => state.furniture);
  const assetDefinitions = useSpatialStore(state => state.assetDefinitions);
  const doubleClickDelay = useSpatialStore(state => state.doubleClickDelay);
  const setDoubleClickDelay = useSpatialStore(state => state.setDoubleClickDelay);
  const pendingPlacementModelId = useSpatialStore(state => state.pendingPlacementModelId);
  const setPendingPlacementModelId = useSpatialStore(state => state.setPendingPlacementModelId);
  const testFurnitureAssets = useMemo(
    () => Object.values(assetDefinitions).filter(asset => asset.id.startsWith('low-')),
    [assetDefinitions]
  );
  const importedFurnitureAssets = useMemo(
    () => Object.values(assetDefinitions).filter(asset => Boolean(asset.sourceStorageKey)),
    [assetDefinitions]
  );
  
  // Calculate search results safely without triggering infinite loop
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const results: SearchResult[] = [];
    const lowerQuery = searchQuery.toLowerCase();
    furniture.forEach(f => {
      f.containers.forEach(c => {
        c.items.forEach(i => {
          if (i.name.toLowerCase().includes(lowerQuery) || i.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
            results.push({ item: i, containerName: c.name, furnitureName: f.name, furnitureId: f.id, containerId: c.id });
          }
        });
      });
    });
    return results;
  }, [furniture, searchQuery]);
  
  const handleResultClick = (furnitureId: string, containerId: string) => {
    focusFurniture(furnitureId);
    setCameraTarget(furnitureId); // Swoop on search click
    selectContainer(containerId);
  }

  const startPlacement = (type: string) => {
    setPendingPlacementModelId(pendingPlacementModelId === type ? null : type);
  }

  const catalogCardClass = (type: string) =>
    `catalog-card ${pendingPlacementModelId === type ? 'active' : ''}`;

  return (
    <div className="panel left-panel">
      <div className="panel-tabs">
        <button className={`tab-btn ${tab === 'SEARCH' ? 'active' : ''}`} onClick={() => setTab('SEARCH')}>Search</button>
        <button className={`tab-btn ${tab === 'FURNITURE' ? 'active' : ''}`} onClick={() => setTab('FURNITURE')}>Furniture</button>
        <button className="tab-btn" onClick={onOpenAssets}>Assets</button>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>Architecture (Structural)</div>
              <div className="catalog-grid">
                <div className={catalogCardClass('wall-single')} onClick={() => startPlacement('wall-single')}>
                  <Box size={24} />
                  <span style={{ fontSize: '0.7rem', textAlign: 'center' }}>Single Brick Wall<br/>(4.5")</span>
                </div>
                <div className={catalogCardClass('wall-double')} onClick={() => startPlacement('wall-double')}>
                  <Box size={24} />
                  <span style={{ fontSize: '0.7rem', textAlign: 'center' }}>Double Brick Wall<br/>(9")</span>
                </div>
                <div className={catalogCardClass('i-beam')} onClick={() => startPlacement('i-beam')}>
                  <Layers size={24} />
                  <span style={{ fontSize: '0.7rem', textAlign: 'center' }}>Iron I-Beam<br/>(Girder)</span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>Furniture & Storage</div>
              <div className="catalog-grid">
                <div className={catalogCardClass('parametric')} onClick={() => startPlacement('parametric')}>
                  <Layers size={24} />
                  <span>Cabinet</span>
                </div>
                <div className={catalogCardClass('shelf')} onClick={() => startPlacement('shelf')}>
                  <Box size={24} />
                  <span>Metal Shelf</span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>Low Poly Test Set</div>
              <div className="catalog-grid">
                {testFurnitureAssets.map(asset => (
                  <div className={catalogCardClass(asset.id)} key={asset.id} onClick={() => startPlacement(asset.id)}>
                    <Box size={24} />
                    <span>{asset.displayName}</span>
                  </div>
                ))}
              </div>
            </div>

            {importedFurnitureAssets.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>Imported Assets</div>
                <div className="catalog-grid">
                  {importedFurnitureAssets.map(asset => (
                    <div className={catalogCardClass(asset.id)} key={asset.id} onClick={() => startPlacement(asset.id)}>
                      <Box size={24} />
                      <span>{asset.displayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid #333' }}>
           <div className="input-group">
             <label style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>Double-Tap Speed (ms)</label>
             <input 
                type="number" 
                className="text-input" 
                value={doubleClickDelay}
                onChange={(e) => setDoubleClickDelay(Number(e.target.value))}
                step={50}
                min={50}
             />
           </div>
        </div>
      </div>
    </div>
  );
}

export function AssetEditor() {
  const [category, setCategory] = useState<'setup' | 'bounds' | 'parts' | 'materials'>('setup');
  const assetDefinitions = useSpatialStore(state => state.assetDefinitions);
  const selectedAssetDefinitionId = useSpatialStore(state => state.selectedAssetDefinitionId);
  const setSelectedAssetDefinitionId = useSpatialStore(state => state.setSelectedAssetDefinitionId);
  const updateAssetDefinition = useSpatialStore(state => state.updateAssetDefinition);
  const updateAssetFootprint = useSpatialStore(state => state.updateAssetFootprint);
  const updateAssetCollisionBox = useSpatialStore(state => state.updateAssetCollisionBox);
  const updateAssetSnapPoint = useSpatialStore(state => state.updateAssetSnapPoint);
  const updateAssetPart = useSpatialStore(state => state.updateAssetPart);
  const updateAssetMaterial = useSpatialStore(state => state.updateAssetMaterial);
  const setShowSnapFootprints = useSpatialStore(state => state.setShowSnapFootprints);

  const assets = Object.values(assetDefinitions);
  const selectedAsset = assetDefinitions[selectedAssetDefinitionId] ?? assets[0];

  const updateVector = (values: [number, number, number], axis: 0 | 1 | 2, value: string): [number, number, number] => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return values;
    const next = [...values] as [number, number, number];
    next[axis] = Math.round(parsed * 1000) / 1000;
    return next;
  };

  const updateFootprintNumber = (field: 'width' | 'depth', value: string) => {
    if (!selectedAsset) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    updateAssetFootprint(selectedAsset.id, {
      ...selectedAsset.footprint,
      [field]: Math.max(0.01, Math.round(parsed * 1000) / 1000),
    });
    setShowSnapFootprints(true);
  };

  const updateFootprintOffset = (axis: 0 | 1, value: string) => {
    if (!selectedAsset) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const nextOffset = [...selectedAsset.footprint.offset] as [number, number];
    nextOffset[axis] = Math.round(parsed * 1000) / 1000;
    updateAssetFootprint(selectedAsset.id, {
      ...selectedAsset.footprint,
      offset: nextOffset,
    });
    setShowSnapFootprints(true);
  };

  const addPartFromNode = (nodeName: string) => {
    if (!selectedAsset) return;
    const existingPart = selectedAsset.parts.find(part => part.meshName === nodeName);
    if (existingPart) {
      setCategory('parts');
      return;
    }

    const partIdBase = nodeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'part';
    updateAssetDefinition(selectedAsset.id, {
      parts: [
        ...selectedAsset.parts,
        {
          id: `${partIdBase}-${selectedAsset.parts.length + 1}`,
          name: nodeName,
          meshName: nodeName,
          motion: 'slide',
          axis: [0, 0, 1],
          closedOffset: 0,
          openOffset: Math.max(0.25, Math.round(selectedAsset.defaultDimensions[2] * 0.6 * 100) / 100),
        },
      ],
    });
    setCategory('parts');
  };

  if (!selectedAsset) {
    return <p style={{ color: '#666', fontSize: '0.8rem', lineHeight: 1.5 }}>No asset definitions found.</p>;
  }

  return (
    <div className="asset-editor">
      <div className="asset-tool-tabs">
        <button className={`asset-tool-tab ${category === 'setup' ? 'active' : ''}`} onClick={() => setCategory('setup')}>Setup</button>
        <button className={`asset-tool-tab ${category === 'bounds' ? 'active' : ''}`} onClick={() => setCategory('bounds')}>Bounds</button>
        <button className={`asset-tool-tab ${category === 'parts' ? 'active' : ''}`} onClick={() => setCategory('parts')}>Parts</button>
        <button className={`asset-tool-tab ${category === 'materials' ? 'active' : ''}`} onClick={() => setCategory('materials')}>Look</button>
      </div>

      {category === 'setup' && (
        <>
          <div className="input-group">
            <label>Furniture Asset</label>
            <select className="text-input" value={selectedAsset.id} onChange={(e) => setSelectedAssetDefinitionId(e.target.value)}>
              {assets.map(asset => (
                <option key={asset.id} value={asset.id}>{asset.displayName}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Display Name</label>
            <input className="text-input" value={selectedAsset.displayName} onChange={(e) => updateAssetDefinition(selectedAsset.id, { displayName: e.target.value })} />
          </div>

          <AssetVectorEditor
            label="Default Size"
            value={selectedAsset.defaultDimensions}
            onChange={(axis, value) => updateAssetDefinition(selectedAsset.id, {
              defaultDimensions: updateVector(selectedAsset.defaultDimensions, axis, value),
            })}
          />

          <AssetSection title="Detected Nodes" count={selectedAsset.meshNodes?.length ?? 0}>
            {(selectedAsset.meshNodes ?? []).slice(0, 40).map(node => (
              <div key={node.id} className="list-item" style={{ cursor: 'default' }}>
                <p className="list-item-title">{node.name}</p>
                <p className="list-item-subtitle">{node.type}{node.parentName ? ` - ${node.parentName}` : ''}</p>
                {node.type === 'mesh' && (
                  <button className="mini-action-btn" type="button" onClick={() => addPartFromNode(node.name)}>
                    Add Part
                  </button>
                )}
              </div>
            ))}
          </AssetSection>
        </>
      )}

      {category === 'bounds' && (
        <>
          <div className="input-group">
            <label>Footprint Width / Depth</label>
            <div className="asset-two-column">
              <input className="text-input" type="number" step={0.05} min={0.01} value={selectedAsset.footprint.width} onChange={(e) => updateFootprintNumber('width', e.target.value)} />
              <input className="text-input" type="number" step={0.05} min={0.01} value={selectedAsset.footprint.depth} onChange={(e) => updateFootprintNumber('depth', e.target.value)} />
            </div>
          </div>

          <div className="input-group">
            <label>Footprint Offset X / Z</label>
            <div className="asset-two-column">
              <input className="text-input" type="number" step={0.05} value={selectedAsset.footprint.offset[0]} onChange={(e) => updateFootprintOffset(0, e.target.value)} />
              <input className="text-input" type="number" step={0.05} value={selectedAsset.footprint.offset[1]} onChange={(e) => updateFootprintOffset(1, e.target.value)} />
            </div>
          </div>

          <AssetSection title="Collision Bounds" count={selectedAsset.collision.length}>
            {selectedAsset.collision.map(box => (
              <div key={box.id} className="list-item" style={{ cursor: 'default' }}>
                <p className="list-item-title">{box.name}</p>
                <AssetVectorEditor label="Center" value={box.center} onChange={(axis, value) => updateAssetCollisionBox(selectedAsset.id, box.id, { center: updateVector(box.center, axis, value) })} />
                <AssetVectorEditor label="Size" value={box.size} onChange={(axis, value) => updateAssetCollisionBox(selectedAsset.id, box.id, { size: updateVector(box.size, axis, value) })} />
              </div>
            ))}
          </AssetSection>

          <AssetSection title="Snap Points" count={selectedAsset.snapPoints.length}>
            {selectedAsset.snapPoints.map(point => (
              <div key={point.id} className="list-item" style={{ cursor: 'default' }}>
                <p className="list-item-title">{point.name}</p>
                <AssetVectorEditor label="Position" value={point.position} onChange={(axis, value) => updateAssetSnapPoint(selectedAsset.id, point.id, { position: updateVector(point.position, axis, value) })} />
              </div>
            ))}
          </AssetSection>
        </>
      )}

      {category === 'parts' && (
        <AssetSection title="Movable Parts" count={selectedAsset.parts.length}>
          {selectedAsset.parts.map(part => (
            <div key={part.id} className="list-item" style={{ cursor: 'default' }}>
              <p className="list-item-title">{part.name}</p>
              <p className="list-item-subtitle">{part.meshName ? `Mesh: ${part.meshName}` : 'No mesh assigned'}</p>
              <div className="input-group" style={{ marginTop: '8px' }}>
                <label>Motion</label>
                <select
                  className="text-input"
                  value={part.motion}
                  onChange={(e) => updateAssetPart(selectedAsset.id, part.id, { motion: e.target.value as 'static' | 'slide' | 'rotate' })}
                >
                  <option value="static">Static</option>
                  <option value="slide">Slide</option>
                  <option value="rotate">Rotate</option>
                </select>
              </div>
              <AssetVectorEditor label="Axis" value={part.axis} onChange={(axis, value) => updateAssetPart(selectedAsset.id, part.id, { axis: updateVector(part.axis, axis, value) })} />
              <div className="asset-two-column" style={{ marginTop: '8px' }}>
                <input className="text-input" type="number" step={0.05} value={part.closedOffset} onChange={(e) => {
                  const parsed = Number(e.target.value);
                  if (Number.isFinite(parsed)) updateAssetPart(selectedAsset.id, part.id, { closedOffset: parsed });
                }} />
                <input className="text-input" type="number" step={0.05} value={part.openOffset} onChange={(e) => {
                  const parsed = Number(e.target.value);
                  if (Number.isFinite(parsed)) updateAssetPart(selectedAsset.id, part.id, { openOffset: parsed });
                }} />
              </div>
            </div>
          ))}
        </AssetSection>
      )}

      {category === 'materials' && (
        <AssetSection title="Materials" count={selectedAsset.materials.length}>
          {selectedAsset.materials.map(material => (
            <MaterialEditor key={material.id} asset={selectedAsset} materialId={material.id} onUpdate={updateAssetMaterial} />
          ))}
        </AssetSection>
      )}
    </div>
  );
}

function AssetVectorEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number, number];
  onChange: (axis: 0 | 1 | 2, value: string) => void;
}) {
  return (
    <div className="input-group">
      <label>{label} X / Y / Z</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
        <input className="text-input" type="number" step={0.05} min={0.01} value={value[0]} onChange={(e) => onChange(0, e.target.value)} />
        <input className="text-input" type="number" step={0.05} min={0.01} value={value[1]} onChange={(e) => onChange(1, e.target.value)} />
        <input className="text-input" type="number" step={0.05} min={0.01} value={value[2]} onChange={(e) => onChange(2, e.target.value)} />
      </div>
    </div>
  );
}

function AssetSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="input-group">
      <label>{title} ({count})</label>
      <div className="item-list">
        {count > 0 ? children : <p style={{ color: '#666', fontSize: '0.8rem', margin: 0 }}>None defined yet.</p>}
      </div>
    </div>
  );
}

function MaterialEditor({
  asset,
  materialId,
  onUpdate,
}: {
  asset: AuraAssetDefinition;
  materialId: string;
  onUpdate: (assetId: string, materialId: string, patch: Partial<AuraAssetDefinition['materials'][number]>) => void;
}) {
  const material = asset.materials.find(item => item.id === materialId);
  if (!material) return null;

  const minOpacity = asset.sourceStorageKey ? 0.08 : 0;
  const opacityValue = Math.max(minOpacity, Math.min(1, material.opacity));

  return (
    <div className="list-item" style={{ cursor: 'default' }}>
      <p className="list-item-title">{material.target}</p>
      <div className="material-swatch-grid">
        {hologramMaterialSwatches.map(swatch => (
          <button
            key={swatch.color}
            className={`material-swatch ${material.color.toLowerCase() === swatch.color.toLowerCase() ? 'active' : ''}`}
            onClick={() => onUpdate(asset.id, material.id, { color: swatch.color })}
            title={swatch.name}
            type="button"
          >
            <span style={{ backgroundColor: swatch.color }} />
          </button>
        ))}
      </div>
      <div className="material-opacity-row">
        <input
          type="range"
          min={minOpacity}
          max={1}
          step={0.01}
          value={opacityValue}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (Number.isFinite(parsed)) onUpdate(asset.id, material.id, { opacity: Math.max(minOpacity, Math.min(1, parsed)) });
          }}
        />
        <span className="opacity-value">{Math.round(opacityValue * 100)}%</span>
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
  const updateFurniturePosition = useSpatialStore(state => state.updateFurniturePosition);
  const updateFurnitureRotation = useSpatialStore(state => state.updateFurnitureRotation);
  const removeFurniture = useSpatialStore(state => state.removeFurniture);
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

  const updateDimensionAxis = (axis: 0 | 1 | 2, value: string) => {
    if (!selectedObj) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const next = [...selectedObj.dimensions] as [number, number, number];
    next[axis] = parsed;
    updateFurnitureDimensions(selectedObj.id, next);
  }

  const updatePositionAxis = (axis: 0 | 1 | 2, value: string) => {
    if (!selectedObj) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const next = [...selectedObj.position] as [number, number, number];
    next[axis] = parsed;
    updateFurniturePosition(selectedObj.id, next);
  }

  const rotationDegrees = selectedObj ? Math.round(((selectedObj.rotation || 0) * 180 / Math.PI) * 10) / 10 : 0;

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
              onChange={(e) => updateDimensionAxis(0, e.target.value)}
              min={0.1}
              step={0.1}
              style={{ width: '100%' }} 
            />
            <input 
              type="number" 
              className="text-input" 
              value={selectedObj.dimensions[1]} 
              onChange={(e) => updateDimensionAxis(1, e.target.value)}
              min={0.1}
              step={0.1}
              style={{ width: '100%' }} 
            />
            <input 
              type="number" 
              className="text-input" 
              value={selectedObj.dimensions[2]} 
              onChange={(e) => updateDimensionAxis(2, e.target.value)}
              min={0.1}
              step={0.1}
              style={{ width: '100%' }} 
            />
          </div>
        </div>

        <div className="input-group">
          <label>Position (X, Y, Z)</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input type="number" className="text-input" value={selectedObj.position[0]} onChange={(e) => updatePositionAxis(0, e.target.value)} step={0.25} style={{ width: '100%' }} />
            <input type="number" className="text-input" value={selectedObj.position[1]} onChange={(e) => updatePositionAxis(1, e.target.value)} step={0.25} style={{ width: '100%' }} />
            <input type="number" className="text-input" value={selectedObj.position[2]} onChange={(e) => updatePositionAxis(2, e.target.value)} step={0.25} style={{ width: '100%' }} />
          </div>
        </div>

        <div className="input-group">
          <label>Rotation Y (degrees)</label>
          <input
            type="number"
            className="text-input"
            value={rotationDegrees}
            step={15}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (!Number.isFinite(parsed)) return;
              updateFurnitureRotation(selectedObj.id, parsed * Math.PI / 180);
            }}
          />
        </div>

        <button
          className="action-btn"
          style={{ justifyContent: 'center', borderColor: '#7f1d1d', color: '#fca5a5' }}
          onClick={() => removeFurniture(selectedObj.id)}
        >
          <Trash2 size={16} /> Delete Object
        </button>

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
  const cameraProjection = useSpatialStore(state => state.cameraProjection)
  const setCameraProjection = useSpatialStore(state => state.setCameraProjection)
  const abyssDarkness = useSpatialStore(state => state.abyssDarkness)
  const setBackgroundDarkness = useSpatialStore(state => state.setBackgroundDarkness)
  const gizmoMode = useSpatialStore(state => state.gizmoMode)
  const setGizmoMode = useSpatialStore(state => state.setGizmoMode)
  const isSnappingEnabled = useSpatialStore(state => state.isSnappingEnabled)
  const setIsSnappingEnabled = useSpatialStore(state => state.setIsSnappingEnabled)
  const showSnapFootprints = useSpatialStore(state => state.showSnapFootprints)
  const setShowSnapFootprints = useSpatialStore(state => state.setShowSnapFootprints)
  const pendingPlacementModelId = useSpatialStore(state => state.pendingPlacementModelId)
  const assetDefinitions = useSpatialStore(state => state.assetDefinitions)
  const setPendingPlacementModelId = useSpatialStore(state => state.setPendingPlacementModelId)
  const pendingAssetName = pendingPlacementModelId
    ? assetDefinitions[pendingPlacementModelId]?.displayName ?? pendingPlacementModelId
    : null

  const toggleProjection = () => {
    setCameraProjection(cameraProjection === 'PERSPECTIVE' ? 'ORTHOGRAPHIC' : 'PERSPECTIVE')
  }

  return (
    <>
      <div className="canvas-overlay-top-left" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontWeight: 'bold', color: '#3b82f6', letterSpacing: '2px', textTransform: 'uppercase' }}>The Abyss</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '4px' }}>
          <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', width: '40px' }}>Floor</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            value={abyssDarkness} 
            onChange={(e) => setBackgroundDarkness(parseFloat(e.target.value))} 
            style={{ width: '80px', cursor: 'pointer' }}
          />
        </div>
        {pendingAssetName && (
          <div className="placement-status">
            <strong>Placing {pendingAssetName}</strong>
            <span>Move over the floor, click to place.</span>
            <button type="button" onClick={() => setPendingPlacementModelId(null)}>Cancel</button>
          </div>
        )}
      </div>
      <div className="canvas-overlay-bottom-right" style={{ display: 'flex', gap: '8px' }}>
        {/* Gizmo Tools */}
        <div style={{ display: 'flex', gap: '4px', marginRight: '20px', background: 'rgba(0,0,0,0.5)', padding: '4px', borderRadius: '4px' }}>
          <button 
            className="action-btn" 
            onClick={() => setIsSnappingEnabled(!isSnappingEnabled)} 
            style={{ backgroundColor: isSnappingEnabled ? '#ef4444' : 'transparent', color: isSnappingEnabled ? 'white' : '#888', marginRight: '8px', borderRight: '1px solid #555', paddingRight: '12px' }}
            title="Toggle Magnetic Snapping"
          >
            Magnet
          </button>
          <button 
            className="action-btn" 
            onClick={() => setShowSnapFootprints(!showSnapFootprints)} 
            style={{ backgroundColor: showSnapFootprints ? '#f59e0b' : 'transparent', color: showSnapFootprints ? 'white' : '#888', marginRight: '8px' }}
            title="Show Snap Footprints"
          >
            Bounds
          </button>
          <button 
            className="action-btn" 
            onClick={() => setGizmoMode('translate')} 
            style={{ backgroundColor: gizmoMode === 'translate' ? '#3b82f6' : 'transparent', color: gizmoMode === 'translate' ? 'white' : '#888' }}
          >
            Move
          </button>
          <button 
            className="action-btn" 
            onClick={() => setGizmoMode('rotate')} 
            style={{ backgroundColor: gizmoMode === 'rotate' ? '#3b82f6' : 'transparent', color: gizmoMode === 'rotate' ? 'white' : '#888' }}
          >
            Rotate
          </button>
          <button 
            className="action-btn" 
            onClick={() => setGizmoMode('scale')} 
            style={{ backgroundColor: gizmoMode === 'scale' ? '#3b82f6' : 'transparent', color: gizmoMode === 'scale' ? 'white' : '#888' }}
          >
            Resize
          </button>
        </div>

        <button className="action-btn" onClick={toggleProjection} style={{ marginRight: '20px', border: '1px solid #3b82f6', color: '#3b82f6' }}>
          <Rotate3D size={16} /> {cameraProjection === 'PERSPECTIVE' ? 'Persp' : 'Ortho'}
        </button>
      </div>
    </>
  );
}

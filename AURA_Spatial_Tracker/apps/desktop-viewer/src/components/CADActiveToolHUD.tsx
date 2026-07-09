import { useSpatialStore } from '@aura/state-store';
import { X, Info } from 'lucide-react';

interface ToolConfig {
  name: string;
  shortcut: string;
  tip: string;
}

const TOOL_CONFIGS: Record<string, ToolConfig> = {
  LINE: {
    name: 'Line Segment',
    shortcut: 'L',
    tip: 'Click on the grid to start, then click to place segments. Double-click or press Enter to finish. Tab/N switches between Length and Angle.'
  },
  MULTI_LINE: {
    name: 'Chained Multi-Line',
    shortcut: 'M',
    tip: 'Click on the grid to start, then click to place connected segments. Double-click or press Enter to finish.'
  },
  RECTANGLE: {
    name: '2-Point Rectangle',
    shortcut: 'R',
    tip: 'Click to set starting corner, then click opposite corner. Or type dimensions in "width x depth" (e.g., 12x8) and press Enter.'
  },
  CIRCLE: {
    name: 'Center Diameter Circle',
    shortcut: 'C',
    tip: 'Click center point, then click radius. Or type radius value and press Enter.'
  },
  ARC: {
    name: '3-Point Arc',
    shortcut: 'A',
    tip: 'Click start point, click end point, then click a point along the curve to set the radius and curvature.'
  },
  ELLIPSE: {
    name: 'Ellipse Center Axes',
    shortcut: 'E',
    tip: 'Click center point, click major axis end, then click minor axis end.'
  },
  ELLIPSE_ARC: {
    name: 'Elliptical Arc',
    shortcut: '⌥E',
    tip: 'Click center point, click major axis end, then click minor axis end, and sweep angle to create an elliptical arc segment.'
  },
  SPLINE: {
    name: 'Control Point Spline',
    shortcut: 'S',
    tip: 'Click on grid to create spline control nodes. Press Enter to close and generate a smooth curve.'
  },
  POINT: {
    name: 'Point Node',
    shortcut: 'P',
    tip: 'Click on grid to place reference point nodes.'
  },
  ADD_LABEL: {
    name: 'Add Annotation Label',
    shortcut: 'T',
    tip: 'Click on the grid to position a text label, then type the label text in the prompt.'
  },
  FILLET: {
    name: 'Fillet Corner',
    shortcut: 'F',
    tip: 'Click on any corner vertex where two lines meet to apply a rounded fillet curve.'
  },
  CHAMFER: {
    name: 'Chamfer Bevel',
    shortcut: 'Alt + F',
    tip: 'Click on a corner vertex where two lines meet to apply a straight bevel line.'
  },
  TRIM: {
    name: 'Trim Segment',
    shortcut: 'T',
    tip: 'Click on any line, circle, or segment to trim it away back to the nearest intersections.'
  },
  EXTEND: {
    name: 'Extend Segment',
    shortcut: 'Alt + T',
    tip: 'Click on a line segment near its end to extend it to the nearest intersecting boundary.'
  },
  OFFSET: {
    name: 'Offset Curve',
    shortcut: 'O',
    tip: 'Select a line or circle, then drag cursor or enter distance to create a parallel offset copy.'
  },
  MIRROR: {
    name: 'Mirror Geometry',
    shortcut: 'Alt + M',
    tip: 'Select geometry to mirror, then click on a central reference axis line to mirror it.'
  },
  DIMENSION: {
    name: 'Sketch Dimension',
    shortcut: 'D',
    tip: 'Click a line, circle, or select two points to place a dimension label or constrain its length.'
  },
  COINCIDENT: {
    name: 'Coincident Constraint',
    shortcut: 'I',
    tip: 'Select two points, or a point and a line, to make them touch and link together parametrically.'
  },
  COLLINEAR: {
    name: 'Collinear Constraint',
    shortcut: 'Alt + C',
    tip: 'Select two line segments to align them along the exact same straight line path.'
  },
  LOCK: {
    name: 'Fix / Lock Anchor',
    shortcut: 'X',
    tip: 'Select any point or segment to anchor it in space, preventing it from being dragged.'
  },
  MIDPOINT: {
    name: 'Midpoint Constraint',
    shortcut: 'M',
    tip: 'Select a point and a line to snap the point to the center midpoint of that line.'
  },
  HORIZONTAL: {
    name: 'Horizontal Constraint',
    shortcut: 'H',
    tip: 'Select a line segment to snap it perfectly horizontal.'
  },
  VERTICAL: {
    name: 'Vertical Constraint',
    shortcut: 'V',
    tip: 'Select a line segment to snap it perfectly vertical.'
  },
  HORIZONTAL_VERTICAL: {
    name: 'Horizontal / Vertical',
    shortcut: 'H',
    tip: 'Select a line to snap it to horizontal or vertical, whichever is closer.'
  },
  PARALLEL: {
    name: 'Parallel Constraint',
    shortcut: 'Alt + L',
    tip: 'Select two line segments to force them to run in parallel trajectories.'
  },
  PERPENDICULAR: {
    name: 'Perpendicular Constraint',
    shortcut: 'Alt + P',
    tip: 'Select two line segments to force them to meet at a perfect 90-degree angle.'
  },
  TANGENT: {
    name: 'Tangent Constraint',
    shortcut: 'G',
    tip: 'Select a line and a circle/arc to force them to meet smoothly at a single tangent node.'
  },
  CONCENTRIC: {
    name: 'Concentric Circles',
    shortcut: 'K',
    tip: 'Select two circles or arcs to align their center points.'
  },
  EQUAL: {
    name: 'Equal Length / Radius',
    shortcut: 'Q',
    tip: 'Select two lines or circles to force them to share the exact same length or radius.'
  },
  EQUAL_RADIUS: {
    name: 'Equal Radius Constraint',
    shortcut: 'Shift + Q',
    tip: 'Select two circles or arcs to force them to share the exact same radius.'
  },
  EQUAL_LENGTH: {
    name: 'Equal Length Constraint',
    shortcut: 'Alt + Q',
    tip: 'Select two line segments to force them to share the exact same length.'
  },
  POINT_ON_LINE: {
    name: 'Point On Line Constraint',
    shortcut: 'Shift + L',
    tip: 'Select a point node and a line segment to constrain the point to lie on the line.'
  },
  POINT_ON_CIRCLE: {
    name: 'Point On Circle Constraint',
    shortcut: 'Shift + C',
    tip: 'Select a point node and a circle/arc to constrain the point to lie on the boundary of the circle.'
  },
  ANGLE_CONSTRAINT: {
    name: 'Angle Constraint',
    shortcut: 'Shift + A',
    tip: 'Select a line segment, then specify its absolute angle constraint value.'
  },
  ANGLE_BETWEEN: {
    name: 'Angle Between Constraint',
    shortcut: 'Shift + B',
    tip: 'Select two lines to set and constrain the relative angle between them.'
  },
  DISTANCE_PL: {
    name: 'Point-Line Distance',
    shortcut: 'Shift + D',
    tip: 'Select a point and a line, then specify the perpendicular offset distance constraint.'
  },
  DISTANCE_PP: {
    name: 'Point-Point Distance',
    shortcut: 'Shift + P',
    tip: 'Select two points, then specify the exact distance constraint between them.'
  },
  SYMMETRIC: {
    name: 'Symmetric Constraint',
    shortcut: 'Alt + S',
    tip: 'Select two points/lines and a central symmetry line to keep them mirrored.'
  },
  MEASURE_ANGLE: {
    name: 'Measure Angle',
    shortcut: 'Shift + G',
    tip: 'Select two lines to calculate and print the relative angle between them.'
  },
  MEASURE_CIRCLE: {
    name: 'Measure Circle / Arc',
    shortcut: 'Shift + C',
    tip: 'Select any circle or arc to measure and display its center coordinates, radius, and diameter.'
  },
  FILE_NEW: {
    name: 'New Sketch',
    shortcut: 'Ctrl + N',
    tip: 'Creates a blank new sketch layout. Clears all current geometry nodes.'
  },
  FILE_CLONE: {
    name: 'Clone Sketch',
    shortcut: 'Ctrl + Shift + C',
    tip: 'Duplicates all sketch geometry in active memory to a parallel backup layer.'
  },
  FILE_SAVE: {
    name: 'Save Sketch',
    shortcut: 'Ctrl + S',
    tip: 'Saves current geometry points, lines, circles, and constraints to the project directory database.'
  },
  FILE_EXPORT: {
    name: 'Export Sketch',
    shortcut: 'Ctrl + E',
    tip: 'Export the sketch profile layout in CAD formats (DXF/SVG/PDF).'
  },
  VIEW_FIT: {
    name: 'Zoom Fit Screen',
    shortcut: 'F',
    tip: 'Automatically recalculate view camera zoom and center on the center of bounding geometry.'
  },
  SET_SKETCH_PLANE: {
    name: 'Set Sketch Plane',
    shortcut: 'S',
    tip: 'Click on any face of a 3D model to establish it as the active sketching plane.'
  }
};

export function CADActiveToolHUD() {
  const activeDrawMode = useSpatialStore(state => state.activeDrawMode);
  const setSketchDrawMode = useSpatialStore(state => state.setSketchDrawMode);
  const setSketchStartPointId = useSpatialStore(state => state.setSketchStartPointId);
  const setSketchCurrentPoint = useSpatialStore(state => state.setSketchCurrentPoint);

  if (!activeDrawMode || !TOOL_CONFIGS[activeDrawMode]) return null;

  const config = TOOL_CONFIGS[activeDrawMode];

  const handleExit = () => {
    setSketchDrawMode(null);
    setSketchStartPointId(null);
    setSketchCurrentPoint(null);
  };

  return (
    <div
      className="active-tool-hud"
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        background: 'rgba(9, 13, 22, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(6, 182, 212, 0.35)',
        borderRadius: '8px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(6, 182, 212, 0.05)',
        fontFamily: "'Outfit', 'Inter', sans-serif",
        color: '#f8fafc',
        minWidth: '380px',
        maxWidth: '520px',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(6, 182, 212, 0.1)',
          color: '#22d3ee',
          flexShrink: 0
        }}
      >
        <Info size={16} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '12.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {config.name}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#06b6d4',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              padding: '1px 5px',
              borderRadius: '4px'
            }}
          >
            {config.shortcut}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
          {config.tip}
        </p>
      </div>

      <button
        onClick={handleExit}
        title="Exit Active Mode (Esc)"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#ef4444';
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#64748b';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}

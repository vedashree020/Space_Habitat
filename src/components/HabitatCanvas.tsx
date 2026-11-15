import { useRef, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Group, Text, Circle, Path } from 'react-konva';
import type Konva from 'konva';
import type { PlacedZone, Conflict, ZoneType, HabitatShape } from '../types';
import { GRID_SIZE, CANVAS_W, CANVAS_H, ZONE_MAP } from '../data';
import { ICONS } from '../icons';
import { snapToGrid, getNearestAirlock, getNoExitZones } from '../analysis';
import { createZone } from '../storage';

interface Props {
  zones: PlacedZone[];
  setZones: (z: PlacedZone[]) => void;
  conflicts: Conflict[];
  showHeatmap: boolean;
  showEgress: boolean;
  shape: HabitatShape;
  selectedTool: ZoneType | null;
  onSelectTool: (t: ZoneType | null) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  canvasRef: React.RefObject<HTMLDivElement>;
}

export default function HabitatCanvas({
  zones, setZones, conflicts, showHeatmap, showEgress, shape,
  selectedTool, onSelectTool, selectedId, setSelectedId, canvasRef,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; corner: string } | null>(null);

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!selectedTool) return;
    // Only place on empty stage (not on a zone)
    const target = e.target;
    if (target.attrs.nodeType === 'zone-group' || target.parent?.attrs.nodeType === 'zone-group') return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    if (pos.x < 0 || pos.x > CANVAS_W || pos.y < 0 || pos.y > CANVAS_H) return;
    const def = ZONE_MAP[selectedTool];
    const z = createZone(selectedTool, snapToGrid(pos.x - def.defaultSize.w / 2), snapToGrid(pos.y - def.defaultSize.h / 2));
    setZones([...zones, z]);
    onSelectTool(null);
  }, [selectedTool, zones, setZones, onSelectTool]);

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const newX = snapToGrid(Math.max(0, Math.min(CANVAS_W - node.width(), node.x())));
    const newY = snapToGrid(Math.max(0, Math.min(CANVAS_H - node.height(), node.y())));
    node.x(newX);
    node.y(newY);
  };

  const handleDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const x = snapToGrid(node.x());
    const y = snapToGrid(node.y());
    setZones(zones.map((z) => (z.id === id ? { ...z, x, y } : z)));
    setDraggingId(null);
  };
  const handleResizeStart = (id: string, corner: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    e.evt.preventDefault();
    setResizing({ id, corner });
    setSelectedId(id);
  };

  const handleStageMouseMove = () => {
    if (!resizing) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const z = zones.find((zz) => zz.id === resizing.id);
    if (!z) return;
    let { x, y, width, height } = z;
    const minW = 40;
    const minH = 40;
    if (resizing.corner === 'br') {
      width = Math.max(minW, snapToGrid(pos.x - x));
      height = Math.max(minH, snapToGrid(pos.y - y));
    } else if (resizing.corner === 'bl') {
      const newX = snapToGrid(pos.x);
      width = Math.max(minW, snapToGrid(x + width - newX));
      x = x + width < minW + x ? x : newX;
    } else if (resizing.corner === 'tr') {
      const newY = snapToGrid(pos.y);
      height = Math.max(minH, snapToGrid(y + height - newY));
      y = y + height < minH + y ? y : newY;
    } else if (resizing.corner === 'tl') {
      const newX = snapToGrid(pos.x);
      const newY = snapToGrid(pos.y);
      width = Math.max(minW, snapToGrid(x + width - newX));
      height = Math.max(minH, snapToGrid(y + height - newY));
      x = x + width < minW + x ? x : newX;
      y = y + height < minH + y ? y : newY;
    }
    width = Math.min(width, CANVAS_W - x);
    height = Math.min(height, CANVAS_H - y);
    setZones(zones.map((zz) => (zz.id === resizing.id ? { ...zz, x, y, width, height } : zz)));
  };

  const handleStageMouseUp = () => {
    if (resizing) setResizing(null);
  };

  const handleDelete = (id: string) => {
    setZones(zones.filter((z) => z.id !== id));
    setSelectedId(null);
  };

  const noExitZones = getNoExitZones(zones);
  const noExitIds = new Set(noExitZones.map((z) => z.id));

  const renderHabitatOutline = () => {
    if (shape === 'rectangle') {
      return <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} stroke="#22d3ee" strokeWidth={2} dash={[8, 4]} cornerRadius={8} />;
    }
    if (shape === 'circle') {
      return (
        <>
          <Circle x={CANVAS_W / 2} y={CANVAS_H / 2} radius={Math.min(CANVAS_W, CANVAS_H) / 2 - 4} stroke="#22d3ee" strokeWidth={2} dash={[8, 4]} />
          <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#04070d" opacity={0.6} listening={false} />
        </>
      );
    }
    // L-shape
    return (
      <>
        <Line
          points={[0, 0, 380, 0, 380, 200, CANVAS_W, 200, CANVAS_W, CANVAS_H, 0, CANVAS_H]}
          closed
          stroke="#22d3ee"
          strokeWidth={2}
          dash={[8, 4]}
          fill="rgba(34,211,238,0.02)"
        />
      </>
    );
  };

  const renderGrid = () => {
    const lines: React.ReactNode[] = [];
    for (let x = 0; x <= CANVAS_W; x += GRID_SIZE * 2) {
      lines.push(<Line key={`v${x}`} points={[x, 0, x, CANVAS_H]} stroke="rgba(34,211,238,0.05)" strokeWidth={1} />);
    }
    for (let y = 0; y <= CANVAS_H; y += GRID_SIZE * 2) {
      lines.push(<Line key={`h${y}`} points={[0, y, CANVAS_W, y]} stroke="rgba(34,211,238,0.05)" strokeWidth={1} />);
    }
    return <>{lines}</>;
  };

  const renderHeatmap = () => {
    return zones.map((z) => {
      const cx = z.x + z.width / 2;
      const cy = z.y + z.height / 2;
      const radius = 80 + z.noiseLevel * 1.2;
      const isLoud = z.noiseLevel > 60;
      const color = isLoud ? '#ef4444' : z.noiseLevel > 40 ? '#f59e0b' : '#22c55e';
      return (
        <Circle
          key={`heat-${z.id}`}
          x={cx}
          y={cy}
          radius={radius}
          listening={false}
          opacity={0.18}
          fillRadialGradientStartPoint={{ x: cx, y: cy }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndPoint={{ x: cx, y: cy }}
          fillRadialGradientEndRadius={radius}
          fillRadialGradientColorStops={[
            0, `${color}cc`,
            0.5, `${color}44`,
            1, `${color}00`,
          ]}
        />
      );
    });
  };

  const renderEgress = () => {
    const airlocks = zones.filter((z) => z.type === 'airlock');
    if (airlocks.length === 0) return null;
    const lines: React.ReactNode[] = [];
    zones.forEach((z) => {
      if (z.type === 'airlock') return;
      const nearest = getNearestAirlock(z, zones);
      if (!nearest) return;
      const zx = z.x + z.width / 2;
      const zy = z.y + z.height / 2;
      const ax = nearest.x + nearest.width / 2;
      const ay = nearest.y + nearest.height / 2;
      const isNoExit = noExitIds.has(z.id);
      lines.push(
        <Line
          key={`egress-${z.id}`}
          points={[zx, zy, ax, ay]}
          stroke={isNoExit ? '#ef4444' : '#84cc16'}
          strokeWidth={2}
          dash={[6, 4]}
          opacity={0.7}
          listening={false}
        />
      );
    });
    return lines;
  };

  const renderConflicts = () => {
    return conflicts.map((c, i) => (
      <Group key={`conf-${i}`} listening={false}>
        <Circle x={c.midX} y={c.midY} radius={14} fill="#ef4444" opacity={0.9} />
        <Text
          x={c.midX - 6}
          y={c.midY - 7}
          text="!"
          fontSize={16}
          fontStyle="bold"
          fill="#fff"
          align="center"
          width={12}
        />
      </Group>
    ));
  };

  const renderNoExitTags = () => {
    return noExitZones.map((z) => (
      <Group key={`noexit-${z.id}`} listening={false}>
        <Rect x={z.x + z.width / 2 - 40} y={z.y - 8} width={80} height={16} fill="#ef4444" cornerRadius={3} />
        <Text
          x={z.x + z.width / 2 - 40}
          y={z.y - 6}
          text="NO EXIT ROUTE"
          fontSize={9}
          fontStyle="bold"
          fill="#fff"
          align="center"
          width={80}
        />
      </Group>
    ));
  };

  return (
    <div ref={canvasRef} className="relative w-full h-full flex items-center justify-center p-4">
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at center, #0a1320 0%, #04070d 80%)',
          border: '1px solid rgba(34,211,238,0.15)',
          boxShadow: 'inset 0 0 40px rgba(34,211,238,0.04)',
        }}
      >
        <Stage
          ref={stageRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseDown={handleStageClick}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onClick={(e) => {
            if (e.target === e.target.getStage()) setSelectedId(null);
          }}
          style={{ cursor: selectedTool ? 'crosshair' : 'default' }}
        >
          <Layer>
            {renderGrid()}
            {renderHabitatOutline()}
            {showHeatmap && renderHeatmap()}
            {zones.map((z) => (
              <ZoneShape
                key={z.id}
                zone={z}
                isSelected={selectedId === z.id}
                isDragging={draggingId === z.id}
                showNoExit={showEgress && noExitIds.has(z.id)}
                onDragStart={() => { setDraggingId(z.id); setSelectedId(z.id); }}
                onDragMove={(e) => handleDragMove(e, z.id)}
                onDragEnd={(e) => handleDragEnd(z.id, e)}
                onSelect={() => setSelectedId(z.id)}
                onResizeStart={(corner, e) => handleResizeStart(z.id, corner, e)}
                onDelete={() => handleDelete(z.id)}
              />
            ))}
            {showEgress && renderEgress()}
            {renderConflicts()}
            {showEgress && renderNoExitTags()}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

interface ZoneShapeProps {
  zone: PlacedZone;
  isSelected: boolean;
  isDragging: boolean;
  showNoExit: boolean;
  onDragStart: () => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onSelect: () => void;
  onResizeStart: (corner: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDelete: () => void;
}

function ZoneShape({ zone, isSelected, onDragStart, onDragMove, onDragEnd, onSelect, onResizeStart, onDelete }: ZoneShapeProps) {
  const def = ZONE_MAP[zone.type];
  const Icon = ICONS[def.icon];

  return (
    <Group
      nodeType="zone-group"
      x={zone.x}
      y={zone.y}
      draggable
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onMouseDown={onSelect}
    >
      <Rect
        width={zone.width}
        height={zone.height}
        fill={`${zone.color}22`}
        stroke={zone.color}
        strokeWidth={isSelected ? 2.5 : 1.5}
        cornerRadius={6}
        shadowColor={zone.color}
        shadowBlur={isSelected ? 12 : 4}
        shadowOpacity={0.3}
      />
      {/* Icon area */}
      <Rect x={4} y={4} width={28} height={28} fill={`${zone.color}30`} cornerRadius={4} />
      <Path
        data={getIconPath(def.icon)}
        x={8}
        y={8}
        fill={zone.color}
        scale={{ x: 0.9, y: 0.9 }}
      />
      {/* Label */}
      <Text
        text={zone.label}
        x={36}
        y={8}
        fontSize={11}
        fontFamily="Inter, sans-serif"
        fontStyle="bold"
        fill={zone.color}
        width={zone.width - 40}
        ellipsis
      />
      <Text
        text={`${zone.noiseLevel}dB`}
        x={36}
        y={22}
        fontSize={9}
        fontFamily="JetBrains Mono, monospace"
        fill="#64748b"
      />

      {/* Resize handles */}
      {isSelected && (
        <>
          {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
            const positions: Record<string, { x: number; y: number }> = {
              tl: { x: -4, y: -4 },
              tr: { x: zone.width - 4, y: -4 },
              bl: { x: -4, y: zone.height - 4 },
              br: { x: zone.width - 4, y: zone.height - 4 },
            };
            const pos = positions[corner];
            return (
              <Rect
                key={corner}
                x={pos.x}
                y={pos.y}
                width={8}
                height={8}
                fill="#22d3ee"
                cornerRadius={2}
                onMouseDown={(e) => onResizeStart(corner, e)}
                style={{ cursor: getResizeCursor(corner) }}
              />
            );
          })}
          {/* Delete button */}
          <Group x={zone.width - 24} y={zone.height - 24} onMouseDown={(e) => { e.cancelBubble = true; e.evt.preventDefault(); onDelete(); }}>
            <Rect width={20} height={20} fill="#ef4444" cornerRadius={4} />
            <Text text="x" x={6} y={3} fontSize={13} fontStyle="bold" fill="#fff" />
          </Group>
        </>
      )}
    </Group>
  );
}

function getResizeCursor(corner: string): string {
  if (corner === 'tl' || corner === 'br') return 'nwse-resize';
  return 'nesw-resize';
}

// Simple SVG path placeholders for zone icons on Konva canvas
function getIconPath(icon: string): string {
  // Use a generic square-with-circle as a simple visual marker since Konva can't render React icons
  const paths: Record<string, string> = {
    BedDouble: 'M2 18v-8h20v8M2 14h20M6 10V6h12v4',
    Dumbbell: 'M4 12h16M2 8v8M6 6v12M18 6v12M22 8v8',
    Utensils: 'M8 3v18M8 8c-2 0-3-2-3-4s1-4 3-4M16 3v18M16 3c2 0 3 2 3 5s-1 5-3 5',
    Stethoscope: 'M6 3v6a4 4 0 008 0V3M10 15v2a4 4 0 008 0v-2',
    FlaskConical: 'M9 3h6M10 3l-5 14h14L14 3M7 13h10',
    Package: 'M3 7l9-4 9 4v10l-9 4-9-4V7M3 7l9 4 9-4M12 11v10',
    ShowerHead: 'M8 4h8v4l-2 2H10L8 8V4M12 10v4M10 16v2M14 16v2',
    Radar: 'M12 2a10 10 0 100 20 10 10 0 000-20M12 12l6-6M12 12l-6 4',
    DoorOpen: 'M4 4h12v16H4zM16 8h4v8h-4M8 12h2',
    Wind: 'M3 8h10a3 3 0 100-6M3 12h14a3 3 0 110 6M3 16h8a2.5 2.5 0 110 5',
  };
  return paths[icon] || 'M12 2a10 10 0 100 20 10 10 0 000-20';
}

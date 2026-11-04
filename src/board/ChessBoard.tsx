import { useId, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  Color,
  Move,
  MoveInput,
  PieceType,
  PlacedPiece,
  PromotionPiece,
  Square,
} from '../core/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { BOARD_SIZE, SQUARE_SIZE, fromCell, squareFromPoint, toCell } from './geometry.ts';
import { trackIdentity, type TrackedPiece } from './identity.ts';
import { PieceGlyph } from './pieces.tsx';

export interface ChessBoardProps {
  readonly pieces: readonly PlacedPiece[];
  readonly orientation: Color;
  /** Moves the user may make now. Empty means the board is read-only. */
  readonly legalMoves: readonly Move[];
  readonly lastMove: Pick<Move, 'from' | 'to'> | null;
  readonly checkSquare: Square | null;
  readonly onMove: (move: MoveInput) => void;
}

const LIGHT = '#eadcc0';
const DARK = '#a57d57';
const PROMOTION_CHOICES: readonly PromotionPiece[] = ['q', 'n', 'r', 'b'];
/** Pointer travel (board units) before a press becomes a drag. */
const DRAG_THRESHOLD = 6;

interface Drag {
  readonly from: Square;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  x: number;
  y: number;
  moved: boolean;
  /** The piece was already selected when this press started (a second click deselects). */
  readonly wasSelected: boolean;
}

function useTrackedPieces(
  pieces: readonly PlacedPiece[],
  lastMove: ChessBoardProps['lastMove'],
): TrackedPiece[] {
  const previous = useRef<TrackedPiece[]>([]);
  const counter = useRef(0);
  return useMemo(() => {
    const tracked = trackIdentity(previous.current, pieces, lastMove, () => {
      counter.current += 1;
      return `piece-${counter.current}`;
    });
    previous.current = tracked;
    return tracked;
    // lastMove only matters together with a new set of pieces, so it is not a dependency.
  }, [pieces]);
}

export function ChessBoard({
  pieces,
  orientation,
  legalMoves,
  lastMove,
  checkSquare,
  onMove,
}: ChessBoardProps) {
  const { t } = useI18n();
  const uid = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const tracked = useTrackedPieces(pieces, lastMove);
  const [selected, setSelected] = useState<Square | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);

  const movable: Color | null = legalMoves[0]?.color ?? null;
  const pieceAt = (square: Square) => pieces.find((piece) => piece.square === square);

  // A selection that is no longer playable (after a move, undo or game end) is dropped.
  const activeSelected =
    selected && legalMoves.some((move) => move.from === selected) ? selected : null;
  const targets = useMemo(
    () => (activeSelected ? legalMoves.filter((move) => move.from === activeSelected) : []),
    [activeSelected, legalMoves],
  );

  const toBoardPoint = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: -1, y: -1 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };

  const tryMove = (from: Square, to: Square): boolean => {
    const candidates = legalMoves.filter((move) => move.from === from && move.to === to);
    if (candidates.length === 0) return false;
    setSelected(null);
    if (candidates.some((move) => move.promotion)) {
      setPromotion({ from, to });
    } else {
      onMove({ from, to });
    }
    return true;
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (promotion || event.button !== 0) return;
    const { x, y } = toBoardPoint(event);
    const square = squareFromPoint(x, y, orientation);
    if (!square) return;
    const piece = pieceAt(square);
    if (piece && piece.color === movable && legalMoves.some((move) => move.from === square)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({
        from: square,
        pointerId: event.pointerId,
        startX: x,
        startY: y,
        x,
        y,
        moved: false,
        wasSelected: activeSelected === square,
      });
      setSelected(square);
      return;
    }
    if (activeSelected && tryMove(activeSelected, square)) return;
    setSelected(null);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { x, y } = toBoardPoint(event);
    const moved = drag.moved || Math.hypot(x - drag.startX, y - drag.startY) > DRAG_THRESHOLD;
    setDrag({ ...drag, x, y, moved });
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (cancelled) return;
    const { x, y } = toBoardPoint(event);
    const square = squareFromPoint(x, y, orientation);
    if (drag.moved) {
      if (!square || square === drag.from || !tryMove(drag.from, square)) setSelected(null);
    } else if (drag.wasSelected) {
      setSelected(null);
    }
  };

  const choosePromotion = (piece: PromotionPiece | null) => {
    if (promotion && piece) onMove({ ...promotion, promotion: piece });
    setPromotion(null);
  };

  const cellOrigin = (square: Square) => {
    const { col, row } = toCell(square, orientation);
    return { x: col * SQUARE_SIZE, y: row * SQUARE_SIZE };
  };

  const highlight = (square: Square, fill: string, key: string) => {
    const { x, y } = cellOrigin(square);
    return <rect key={key} x={x} y={y} width={SQUARE_SIZE} height={SQUARE_SIZE} fill={fill} />;
  };

  const squares = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const square = fromCell(col, row, orientation);
      if (!square) continue;
      squares.push(
        <rect
          key={square}
          data-square={square}
          x={col * SQUARE_SIZE}
          y={row * SQUARE_SIZE}
          width={SQUARE_SIZE}
          height={SQUARE_SIZE}
          fill={(col + row) % 2 === 0 ? LIGHT : DARK}
        />,
      );
    }
  }

  const labels = [];
  for (let i = 0; i < 8; i += 1) {
    const fileSquare = fromCell(i, 7, orientation);
    const rankSquare = fromCell(0, i, orientation);
    if (fileSquare) {
      labels.push(
        <text
          key={`f${i}`}
          x={i * SQUARE_SIZE + SQUARE_SIZE - 7}
          y={BOARD_SIZE - 7}
          textAnchor="end"
          fill={(i + 7) % 2 === 0 ? DARK : LIGHT}
        >
          {fileSquare[0]}
        </text>,
      );
    }
    if (rankSquare) {
      labels.push(
        <text key={`r${i}`} x={6} y={i * SQUARE_SIZE + 22} fill={i % 2 === 0 ? DARK : LIGHT}>
          {rankSquare[1]}
        </text>,
      );
    }
  }

  const hidden = drag?.moved ? drag.from : null;
  const dragged = drag?.moved ? pieceAt(drag.from) : undefined;
  const checkGradient = `${uid}-check`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
      className="block aspect-square w-full touch-none select-none"
      role="img"
      aria-label={t('board.label')}
      data-testid="board"
      data-orientation={orientation}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => endDrag(event, false)}
      onPointerCancel={(event) => endDrag(event, true)}
    >
      <defs>
        <radialGradient id={checkGradient}>
          <stop offset="0%" stopColor="#ff3b2f" stopOpacity={0.95} />
          <stop offset="55%" stopColor="#e0281c" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#a01010" stopOpacity={0} />
        </radialGradient>
      </defs>
      <g>{squares}</g>
      <g pointerEvents="none">
        {lastMove && highlight(lastMove.from, 'rgba(214, 170, 60, 0.42)', 'last-from')}
        {lastMove && highlight(lastMove.to, 'rgba(214, 170, 60, 0.55)', 'last-to')}
        {activeSelected && highlight(activeSelected, 'rgba(46, 125, 84, 0.55)', 'selected')}
        {checkSquare && highlight(checkSquare, `url(#${checkGradient})`, 'check')}
      </g>
      <g className="text-[22px] font-semibold" pointerEvents="none">
        {labels}
      </g>
      <g pointerEvents="none">
        {tracked.map((piece) => {
          const { x, y } = cellOrigin(piece.square);
          return (
            <g
              key={piece.id}
              data-piece={`${piece.color}${piece.type.toUpperCase()}`}
              data-square={piece.square}
              className="transition-transform duration-200 ease-out motion-reduce:transition-none"
              style={{
                transform: `translate(${x}px, ${y}px)`,
                opacity: piece.square === hidden ? 0.35 : 1,
              }}
            >
              <PieceGlyph type={piece.type} color={piece.color} />
            </g>
          );
        })}
      </g>
      <g pointerEvents="none">
        {targets.map((move) => {
          const { x, y } = cellOrigin(move.to);
          const occupied = Boolean(pieceAt(move.to)) || move.isEnPassant;
          return occupied ? (
            <circle
              key={move.uci}
              data-target={move.to}
              cx={x + 50}
              cy={y + 50}
              r={44}
              fill="none"
              stroke="rgba(20, 50, 30, 0.45)"
              strokeWidth={8}
            />
          ) : (
            <circle
              key={move.uci}
              data-target={move.to}
              cx={x + 50}
              cy={y + 50}
              r={15}
              fill="rgba(20, 50, 30, 0.4)"
            />
          );
        })}
      </g>
      {dragged && drag && (
        <g
          pointerEvents="none"
          style={{ transform: `translate(${drag.x - 50}px, ${drag.y - 60}px) scale(1.08)` }}
        >
          <PieceGlyph type={dragged.type} color={dragged.color} />
        </g>
      )}
      {promotion && (
        <PromotionPicker
          to={promotion.to}
          color={movable ?? 'w'}
          orientation={orientation}
          onChoose={choosePromotion}
          label={t('promotion.label')}
          names={{
            q: t('piece.q'),
            r: t('piece.r'),
            b: t('piece.b'),
            n: t('piece.n'),
          }}
        />
      )}
    </svg>
  );
}

function PromotionPicker({
  to,
  color,
  orientation,
  onChoose,
  label,
  names,
}: {
  to: Square;
  color: Color;
  orientation: Color;
  onChoose: (piece: PromotionPiece | null) => void;
  label: string;
  names: Record<Exclude<PieceType, 'p' | 'k'>, string>;
}) {
  const { col, row } = toCell(to, orientation);
  const direction = row === 0 ? 1 : -1;
  return (
    <g role="dialog" aria-label={label} data-testid="promotion">
      <rect
        width={BOARD_SIZE}
        height={BOARD_SIZE}
        fill="rgba(10, 14, 12, 0.55)"
        onPointerDown={(event) => {
          event.stopPropagation();
          onChoose(null);
        }}
      />
      {PROMOTION_CHOICES.map((piece, index) => {
        const x = col * SQUARE_SIZE;
        const y = (row + direction * index) * SQUARE_SIZE;
        return (
          <g
            key={piece}
            role="button"
            aria-label={names[piece]}
            data-promotion={piece}
            className="cursor-pointer"
            onPointerDown={(event) => {
              event.stopPropagation();
              onChoose(piece);
            }}
          >
            <rect
              x={x + 3}
              y={y + 3}
              width={SQUARE_SIZE - 6}
              height={SQUARE_SIZE - 6}
              rx={14}
              fill="#f3ead6"
              stroke="#c9a24a"
              strokeWidth={4}
            />
            <g style={{ transform: `translate(${x}px, ${y}px)` }}>
              <PieceGlyph type={piece} color={color} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

// Original piece designs, drawn in a 100×100 box with the base at the bottom.
import type { Color, PieceType } from '../core/index.ts';

const PALETTE = {
  w: { fill: '#f7f1e3', stroke: '#2a2019', detail: '#2a2019' },
  b: { fill: '#2c2621', stroke: '#0f0c0a', detail: '#d7c6a2' },
} as const;

function Base({ x1, x2, top }: { x1: number; x2: number; top: number }) {
  return <rect x={x1} y={top} width={x2 - x1} height={88 - top} rx={4} />;
}

function Shape({ type }: { type: PieceType }) {
  switch (type) {
    case 'p':
      return (
        <>
          <Base x1={26} x2={74} top={78} />
          <path d="M33 78 C36 66 42 61 44 55 H56 C58 61 64 66 67 78 Z" />
          <rect x={37} y={49} width={26} height={7} rx={3.5} />
          <circle cx={50} cy={36} r={13} />
        </>
      );
    case 'r':
      return (
        <>
          <Base x1={20} x2={80} top={78} />
          <rect x={25} y={70} width={50} height={9} rx={2.5} />
          <path d="M31 70 L35 38 H65 L69 70 Z" />
          <path d="M26 39 V15 H37 V23 H45 V15 H55 V23 H63 V15 H74 V39 Z" />
          <path data-detail d="M35 47 H65" fill="none" />
        </>
      );
    case 'n':
      return (
        <>
          <Base x1={22} x2={80} top={78} />
          <rect x={27} y={70} width={48} height={9} rx={3} />
          <path d="M33 70 C31 58 37 50 45 44 C40 44 34 47 28 52 C23 51 20 46 22 41 C27 31 36 23 44 19 L46 9 L54 17 C68 19 76 32 76 48 C76 58 72 64 72 70 Z" />
          <circle data-detail cx={42} cy={29} r={2.8} stroke="none" />
          <path data-detail d="M58 21 C67 30 70 45 68 62" fill="none" />
          <path data-detail d="M25 44 L29 45" fill="none" />
        </>
      );
    case 'b':
      return (
        <>
          <Base x1={22} x2={78} top={78} />
          <rect x={31} y={70} width={38} height={9} rx={3} />
          <path d="M36 70 C29 58 31 44 50 25 C69 44 71 58 64 70 Z" />
          <circle cx={50} cy={19} r={6.5} />
          <path data-detail d="M56 38 L46 51" fill="none" />
          <path data-detail d="M38 62 H62" fill="none" />
        </>
      );
    case 'q':
      return (
        <>
          <Base x1={20} x2={80} top={78} />
          <rect x={27} y={70} width={46} height={9} rx={3} />
          <path d="M30 70 L19 33 L31 47 L34 25 L43 43 L50 19 L57 43 L66 25 L69 47 L81 33 L70 70 Z" />
          <circle cx={19} cy={30} r={4.5} />
          <circle cx={34} cy={22} r={4.5} />
          <circle cx={50} cy={15} r={5} />
          <circle cx={66} cy={22} r={4.5} />
          <circle cx={81} cy={30} r={4.5} />
          <path data-detail d="M31 61 H69" fill="none" />
        </>
      );
    case 'k':
      return (
        <>
          <Base x1={20} x2={80} top={78} />
          <rect x={27} y={70} width={46} height={9} rx={3} />
          <path d="M30 70 C22 54 24 41 37 36 H63 C76 41 78 54 70 70 Z" />
          <rect x={35} y={29} width={30} height={8} rx={3} />
          <path d="M46 29 V21 H39 V14 H46 V7 H54 V14 H61 V21 H54 V29 Z" />
          <path data-detail d="M31 61 H69" fill="none" />
        </>
      );
  }
}

/** A chess piece drawn in a 100×100 box. Place it with a parent transform. */
export function PieceGlyph({ type, color }: { type: PieceType; color: Color }) {
  const colors = PALETTE[color];
  return (
    <g
      fill={colors.fill}
      stroke={colors.stroke}
      strokeWidth={3}
      strokeLinejoin="round"
      strokeLinecap="round"
      className="piece-glyph"
      style={{ ['--piece-detail' as string]: colors.detail }}
    >
      <Shape type={type} />
    </g>
  );
}

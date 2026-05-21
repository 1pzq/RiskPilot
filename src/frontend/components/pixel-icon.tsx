'use client';

export type PixelIconName =
  | 'overview'
  | 'risk'
  | 'strategy'
  | 'audit'
  | 'prepare'
  | 'case'
  | 'read'
  | 'policy'
  | 'archive'
  | 'holder'
  | 'lending'
  | 'lp'
  | 'treasury'
  | 'wallet';

type PixelIconProps = {
  name: PixelIconName;
  className?: string;
};

const glyphs: Record<PixelIconName, string> = {
  overview: 'OV',
  risk: 'RK',
  strategy: 'ST',
  audit: 'AU',
  prepare: 'PR',
  case: 'CS',
  read: 'RD',
  policy: 'POL',
  archive: 'ARC',
  holder: 'SUI',
  lending: 'LN',
  lp: 'LP',
  treasury: 'DAO',
  wallet: 'WL',
};

export function PixelIcon({ name, className = '' }: PixelIconProps) {
  const glyph = glyphs[name];

  return (
    <span
      className={`pixelIcon pixelIcon-${name} ${glyph.length > 2 ? 'pixelIconLong' : ''} ${className}`}
      aria-hidden="true"
    >
      <span className="pixelIconGlyph">{glyph}</span>
      <span className="pixelIconBit pixelIconBitOne" />
      <span className="pixelIconBit pixelIconBitTwo" />
    </span>
  );
}

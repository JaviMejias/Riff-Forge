import type { ChordDef } from '../chords';

interface ChordBoxProps {
  chord: ChordDef;
  width?: number;
  height?: number;
  hideName?: boolean;
}

export const ChordBox = ({ chord, width = 120, height = 160, hideName = false }: ChordBoxProps) => {
  const strings = 6;
  const numFrets = 4;
  
  // Padding around the grid
  const padLeft = 32; // More space on the left for the "fr" text
  const padRight = 16;
  const padTop = 45; // Increased to prevent overlap with name
  const padBottom = 20;
  
  const gridWidth = width - padLeft - padRight;
  const gridHeight = height - padTop - padBottom;
  
  const stringSpacing = gridWidth / (strings - 1);
  const fretSpacing = gridHeight / numFrets;

  const baseFret = chord.baseFret || 1;

  // Determine if we need to draw a thick nut (top line)
  const isNut = baseFret === 1;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="select-none">
      {/* Background */}
      <rect width={width} height={height} fill="transparent" />

      {/* Chord Name */}
      {!hideName && (
        <text 
          x={width / 2} 
          y={18} 
          textAnchor="middle" 
          fill="#f4f4f5" 
          fontSize="16" 
          fontWeight="bold"
        >
          {chord.name}
        </text>
      )}

      {/* Base Fret Text */}
      {baseFret > 1 && (
        <text 
          x={padLeft - 6} 
          y={padTop + fretSpacing / 2 + 4} 
          textAnchor="end" 
          fill="#a1a1aa" 
          fontSize="12"
          fontWeight="bold"
        >
          {baseFret}fr
        </text>
      )}

      {/* Grid: Frets (Horizontal lines) */}
      {Array.from({ length: numFrets + 1 }).map((_, i) => {
        const y = padTop + (i * fretSpacing);
        const isTop = i === 0;
        return (
          <line 
            key={`fret-${i}`}
            x1={padLeft} 
            y1={y} 
            x2={width - padRight} 
            y2={y} 
            stroke={isTop && isNut ? "#f4f4f5" : "#52525b"} 
            strokeWidth={isTop && isNut ? 4 : 2}
          />
        );
      })}

      {/* Grid: Strings (Vertical lines) */}
      {Array.from({ length: strings }).map((_, i) => {
        const x = padLeft + (i * stringSpacing);
        return (
          <line 
            key={`string-${i}`}
            x1={x} 
            y1={padTop} 
            x2={x} 
            y2={height - padBottom} 
            stroke="#52525b" 
            strokeWidth={2}
          />
        );
      })}

      {/* Dots and open/mute indicators */}
      {chord.frets.map((fret, i) => {
        const stringIndex = i; // 0 is low E, 5 is high e
        const x = padLeft + (stringIndex * stringSpacing);

        if (fret === -1) {
          // Muted string (X)
          return (
            <text 
              key={`mute-${i}`} 
              x={x} 
              y={padTop - 8} 
              textAnchor="middle" 
              fill="#ef4444" 
              fontSize="12"
              fontWeight="bold"
            >
              X
            </text>
          );
        }

        if (fret === 0) {
          // Open string (O)
          return (
            <circle 
              key={`open-${i}`} 
              cx={x} 
              cy={padTop - 12} 
              r={4} 
              fill="transparent" 
              stroke="#f4f4f5" 
              strokeWidth={1.5}
            />
          );
        }

        // Fretted note
        // Determine vertical position based on baseFret
        const relativeFret = fret - baseFret + 1;
        
        // If relativeFret is somehow outside our 4-fret grid, don't draw it (or maybe draw it at the bottom)
        if (relativeFret > 0 && relativeFret <= numFrets) {
          const y = padTop + ((relativeFret - 1) * fretSpacing) + (fretSpacing / 2);
          
          const finger = chord.fingers ? chord.fingers[i] : null;

          return (
            <g key={`dot-${i}`}>
              <circle 
                cx={x} 
                cy={y} 
                r={7} 
                fill="#f59e0b" // primary-500
              />
              {finger !== null && finger > 0 && (
                <text 
                  x={x} 
                  y={y + 3.5} 
                  textAnchor="middle" 
                  fill="#18181b" 
                  fontSize="10"
                  fontWeight="bold"
                >
                  {finger}
                </text>
              )}
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
};

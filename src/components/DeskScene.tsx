export function DeskScene() {
  return (
    <div className="h-full w-full select-none pointer-events-none overflow-hidden rounded-3xl shadow-md border border-paper-dark/80 bg-[#0072BB]">
      <svg
        viewBox="0 0 560 640"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full object-contain select-none pointer-events-none"
        role="img"
        aria-label="An illustration of a laptop, an open notebook with a pen, and a steaming cup of coffee resting on a desk."
      >
        {/* backdrop wash */}
        <rect width="560" height="640" fill="#0072BB" />
        <ellipse cx="280" cy="160" rx="260" ry="180" fill="#1E91D6" opacity="0.4" />

        {/* desk surface */}
        <rect x="0" y="500" width="560" height="140" fill="#005B96" />
        <rect x="0" y="500" width="560" height="6" fill="#8FC93A" opacity="0.8" />

        {/* laptop base */}
        <g>
          <rect x="70" y="470" width="230" height="14" rx="4" fill="#005B96" />
          <path d="M92 360 H278 V470 H92 Z" fill="#003D66" />
          <path d="M104 374 H266 V456 H104 Z" fill="#00243D" />
          <path d="M104 374 H266 V390 H104 Z" fill="#1E91D6" opacity="0.5" />
          {/* screen glow lines */}
          <rect x="120" y="405" width="110" height="6" rx="3" fill="#E4CC37" opacity="0.9" />
          <rect x="120" y="422" width="90" height="6" rx="3" fill="#8FC93A" opacity="0.8" />
          <rect x="120" y="439" width="100" height="6" rx="3" fill="#FCF7FF" opacity="0.7" />
        </g>

        {/* notebook */}
        <g transform="translate(300 440) rotate(-8)">
          <rect x="0" y="0" width="180" height="130" rx="6" fill="#FCF7FF" stroke="#E18335" strokeWidth="2" />
          <line x1="16" y1="24" x2="164" y2="24" stroke="#E18335" strokeWidth="2" />
          <line x1="16" y1="44" x2="164" y2="44" stroke="#E18335" strokeWidth="2" />
          <line x1="16" y1="64" x2="140" y2="64" stroke="#E18335" strokeWidth="2" />
          <line x1="16" y1="84" x2="150" y2="84" stroke="#E18335" strokeWidth="2" />
          <line x1="16" y1="104" x2="120" y2="104" stroke="#E18335" strokeWidth="2" />
        </g>

        {/* pen */}
        <g transform="translate(330 420) rotate(28)">
          <rect x="0" y="0" width="150" height="10" rx="5" fill="#E18335" />
          <rect x="130" y="0" width="20" height="10" rx="5" fill="#E4CC37" />
        </g>

        {/* coffee cup */}
        <g transform="translate(60 410)">
          <path d="M0 30 Q0 70 30 70 Q60 70 60 30 Z" fill="#FCF7FF" stroke="#003D66" strokeWidth="3" />
          <ellipse cx="30" cy="30" rx="30" ry="9" fill="#E18335" />
          <ellipse cx="30" cy="30" rx="30" ry="9" fill="none" stroke="#003D66" strokeWidth="3" />
          <path d="M58 36 Q76 36 76 50 Q76 64 58 60" stroke="#003D66" strokeWidth="3" fill="none" />
          {/* steam */}
          <path d="M18 18 Q10 4 20 -8" stroke="#E4CC37" strokeWidth="3" fill="none" opacity="0.8" strokeLinecap="round" />
          <path d="M36 18 Q28 2 38 -12" stroke="#E4CC37" strokeWidth="3" fill="none" opacity="0.6" strokeLinecap="round" />
        </g>

        {/* plant */}
        <g transform="translate(470 420)">
          <path d="M6 60 L54 60 L46 100 L14 100 Z" fill="#E18335" />
          <path d="M30 60 C10 40 10 10 30 0 C50 10 50 40 30 60 Z" fill="#8FC93A" />
          <path d="M30 60 C40 45 40 20 30 8" stroke="#003D66" strokeWidth="2" fill="none" />
        </g>
      </svg>
    </div>
  )
}

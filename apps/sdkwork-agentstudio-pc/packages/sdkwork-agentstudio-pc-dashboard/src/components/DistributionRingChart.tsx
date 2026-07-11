export function DistributionRingChart<T extends { id: string }>({
  rows,
  sliceClassNames,
  centerLabel,
  centerValue,
  ariaLabel,
  valueAccessor,
}: {
  rows: T[];
  sliceClassNames: string[];
  centerLabel: string;
  centerValue: string;
  ariaLabel: string;
  valueAccessor: (row: T) => number;
}) {
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 26;
  const total = rows.reduce((sum, row) => sum + valueAccessor(row), 0);
  let cumulativeOffset = 0;

  return (
    <div className="min-w-0 rounded-[1.6rem] border border-white/70 bg-white/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:p-5 dark:border-white/6 dark:bg-zinc-950/35">
      <div className="flex items-center justify-center">
        <svg
          viewBox="0 0 220 220"
          className="h-auto w-full max-w-[15rem]"
          role="img"
          aria-label={ariaLabel}
        >
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            className="stroke-zinc-100 dark:stroke-zinc-900"
            strokeWidth={strokeWidth}
          />
          <g transform="rotate(-90 110 110)">
            {rows.map((row, index) => {
              const value = valueAccessor(row);
              const ratio = total === 0 ? 0 : value / total;
              const dashLength = Math.max(ratio * circumference - 3, 0);
              const dashOffset = -cumulativeOffset;

              cumulativeOffset += ratio * circumference;

              return (
                <g key={row.id} className={sliceClassNames[index % sliceClassNames.length]}>
                  <circle
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dashLength} ${circumference}`}
                    strokeDashoffset={dashOffset}
                  />
                </g>
              );
            })}
          </g>
          <circle cx="110" cy="110" r="54" className="fill-white dark:fill-zinc-950" />
          <text
            x="110"
            y="98"
            textAnchor="middle"
            className="fill-zinc-400 text-[12px] font-semibold uppercase tracking-[0.26em] dark:fill-zinc-500"
          >
            {centerLabel}
          </text>
          <text
            x="110"
            y="122"
            textAnchor="middle"
            className="fill-zinc-950 text-[24px] font-semibold tracking-tight dark:fill-zinc-50"
          >
            {centerValue}
          </text>
        </svg>
      </div>
    </div>
  );
}

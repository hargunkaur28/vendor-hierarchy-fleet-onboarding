import React from 'react';

interface FleetStatusDonutProps {
  distribution: {
    operational: number;
    nonCompliant: number;
    inactive: number;
    blocked: number;
  };
}

export const FleetStatusDonut: React.FC<FleetStatusDonutProps> = ({ distribution }) => {
  const { operational, nonCompliant, inactive, blocked } = distribution;
  const total = operational + nonCompliant + inactive + blocked;

  if (total === 0) {
    return (
      <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
        <span>No fleet registered</span>
      </div>
    );
  }

  // Calculate SVG stroke segments
  const size = 130;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { label: 'Operational', count: operational, color: '#10B981' }, // emerald-500
    { label: 'Non-Compliant', count: nonCompliant, color: '#F43F5E' }, // rose-500
    { label: 'Inactive', count: inactive, color: '#94A3B8' }, // slate-400
    { label: 'Blocked', count: blocked, color: '#E11D48' }, // rose-600
  ].filter((s) => s.count > 0);

  // Pre-calculate boundary angles for crisp radial divider lines between segments
  const dividers: number[] = [];
  let runningPercent = 0;
  for (const seg of segments) {
    runningPercent += seg.count / total;
    dividers.push(runningPercent * 2 * Math.PI);
  }

  let accumulatedPercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-around gap-4 p-2">
      {/* SVG Donut */}
      <div className="relative w-[130px] h-[130px] shrink-0">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 shrink-0"
          aria-label="Fleet status distribution chart"
        >
          {/* Subtle background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Color Segments with clean butt caps */}
          {segments.map((seg, idx) => {
            const percent = seg.count / total;
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += percent;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
                className="transition-all duration-300"
              />
            );
          })}

          {/* Crisp radial divider lines at every segment junction to cleanly separate colors */}
          {segments.length > 1 &&
            dividers.map((angle, idx) => {
              const rInner = radius - strokeWidth / 2 - 1;
              const rOuter = radius + strokeWidth / 2 + 1;
              const x1 = size / 2 + rInner * Math.cos(angle);
              const y1 = size / 2 + rInner * Math.sin(angle);
              const x2 = size / 2 + rOuter * Math.cos(angle);
              const y2 = size / 2 + rOuter * Math.sin(angle);

              return (
                <line
                  key={`divider-${idx}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#ffffff"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
        </svg>

        {/* Center count readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-slate-900 leading-none">{total}</span>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5">Vehicles</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-1.5 w-full sm:w-auto text-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-slate-600">Operational</span>
          </div>
          <span className="font-bold text-slate-900">{operational}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span className="text-slate-600">Non-Compliant</span>
          </div>
          <span className="font-bold text-slate-900">{nonCompliant}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
            <span className="text-slate-600">Inactive</span>
          </div>
          <span className="font-bold text-slate-900">{inactive}</span>
        </div>

        {blocked > 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
              <span className="text-slate-600">Blocked</span>
            </div>
            <span className="font-bold text-slate-900">{blocked}</span>
          </div>
        )}
      </div>
    </div>
  );
};

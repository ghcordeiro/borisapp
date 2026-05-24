"use client";

interface CircularProgressProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  primaryLabel: string;
  secondaryLabel?: string;
  primaryClassName?: string;
}

export function CircularProgress({
  percent,
  size = 140,
  strokeWidth = 10,
  primaryLabel,
  secondaryLabel,
  primaryClassName = "text-2xl font-bold",
}: CircularProgressProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const center = size / 2;
  const radius = center - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span className={primaryClassName}>{primaryLabel}</span>
        {secondaryLabel && (
          <span className="text-xs text-muted-foreground">{secondaryLabel}</span>
        )}
      </div>
    </div>
  );
}

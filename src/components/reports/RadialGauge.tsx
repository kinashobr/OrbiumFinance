"use client";

import { cn } from "@/lib/utils";

interface RadialGaugeProps {
  value: number;
  min?: number;
  max?: number;
  label: string;
  unit?: string;
  status: "success" | "warning" | "danger" | "neutral";
  size?: number;
  className?: string;
}

export function RadialGauge({
  value,
  min = 0,
  max = 100,
  label,
  unit = "%",
  status,
  size = 140, // Default size updated
  className,
}: RadialGaugeProps) {
  const radius = size * 0.4;
  const stroke = size * 0.08;
  
  // Normaliza o valor para o cálculo do arco (0 a 100)
  const normalizedValueForArc = Math.min(Math.max(value, min), max);
  const percentage = ((normalizedValueForArc - min) / (max - min)) * 100;
  
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const statusColors = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    neutral: "text-primary",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center p-4", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="transparent"
            className="text-muted/20"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className={cn("transition-all duration-1000 ease-out", statusColors[status])}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-black tabular-nums">
            {value.toFixed(1)}{unit}
          </span>
          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { verdictMeta } from '@/lib/verdict';
import type { Verdict } from '@/lib/types';
import { DURATION, prefersReducedMotion } from '@/lib/motion';

interface LikelihoodGaugeProps {
  value: number; // 0–100
  verdict: Verdict;
  size?: number;
}

/**
 * Animated 0–100 likelihood gauge — a semicircular arc that fills to `value`
 * with a count-up number, colored by verdict. Respects reduced-motion.
 */
export function LikelihoodGauge({ value, verdict, size = 160 }: LikelihoodGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const color = verdictMeta(verdict).colorVar;

  const r = 52;
  const circumference = Math.PI * r; // semicircle
  const stroke = 10;

  const progress = useMotionValue(0);
  const dashoffset = useTransform(
    progress,
    (p) => circumference - (p / 100) * circumference,
  );
  const display = useTransform(progress, (p) => Math.round(p));

  useEffect(() => {
    if (prefersReducedMotion()) {
      progress.set(clamped);
      return;
    }
    const controls = animate(progress, clamped, {
      duration: DURATION.countUp,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [clamped, progress]);

  return (
    <div
      className="relative"
      style={{ width: size, height: size / 2 + 16 }}
      role="img"
      aria-label={`Likelihood ${clamped} out of 100`}
    >
      <svg viewBox="0 0 120 70" className="w-full">
        {/* track */}
        <path
          d="M 8 62 A 52 52 0 0 1 112 62"
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* progress */}
        <motion.path
          d="M 8 62 A 52 52 0 0 1 112 62"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashoffset }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <motion.span
          className="font-mono text-3xl font-semibold"
          style={{ color }}
        >
          {display}
        </motion.span>
        <span className="text-xs text-muted-foreground">/ 100 likelihood</span>
      </div>
    </div>
  );
}

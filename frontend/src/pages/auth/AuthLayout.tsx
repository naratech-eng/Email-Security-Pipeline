import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Activity } from 'lucide-react';
import hackerUrl from '@/assets/hacker.svg';
import { fadeInUp, staggerContainer } from '@/lib/motion';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Split auth shell: a layered, animated cyber hero on the left (lg+) and an
 * elevated glass form card on the right. Collapses to a single centered card
 * with a compact brand header on small screens.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-background lg:grid-cols-[1.15fr_1fr]">
      {/* ---- Hero (lg+) ---- */}
      <aside className="relative hidden overflow-hidden border-r border-border lg:block">
        <img
          src={hackerUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-105 object-cover opacity-55"
        />
        {/* Texture + legibility + brand-tint layers */}
        <div className="cyber-grid absolute inset-0 opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/30" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_100%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(40%_40%_at_90%_0%,color-mix(in_srgb,var(--secondary)_16%,transparent),transparent_70%)]" />

        {/* Brand — pinned top-left */}
        <div className="absolute left-10 top-9 flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            Email Security Pipeline
          </span>
        </div>

        {/* Copy — bottom-left */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="relative flex h-full flex-col justify-end gap-5 p-10 xl:p-12"
        >
          <motion.span
            variants={fadeInUp}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
          >
            <Activity className="size-3.5 text-verdict-clean" aria-hidden />
            Real-time threat detection
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="max-w-lg text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-foreground"
          >
            Threat intelligence for every message your org sends and receives.
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="max-w-md text-sm leading-relaxed text-muted-foreground"
          >
            ML-scored detections, live triage, and manual analysis — one SOC
            console for your analysts.
          </motion.p>
        </motion.div>
      </aside>

      {/* ---- Form column ---- */}
      <main className="relative flex flex-col items-center justify-center px-4 py-10">
        {/* Soft glow behind the card so the glass elevation reads */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_20%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_70%)]" />

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          className="relative w-full max-w-sm"
        >
          {/* Compact brand — when the hero is hidden */}
          <div className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <ShieldCheck className="size-6 text-primary" aria-hidden />
            <span className="font-mono text-sm font-semibold">
              Email Security Pipeline
            </span>
          </div>

          <div className="panel-elevated rounded-2xl border border-border bg-surface/80 p-8 backdrop-blur-sm">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>

            <div className="mt-6">{children}</div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Secure analyst console · access is role-based
          </p>
        </motion.div>
      </main>
    </div>
  );
}

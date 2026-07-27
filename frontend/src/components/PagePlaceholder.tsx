import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { fadeInUp } from '@/lib/motion';

interface PagePlaceholderProps {
  title: string;
  slice: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Themed "coming in a later slice" panel so the shell is fully navigable while
 * page logic is built out slice by slice. Not a production surface.
 */
export function PagePlaceholder({
  title,
  slice,
  description,
  icon: Icon,
}: PagePlaceholderProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      className="panel-elevated mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-8 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="font-mono text-xs uppercase tracking-wider text-primary">
          {slice}
        </p>
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </motion.div>
  );
}

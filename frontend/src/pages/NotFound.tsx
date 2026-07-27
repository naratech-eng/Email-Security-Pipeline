import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-surface px-8 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Compass className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          That route doesn&rsquo;t exist in the console.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Back to Overview</Link>
      </Button>
    </div>
  );
}

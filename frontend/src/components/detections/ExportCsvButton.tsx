import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePermissions } from '@/auth/usePermissions';
import {
  buildDetectionsCsv,
  csvFilename,
  describeFilters,
  downloadCsv,
  type ExportContext,
} from '@/feed/exportCsv';
import { formatDateTime } from '@/lib/format';

/**
 * Analyst-only CSV export (RB-5). Hidden — not disabled — for roles without
 * `canExportCsv`, matching the established capability pattern: an action that
 * can never succeed shouldn't be on screen.
 *
 * The confirm step exists to state coverage BEFORE the file exists, not to add
 * friction: once the CSV leaves the app, "was this all of it?" is unanswerable
 * from the file's row count alone.
 */
export function ExportCsvButton(ctx: ExportContext) {
  const { canExportCsv } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!canExportCsv) return null;

  function onExport() {
    const name = csvFilename();
    downloadCsv(name, buildDetectionsCsv(ctx));
    setOpen(false);
    toast.success(`Exported ${ctx.rows.length} rows to ${name}`);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={ctx.rows.length === 0}
      >
        <Download aria-hidden />
        Export view (CSV)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export the rows you can see?</DialogTitle>
            <DialogDescription>
              The file is built from the rendered snapshot — no new request — so it
              matches this view exactly.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Rows</dt>
              <dd className="font-mono text-foreground">
                {ctx.rows.length} of {ctx.loadedCount} loaded
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Filters</dt>
              <dd className="max-w-[60%] text-right text-foreground">
                {describeFilters(ctx)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Snapshot</dt>
              <dd className="text-foreground">
                {ctx.fetchedAt ? formatDateTime(new Date(ctx.fetchedAt).toISOString()) : '—'}
              </dd>
            </div>
          </dl>

          {ctx.atWindowEdge && (
            <p className="rounded-md border border-verdict-flag/30 bg-verdict-flag/10 p-3 text-xs text-foreground">
              The loaded window is full ({ctx.server.limit} rows), so more matching
              detections almost certainly exist beyond it. The file says so in its
              header — it is not a full extract.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onExport}>
              <Download aria-hidden />
              Download CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

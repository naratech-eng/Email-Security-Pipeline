import { ShieldAlert } from 'lucide-react';
import { PagePlaceholder } from '@/components/PagePlaceholder';

export default function Detections() {
  return (
    <PagePlaceholder
      icon={ShieldAlert}
      title="Detections"
      slice="Slice 4 — Detections workspace"
      description="The live feed of scored mail — URL-first filters, a 30s poll with pause, quarantine bell, and CSV export, with drill-down to a first-class detail view."
    />
  );
}

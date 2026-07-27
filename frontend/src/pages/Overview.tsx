import { LayoutDashboard } from 'lucide-react';
import { PagePlaceholder } from '@/components/PagePlaceholder';

export default function Overview() {
  return (
    <PagePlaceholder
      icon={LayoutDashboard}
      title="Overview"
      slice="Slice 6 — Overview wall"
      description="The SOC wall — stat tiles, detections-over-time, verdict donut, recent activity, and a live system-status card — all derived from real API calls."
    />
  );
}

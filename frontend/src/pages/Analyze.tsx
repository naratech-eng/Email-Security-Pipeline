import { ScanSearch } from 'lucide-react';
import { PagePlaceholder } from '@/components/PagePlaceholder';

export default function Analyze() {
  return (
    <PagePlaceholder
      icon={ScanSearch}
      title="Analyze"
      slice="Slice 5 — Analyze flow"
      description="Paste a raw email or drop an .eml file, watch a themed scanning state through the cold-start wait, then read the result in the shared analysis view."
    />
  );
}

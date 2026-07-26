import { useParams } from 'react-router-dom';
import { FileSearch } from 'lucide-react';
import { PagePlaceholder } from '@/components/PagePlaceholder';

export default function DetectionDetail() {
  const { id } = useParams();
  return (
    <PagePlaceholder
      icon={FileSearch}
      title={`Detection ${id ?? ''}`.trim()}
      slice="Slice 4 — shared result display"
      description="The full analysis breakdown — verdict, likelihood gauge, remediation, email-model reasoning, and defanged per-URL cards — rendered by the same component as manual Analyze results."
    />
  );
}

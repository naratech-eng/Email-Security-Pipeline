import { Users as UsersIcon } from 'lucide-react';
import { PagePlaceholder } from '@/components/PagePlaceholder';

export default function Users() {
  return (
    <PagePlaceholder
      icon={UsersIcon}
      title="Users"
      slice="Slice 7 — User management"
      description="Security-Analyst-only Cognito user administration — role changes and enable/disable — degrading gracefully while the admin endpoints are still being built."
    />
  );
}

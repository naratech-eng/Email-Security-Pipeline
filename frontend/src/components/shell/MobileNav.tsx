import * as DialogPrimitive from '@radix-ui/react-dialog';
import { SidebarContent } from './Sidebar';

/** Off-canvas navigation drawer for small screens (hamburger-triggered). */
export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border shadow-2xl focus:outline-none md:hidden"
          aria-label="Navigation"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <SidebarContent onNavigate={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/hooks/useTheme';

/** App toast host, themed to match the current light/dark theme. */
export function Toaster(props: ToasterProps) {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'bg-surface border border-border text-foreground rounded-md shadow-lg',
          description: 'text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}

import { Toaster as Sonner, toast } from 'sonner';

// App-wide toast host (shadcn/ui "sonner"). Call toast.success(...) / toast.error(...) anywhere.
function Toaster(props) {
  return (
    <Sonner
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'group rounded-2xl border border-border bg-background text-foreground shadow-lg font-sans',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };

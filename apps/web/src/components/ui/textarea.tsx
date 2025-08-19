import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-input px-3.5 py-2.5 text-base md:text-sm placeholder:text-muted-foreground bg-white/90 dark:bg-input/30 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-[inset_0_0_0_1px_var(--color-input)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        'resize-y',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };

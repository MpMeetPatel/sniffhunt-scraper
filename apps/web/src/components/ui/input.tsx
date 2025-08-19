import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        'flex h-11 w-full min-w-0 rounded-lg border px-3.5 py-2 text-base md:text-sm outline-none appearance-none bg-transparent dark:bg-input/30',
        // Always-visible subtle inner border for clarity in light mode
        'shadow-[inset_0_0_0_1px_var(--color-input)]',
        // Typography & placeholders
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
        // File input reset
        'file:inline-flex file:h-8 file:px-2 file:rounded-md file:border-0 file:bg-muted file:text-sm file:font-medium',
        // Interactions
        'transition-colors ring-offset-0 focus:ring-2 focus:ring-primary/35 focus:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:border-primary/55',
        // Borders
        'border-input dark:border-input',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className
      )}
      {...props}
    />
  );
}

export { Input };

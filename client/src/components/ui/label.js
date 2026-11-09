import * as React from 'react';
import { cn } from 'lib/utils';

// Pass htmlFor (or wrap the control) so the label stays linked to its input.
const Label = React.forwardRef(({ className, ...props }, ref) => (
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  <label
    ref={ref}
    className={cn('text-xs font-medium leading-none text-slate-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };

import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function StatePanel({
  kind = 'empty',
  title,
  children,
  action,
}: {
  kind?: 'loading' | 'error' | 'empty';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon =
    kind === 'loading' ? LoaderCircle : kind === 'error' ? AlertCircle : Inbox;
  return (
    <section
      className={`state-panel state-${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className="state-icon">
        <Icon
          aria-hidden="true"
          className={kind === 'loading' ? 'spin' : undefined}
        />
      </span>
      <h2>{title}</h2>
      {children && <div className="state-copy">{children}</div>}
      {action && <div className="state-actions">{action}</div>}
    </section>
  );
}

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({
  title,
  onClose,
  children,
  className = '',
  locked = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  locked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={'dialog ' + className}
      onClose={onClose}
      onCancel={(event) => {
        if (locked) event.preventDefault();
      }}
      onClick={(event) => {
        if (!locked && event.target === event.currentTarget)
          ref.current?.close();
      }}
    >
      <header className="dialog-header">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          type="button"
          disabled={locked}
          aria-label={'Fechar ' + title.toLowerCase()}
          onClick={() => ref.current?.close()}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  );
}

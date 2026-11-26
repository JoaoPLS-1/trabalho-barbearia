import { useCallback, useEffect, useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { Dialog } from './Dialog';

/** A referência permite navegar após sucesso sem aguardar outro render. */
export function useUnsavedChanges(dirty: boolean, saving: boolean) {
  const allowLeave = useRef(false);
  const blocker = useBlocker(() => !allowLeave.current && (dirty || saving));
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (!allowLeave.current && (dirty || saving)) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty, saving],
    ),
  );
  useEffect(() => {
    allowLeave.current = false;
  }, []);
  const confirmation =
    blocker.state === 'blocked' ? (
      <Dialog
        title={saving ? 'Salvando cadastro' : 'Descartar alterações?'}
        onClose={() => blocker.reset()}
      >
        <div className="form-body">
          <p>
            {saving
              ? 'Aguarde a resposta antes de sair desta tela.'
              : 'Você tem alterações não salvas. Deseja sair e descartá-las?'}
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => blocker.reset()}
            >
              Continuar editando
            </button>
            {!saving && (
              <button className="button" onClick={() => blocker.proceed()}>
                Descartar e sair
              </button>
            )}
          </div>
        </div>
      </Dialog>
    ) : null;
  return { allowLeave, confirmation };
}

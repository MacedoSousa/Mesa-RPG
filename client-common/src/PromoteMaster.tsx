import { useState } from 'react';
import { Auth, errorMessage } from './api';
import { toast } from './stores';
import { Button, Field } from './ui';

/**
 * Transforma uma conta existente em Mestre usando o código do server/.env.
 * A conta continua podendo jogar nas mesas dos outros — o papel vale por campanha.
 */
export function PromoteMaster({ onDone }: { onDone?: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await Auth.promote(code);
      toast('Agora você também é Mestre! O HUD fica em /host.', 'sucesso');
      onDone?.();
    } catch (e) {
      toast(errorMessage(e), 'erro');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 text-left">
      <Field
        label="Código de Mestre"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoComplete="off"
        hint="Está no server/.env (MASTER_INVITE_CODE) e aparece no terminal quando o Host inicia."
      />
      <Button variant="gold" className="w-full" disabled={!code.trim() || busy} onClick={submit}>
        {busy ? 'Aguarde...' : '👑 Virar Mestre'}
      </Button>
    </div>
  );
}

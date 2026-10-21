import { useEffect, useState } from 'react';
import { Auth, Button, Card, EmptyState, Field, Modal, Spinner, TextArea, api, errorMessage, navigate, toast, useSession } from '@mesa/common';

interface CampaignDTO {
  id: string;
  name: string;
  description: string;
  joinCode: string;
  deletedAt: string | null;
  createdAt: string;
  isMaster?: boolean;
}

export function CampaignList() {
  const user = useSession((s) => s.user)!;
  const [list, setList] = useState<CampaignDTO[] | null>(null);
  const [trash, setTrash] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [toDelete, setToDelete] = useState<CampaignDTO | null>(null);

  async function load() {
    try {
      // As mesas em que você é jogador aparecem no cliente do Jogador ("/"), não aqui
      const all = (await api<{ campaigns: CampaignDTO[] }>(`/campaigns${trash ? '?includeDeleted=true' : ''}`)).campaigns;
      setList(all.filter((c) => c.isMaster !== false));
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trash]);

  async function create() {
    try {
      const r = await api<{ campaign: CampaignDTO }>('/campaigns', { method: 'POST', json: { name, description } });
      toast(`Campanha criada! Código de convite: ${r.campaign.joinCode}`, 'sucesso');
      setName('');
      setDescription('');
      void load();
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  async function remove() {
    if (!toDelete) return;
    try {
      await api(`/campaigns/${toDelete.id}`, { method: 'DELETE' });
      toast('Campanha movida para a lixeira', 'info');
      setToDelete(null);
      void load();
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  async function restore(id: string) {
    try {
      await api(`/campaigns/${id}/restore`, { method: 'POST' });
      toast('Campanha restaurada', 'sucesso');
      void load();
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-amber-200">🏛️ HUD do Mestre</h1>
          <p className="text-slate-400">Bem-vindo(a), {user.displayName ?? user.username}. Seu PC é o Host da mesa.</p>
        </div>
        <Button variant="ghost" onClick={() => void Auth.logout()}>Sair</Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Campanhas" actions={<Button size="sm" variant="subtle" onClick={() => setTrash((v) => !v)}>{trash ? 'Ocultar lixeira' : '🗑️ Lixeira'}</Button>}>
          {!list ? <Spinner /> : list.length === 0 ? (
            <EmptyState icon="📜" title="Nenhuma campanha ainda">Crie a primeira ao lado e compartilhe o código com o grupo.</EmptyState>
          ) : (
            <div className="space-y-2">
              {list.map((c) => (
                <div key={c.id} className={`flex items-center gap-3 rounded-xl border p-3 ${c.deletedAt ? 'border-rose-500/30 opacity-60' : 'border-white/10 bg-white/5'}`}>
                  <div className="flex-1">
                    <p className="font-display text-lg">{c.name}</p>
                    {c.description && <p className="text-sm text-slate-400">{c.description}</p>}
                    <p className="mt-1 text-sm">Código: <code className="rounded bg-black/40 px-2 py-0.5 text-amber-200">{c.joinCode}</code></p>
                  </div>
                  {c.deletedAt ? (
                    <Button size="sm" variant="ghost" onClick={() => restore(c.id)}>♻️ Restaurar</Button>
                  ) : (
                    <>
                      <Button variant="gold" onClick={() => navigate(`/mesa/${c.id}`)}>Abrir mesa</Button>
                      <Button size="sm" variant="danger" onClick={() => setToDelete(c)}>Excluir</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Nova campanha">
          <div className="space-y-3">
            <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: A Profecia do Labirinto" />
            <TextArea label="Descrição (opcional)" value={description} onChange={setDescription} rows={3} />
            <Button variant="gold" className="w-full" disabled={name.trim().length < 2} onClick={create}>Criar campanha</Button>
          </div>
        </Card>
      </div>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir campanha?">
        <p className="text-slate-300">"{toDelete?.name}" irá para a lixeira junto com os mapas. Os saves continuam guardados e você pode restaurar depois.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={remove}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}

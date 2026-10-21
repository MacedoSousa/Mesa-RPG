import { useEffect, useState } from 'react';
import {
  Auth, Badge, Button, Card, EmptyState, Field, PromoteMaster, Select, Spinner, api, errorMessage, navigate, toast, useSession,
} from '@mesa/common';
import type { CampaignDTO, CharacterDTO } from '../types';

export function Home({ joinCode }: { joinCode?: string }) {
  const user = useSession((s) => s.user)!;
  const [chars, setChars] = useState<CharacterDTO[] | null>(null);
  const [camps, setCamps] = useState<CampaignDTO[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  // O código do convite (link/QR) é lembrado enquanto o jogador cria o personagem
  const [code, setCodeState] = useState(() => {
    try {
      if (joinCode) sessionStorage.setItem('mesa_join_code', joinCode);
      return joinCode ?? sessionStorage.getItem('mesa_join_code') ?? '';
    } catch {
      return joinCode ?? '';
    }
  });
  const setCode = (v: string) => {
    setCodeState(v);
    try { sessionStorage.setItem('mesa_join_code', v); } catch { /* armazenamento indisponível */ }
  };
  const [charId, setCharId] = useState('');

  async function load() {
    try {
      const [c, k] = await Promise.all([
        api<{ characters: CharacterDTO[] }>(`/characters${showTrash ? '?includeDeleted=true' : ''}`),
        api<{ campaigns: CampaignDTO[] }>('/campaigns'),
      ]);
      setChars(c.characters);
      setCamps(k.campaigns);
      const alive = c.characters.filter((x) => !x.deletedAt);
      if (!charId && alive[0]) setCharId(alive[0].id);
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTrash]);

  async function join() {
    try {
      const r = await api<{ campaign: CampaignDTO }>('/campaigns/join', { method: 'POST', json: { code, characterId: charId } });
      toast(`Você entrou em "${r.campaign.name}"!`, 'sucesso');
      try { sessionStorage.removeItem('mesa_join_code'); } catch { /* ignore */ }
      navigate(`/mesa/${r.campaign.id}`);
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  async function restore(id: string) {
    try {
      await api(`/characters/${id}/restore`, { method: 'POST' });
      toast('Personagem restaurado!', 'sucesso');
      void load();
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  const alive = (chars ?? []).filter((c) => !c.deletedAt);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-amber-200">Olá, {user.displayName ?? user.username}!</h1>
          <p className="text-sm text-slate-400">{user.role === 'MASTER' ? 'Mestre e jogador(a): mestre no /host e jogue nas mesas dos amigos aqui' : 'Jogador(a)'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/guia')}>📘 Guia</Button>
          <Button variant="ghost" size="sm" onClick={() => void Auth.logout()}>Sair</Button>
        </div>
      </header>

      <Card title="🎟️ Entrar numa mesa">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Código da campanha" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex.: K7QX2M" maxLength={8} />
          <Select label="Com qual herói?" value={charId} onChange={setCharId} options={alive.length ? alive.map((c) => ({ value: c.id, label: c.name })) : [{ value: '', label: 'Crie um personagem primeiro' }]} />
          <Button variant="gold" onClick={join} disabled={!code || !charId}>Entrar</Button>
        </div>
        {camps.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-400">Suas campanhas</p>
            {camps.map((c) => (
              <button
                key={c.id}
                onClick={() => (c.isMaster ? (window.location.href = `/host/#/mesa/${c.id}`) : navigate(`/mesa/${c.id}`))}
                className="flex w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-left hover:bg-white/10"
              >
                <span className="font-semibold">{c.name} {c.isMaster && <Badge color="amber">você mestra</Badge>}</span>
                <span className="text-sm text-amber-300">{c.isMaster ? 'Abrir HUD do Mestre →' : 'Abrir mesa →'}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="🛡️ Seus heróis"
        actions={
          <div className="flex gap-2">
            <Button variant="subtle" size="sm" onClick={() => setShowTrash((v) => !v)}>{showTrash ? 'Ocultar lixeira' : '🗑️ Lixeira'}</Button>
            <Button size="sm" variant="gold" onClick={() => navigate('/criar')}>+ Novo herói</Button>
          </div>
        }
      >
        {!chars ? (
          <Spinner />
        ) : chars.length === 0 ? (
          <EmptyState icon="🏺" title="Nenhum herói ainda">Crie seu primeiro personagem em 4 passos — o guia explica tudo.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {chars.map((c) => (
              <div key={c.id} className={`rounded-xl border p-3 ${c.deletedAt ? 'border-rose-500/30 opacity-60' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg text-slate-50">{c.name}</p>
                    <p className="text-sm text-slate-300">{c.raceLabel} · {c.classLabel} · nível {c.level}</p>
                  </div>
                  <Badge color="amber">{c.divinityLabel}</Badge>
                </div>
                <div className="mt-2 flex gap-3 text-sm text-slate-300">
                  <span>❤️ {c.hp}/{c.stats.maxHp}</span>
                  <span>🛡️ CA {c.stats.armorClass}</span>
                  <span>⚡ {c.stamina}/{c.stats.maxStamina}</span>
                </div>
                <div className="mt-3">
                  {c.deletedAt ? (
                    <Button size="sm" variant="ghost" onClick={() => restore(c.id)}>♻️ Restaurar</Button>
                  ) : (
                    <Button size="sm" variant="subtle" onClick={() => navigate(`/personagem/${c.id}`)}>Ver ficha</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="👑 Quer mestrar a próxima aventura?">
        {user.role === 'MASTER' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
            <span>Sua conta já é de Mestre. Crie e conduza campanhas no HUD; nas mesas dos amigos você joga normalmente por aqui.</span>
            <Button variant="gold" size="sm" onClick={() => (window.location.href = '/host/')}>Abrir HUD do Mestre →</Button>
          </div>
        ) : (
          <details>
            <summary className="cursor-pointer text-sm text-slate-300">
              Use o código de Mestre do Host para liberar o HUD nesta mesma conta. Seus heróis e campanhas continuam iguais.
            </summary>
            <div className="mt-3 max-w-sm">
              <PromoteMaster />
            </div>
          </details>
        )}
      </Card>
    </div>
  );
}

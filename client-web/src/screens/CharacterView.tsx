import { useEffect, useState } from 'react';
import { ABILITIES, ABILITY_LABELS, SKILLS, formatModifier, type EquipmentSlot, type Skill } from '@mesa/shared';
import { Badge, Bar, Button, Card, Modal, Spinner, Term, TextArea, api, cx, errorMessage, navigate, toast } from '@mesa/common';
import type { CharacterDTO } from '../types';

const SLOT_FOR: Record<string, EquipmentSlot> = { arma: 'mainHand', armadura: 'armor', escudo: 'shield' };

export function CharacterView({ id }: { id: string }) {
  const [c, setC] = useState<CharacterDTO | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api<{ character: CharacterDTO }>(`/characters/${id}`)
      .then((r) => {
        setC(r.character);
        setNotes(r.character.sheet?.notes ?? '');
      })
      .catch((e) => {
        toast(errorMessage(e), 'erro');
        navigate('/');
      });
  }, [id]);

  if (!c) return <Spinner />;

  async function equip(slot: EquipmentSlot, itemKey: string | null) {
    try {
      const r = await api<{ character: CharacterDTO }>(`/characters/${id}/equip`, { method: 'POST', json: { slot, itemKey } });
      setC(r.character);
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  async function saveNotes() {
    try {
      const r = await api<{ character: CharacterDTO }>(`/characters/${id}`, { method: 'PATCH', json: { sheet: { notes } } });
      setC(r.character);
      toast('Anotações salvas', 'sucesso');
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  async function remove() {
    try {
      await api(`/characters/${id}`, { method: 'DELETE' });
      toast(`${c!.name} foi para a lixeira (dá para restaurar na tela inicial).`, 'info');
      navigate('/');
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  const s = c.stats;
  const equippedKeys = new Set(Object.values(c.equipment).filter(Boolean));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>← Voltar</Button>
        <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>🗑️ Excluir</Button>
      </header>

      <Card>
        <h1 className="font-display text-2xl text-amber-200">{c.name}</h1>
        <p className="text-slate-300">{c.raceLabel} · {c.classLabel} nível {c.level}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge color="amber">{c.divinityLabel}</Badge>
          <Badge color="violet"><Term k="afinidade">Afinidade</Term> {c.affinity} — {c.affinityTier}</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Bar label="❤️ PV" value={c.hp} max={s.maxHp} color="bg-rose-500" />
          <Bar label="⚡ Estamina" value={c.stamina} max={s.maxStamina} color="bg-amber-400" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge color="sky">🛡️ <Term k="ca">CA</Term> {s.armorClass}</Badge>
          <Badge>🏃 {s.speed} m</Badge>
          <Badge>🎯 Iniciativa {formatModifier(s.initiativeBonus)}</Badge>
          <Badge>Proficiência +{s.proficiencyBonus}</Badge>
          {s.darkvision > 0 && <Badge>👁️ Visão no escuro {s.darkvision} m</Badge>}
          {s.resistances.map((r) => <Badge key={r} color="emerald">Resiste {r}</Badge>)}
        </div>
      </Card>

      <Card title="Atributos">
        <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          {ABILITIES.map((a) => (
            <div key={a} className="rounded-lg bg-white/5 p-2">
              <p className="text-[11px] text-slate-400">{ABILITY_LABELS[a].label}</p>
              <p className="text-2xl font-bold">{s.abilities[a]}</p>
              <p className="text-sm text-amber-200">{formatModifier(s.modifiers[a])}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {s.skillProficiencies.map((k) => <Badge key={k} color="sky">{SKILLS[k as Skill]?.label ?? k} {formatModifier(s.modifiers[SKILLS[k as Skill].ability] + s.proficiencyBonus)}</Badge>)}
        </div>
      </Card>

      <Card title={<span>Inventário — <Term k="restricao">bloqueios</Term> por classe e status</span>}>
        <div className="space-y-2">
          {c.inventory.map((i) => {
            const slot = i.item ? SLOT_FOR[i.item.kind] : undefined;
            const equipped = equippedKeys.has(i.itemKey);
            return (
              <div key={i.itemKey} className={cx('flex items-center gap-3 rounded-lg border p-2', equipped ? 'border-amber-400/60 bg-amber-500/10' : 'border-white/10 bg-white/5', !i.allowed && 'opacity-60')}>
                <span className="text-2xl">{!i.allowed ? '🔒' : i.item?.kind === 'arma' ? '⚔️' : i.item?.kind === 'consumivel' ? '🧪' : i.item?.kind === 'equipamento' ? '🎒' : '🛡️'}</span>
                <div className="flex-1">
                  <p className="font-semibold">{i.item?.name ?? i.itemKey} {i.quantity > 1 && <span className="text-slate-400">×{i.quantity}</span>}</p>
                  <p className="text-xs text-slate-400">{i.item?.description}</p>
                  {!i.allowed && <p className="text-xs text-rose-300">{i.reasons.join(' · ')}</p>}
                </div>
                {slot && i.allowed && (
                  equipped
                    ? <Button size="sm" variant="ghost" onClick={() => equip(Object.entries(c.equipment).find(([, v]) => v === i.itemKey)![0] as EquipmentSlot, null)}>Desequipar</Button>
                    : <Button size="sm" variant="subtle" onClick={() => equip(slot, i.itemKey)}>Equipar</Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Ficha narrativa">
        {c.sheet?.backstory && <p className="mb-3 whitespace-pre-wrap text-sm text-slate-300">{c.sheet.backstory}</p>}
        <TextArea label="Anotações (pistas, dívidas, NPCs...)" value={notes} onChange={setNotes} rows={5} />
        <Button className="mt-2" size="sm" onClick={saveNotes}>Salvar anotações</Button>
      </Card>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Excluir personagem?">
        <p className="text-slate-300">{c.name} vai para a lixeira. Você pode restaurá-lo depois na tela inicial.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          <Button variant="danger" onClick={remove}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}

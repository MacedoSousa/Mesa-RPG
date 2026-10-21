import { Suspense, lazy, useEffect, useState } from 'react';
import { ABILITIES, ABILITY_LABELS, SKILLS, formatModifier, type EquipmentSlot, type Skill } from '@mesa/shared';
import { Badge, Bar, Button, Card, Modal, PortraitEditor, Spinner, Term, TextArea, api, cx, errorMessage, isPortraitSpec, navigate, portraitUrl, randomPortrait, toast, type PortraitSpec } from '@mesa/common';
import type { CharacterDTO } from '../types';
import { LookEditor } from '../hero3d/LookEditor';

const HeroViewer = lazy(() => import('../hero3d/HeroViewer'));

const SLOT_FOR: Record<string, EquipmentSlot> = { arma: 'mainHand', armadura: 'armor', escudo: 'shield' };

export function CharacterView({ id }: { id: string }) {
  const [c, setC] = useState<CharacterDTO | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editFace, setEditFace] = useState<PortraitSpec | null>(null);

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
        <div className="flex items-start gap-4">
        <button onClick={() => setEditFace(isPortraitSpec(c.portrait) ? c.portrait : randomPortrait(c.name, c.race))} title="Editar rosto" className="shrink-0">
          <img src={portraitUrl(isPortraitSpec(c.portrait) ? c.portrait : randomPortrait(c.name, c.race), 112)} width={96} height={96} className="rounded-full shadow-lg" alt="" />
          <span className="mt-1 block text-center text-[11px] text-sky-300">🎭 editar rosto</span>
        </button>
        <div className="flex-1">
        <h1 className="font-display text-2xl text-amber-200">{c.name}</h1>
        <p className="text-slate-300">{c.raceLabel} · {c.classLabel} nível {c.level}</p>
        <div className="mt-1 max-w-xs">
          <div className="flex justify-between text-xs text-slate-400"><span>⭐ {c.experience} XP</span><span>{c.nextLevelXp ? `nível ${c.level + 1} em ${c.nextLevelXp} XP` : 'nível máximo'}</span></div>
          <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-violet-400" style={{ width: `${c.nextLevelXp ? Math.min(100, (c.experience / c.nextLevelXp) * 100) : 100}%` }} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge color="amber">{c.divinityLabel}</Badge>
          <Badge color="violet"><Term k="afinidade">Afinidade</Term> {c.affinity} — {c.affinityTier}</Badge>
        </div>
        </div>
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

      <Card title="🧍 Herói em 3D" actions={<Button size="sm" variant="subtle" onClick={() => setEditFace(isPortraitSpec(c.portrait) ? c.portrait : randomPortrait(c.name, c.race))}>✏️ Aparência</Button>}>
        <Suspense fallback={<div className="flex h-[420px] items-center justify-center text-sm text-amber-200">⚒️ Preparando o palco…</div>}>
          <HeroViewer
            className="h-[420px] sm:h-[480px]"
            compact
            config={{
              classKey: c.classKey, race: c.race, divinity: c.divinity,
              portrait: editFace ?? (isPortraitSpec(c.portrait) ? c.portrait : randomPortrait(c.name, c.race)),
              equipment: c.equipment, inventory: c.inventory.map((i) => i.itemKey),
            }}
          />
        </Suspense>
        <p className="mt-2 text-xs text-slate-400">Troque a arma ou o escudo acima e veja o boneco mudar. Pele, cabelo e traço racial vêm do retrato.</p>
      </Card>

      <Card title="Ficha narrativa">
        {c.sheet?.backstory && <p className="mb-3 whitespace-pre-wrap text-sm text-slate-300">{c.sheet.backstory}</p>}
        <TextArea label="Anotações (pistas, dívidas, NPCs...)" value={notes} onChange={setNotes} rows={5} />
        <Button className="mt-2" size="sm" onClick={saveNotes}>Salvar anotações</Button>
      </Card>

      <Modal open={!!editFace} onClose={() => setEditFace(null)} title="🎭 Aparência do herói">
        {editFace && <PortraitEditor value={editFace} onChange={setEditFace} race={c.race} name={c.name} />}
        {editFace && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="mb-2 font-display text-amber-200">🧍 Corpo e roupa (3D)</p>
            <LookEditor spec={editFace} onChange={setEditFace} />
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditFace(null)}>Cancelar</Button>
          <Button
            variant="gold"
            onClick={async () => {
              try {
                const r = await api<{ character: CharacterDTO }>(`/characters/${c.id}/portrait`, { method: 'PUT', json: { portrait: editFace } });
                setC(r.character);
                setEditFace(null);
                toast('Aparência salva! Se você estiver numa mesa, o token já mudou.', 'sucesso');
              } catch (e) {
                toast(errorMessage(e), 'erro');
              }
            }}
          >
            Salvar aparência
          </Button>
        </div>
      </Modal>
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

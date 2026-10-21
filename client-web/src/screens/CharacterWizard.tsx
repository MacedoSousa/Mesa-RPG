import { useMemo, useState } from 'react';
import {
  ABILITIES, ABILITY_LABELS, CLASSES, CLASS_KEYS, DIVINITIES, DIVINITY_KEYS, ITEMS, POINT_BUY_BUDGET, POINT_BUY_COST,
  POINT_BUY_MAX, POINT_BUY_MIN, RACES, RACE_KEYS, SKILLS, STANDARD_ARRAY, abilityModifier, canUseItem, formatModifier,
  validateCharacterCreation, validatePointBuy,
  type AbilityScores, type CharacterBuild, type CharacterCreationInput, type ClassKey, type DivinityKey, type Equipment,
  type ItemDef, type RaceKey, type Skill,
} from '@mesa/shared';
import { Badge, Button, Card, Field, Term, TextArea, api, cx, errorMessage, navigate, toast, TokenAvatar } from '@mesa/common';
import type { CharacterDTO } from '../types';

const STEPS = ['Raça', 'Pai Olímpico', 'Atributos', 'Inventário', 'Revisão'];
const EXTRA_ITEMS = 3;

const baseScores = (): AbilityScores => ({ forca: 8, destreza: 8, constituicao: 8, inteligencia: 8, sabedoria: 8, carisma: 8 });

export function CharacterWizard() {
  const [step, setStep] = useState(0);
  const [race, setRace] = useState<RaceKey>('semideus');
  const [divinity, setDivinity] = useState<DivinityKey>('nao_reclamado');
  const [classKey, setClassKey] = useState<ClassKey>('guerreiro');
  const [scores, setScores] = useState<AbilityScores>(baseScores);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<Equipment>({});
  const [name, setName] = useState('');
  const [backstory, setBackstory] = useState('');
  const [busy, setBusy] = useState(false);

  const raceDef = RACES[race];
  const divDef = DIVINITIES[divinity];
  const cls = CLASSES[classKey];
  const allowedDivs = (raceDef as { allowedDivinities?: readonly string[] }).allowedDivinities;
  const pb = validatePointBuy(scores);
  const granted = useMemo(() => new Set<string>([...(raceDef.mechanics as { skillProficiencies?: string[] }).skillProficiencies ?? [], ...(divDef.blessing.mechanics as { skillProficiencies?: string[] }).skillProficiencies ?? []]), [raceDef, divDef]);

  const build: CharacterBuild = { race, divinity, classKey, level: 1, affinity: divDef.startingAffinity, baseAbilities: scores, skills, equipment };
  const inventoryKeys = [...new Set([...cls.startingKit, ...extras])];
  const input: CharacterCreationInput = {
    name: name || 'Herói', race, divinity, classKey, baseAbilities: scores, skills, equipment,
    inventory: inventoryKeys.map((k) => ({ itemKey: k, quantity: ITEMS[k]?.kind === 'consumivel' ? 2 : 1 })),
    backstory,
  };
  const validation = validateCharacterCreation(input);

  // ───── Passo 1 → 2: trocar de raça pode invalidar a divindade ─────
  function pickRace(k: RaceKey) {
    setRace(k);
    const allowed = (RACES[k] as { allowedDivinities?: readonly string[] }).allowedDivinities;
    if (allowed && !allowed.includes(divinity)) setDivinity(allowed[0] as DivinityKey);
  }

  function pickClass(k: ClassKey) {
    setClassKey(k);
    setSkills([]);
    setEquipment({});
  }

  function setScore(a: keyof AbilityScores, v: number) {
    if (v < POINT_BUY_MIN || v > POINT_BUY_MAX) return;
    const next = { ...scores, [a]: v };
    if (validatePointBuy(next).spent > POINT_BUY_BUDGET) return toast('Pontos insuficientes', 'erro');
    setScores(next);
  }

  function applyStandardArray() {
    // Atributos principais da classe primeiro, Constituição logo depois (PV e Estamina), o resto em seguida
    const order = [...cls.primaryAbilities, 'constituicao', ...ABILITIES];
    const unique = [...new Set(order)] as (keyof AbilityScores)[];
    const next = baseScores();
    unique.forEach((a, i) => (next[a] = STANDARD_ARRAY[i]));
    setScores(next);
  }

  function toggleSkill(s: Skill) {
    if (granted.has(s)) return;
    if (skills.includes(s)) setSkills(skills.filter((x) => x !== s));
    else if (skills.filter((x) => !granted.has(x)).length < cls.skillChoices.count) setSkills([...skills, s]);
    else toast(`${cls.label} escolhe ${cls.skillChoices.count} perícias`, 'erro');
  }

  // ───── Passo 4: inventário com bloqueio visual ─────
  function check(item: ItemDef) {
    return canUseItem(build, item);
  }

  function autoEquip() {
    const eq: Equipment = {};
    for (const key of inventoryKeys) {
      const item = ITEMS[key];
      if (!item || !check(item).allowed) continue;
      if (item.kind === 'arma' && !eq.mainHand) eq.mainHand = key;
      else if (item.kind === 'armadura' && !eq.armor) eq.armor = key;
      else if (item.kind === 'escudo' && !eq.shield) eq.shield = key;
    }
    const main = eq.mainHand ? ITEMS[eq.mainHand] : undefined;
    if (main?.kind === 'arma' && main.properties.includes('duas_maos')) delete eq.shield;
    setEquipment(eq);
  }

  function toggleExtra(key: string) {
    if (extras.includes(key)) {
      setExtras(extras.filter((k) => k !== key));
      setEquipment(Object.fromEntries(Object.entries(equipment).filter(([, v]) => v !== key)));
    } else if (extras.length < EXTRA_ITEMS) setExtras([...extras, key]);
    else toast(`Você pode levar até ${EXTRA_ITEMS} itens extras`, 'erro');
  }

  function equipSlot(slot: keyof Equipment, key: string | null) {
    setEquipment({ ...equipment, [slot]: key });
  }

  async function submit() {
    setBusy(true);
    try {
      const r = await api<{ character: CharacterDTO }>('/characters', { method: 'POST', json: { ...input, name } });
      toast(`${r.character.name} está pronto(a) para a aventura!`, 'sucesso');
      navigate(`/personagem/${r.character.id}`);
    } catch (e) {
      toast(errorMessage(e), 'erro');
    } finally {
      setBusy(false);
    }
  }

  const canNext = [
    true,
    !allowedDivs || allowedDivs.includes(divinity),
    pb.ok && skills.filter((s) => !granted.has(s)).length === cls.skillChoices.count,
    validation.violations.length === 0,
    validation.ok && name.trim().length >= 2,
  ][step];

  const stats = validation.stats;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-28">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>← Voltar</Button>
        <h1 className="font-display text-xl text-amber-200">Novo herói</h1>
        <span className="text-sm text-slate-400">{step + 1}/{STEPS.length}</span>
      </header>
      <ol className="flex gap-1">
        {STEPS.map((s, i) => (
          <li key={s} className={cx('flex-1 rounded-full py-1 text-center text-[11px] font-semibold sm:text-xs', i === step ? 'bg-amber-500 text-slate-950' : i < step ? 'bg-amber-500/30 text-amber-100' : 'bg-white/5 text-slate-400')}>{s}</li>
        ))}
      </ol>

      {step === 0 && (
        <Card title="Passo 1 — Escolha sua raça">
          <p className="mb-3 text-sm text-slate-300">A raça define bônus de atributos e habilidades passivas.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {RACE_KEYS.map((k) => {
              const r = RACES[k];
              return (
                <button key={k} onClick={() => pickRace(k)} className={cx('rounded-xl border p-3 text-left transition', race === k ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                  <p className="font-display text-lg text-slate-50">{r.label}</p>
                  <p className="text-sm text-slate-300">{r.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(r.abilityBonuses).map(([a, v]) => <Badge key={a} color="sky">+{v} {ABILITY_LABELS[a as keyof AbilityScores].short}</Badge>)}
                    <Badge>🏃 {r.speed} m</Badge>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-300">
                    {r.traits.map((t) => <li key={t.key}><strong className="text-amber-200">{t.label}:</strong> {t.description}</li>)}
                  </ul>
                  <p className="mt-2 text-xs italic text-slate-400">📜 {r.lore}</p>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card title="Passo 2 — Pai Olímpico / Divindade patrona">
          <p className="mb-3 text-sm text-slate-300">
            Seu deus concede +1 num atributo favorito, uma bênção passiva e às vezes um <Term k="poder">poder divino</Term>. A <Term k="afinidade">afinidade</Term> começa baixa e cresce com a história.
          </p>
          {allowedDivs && <p className="mb-3 rounded-lg bg-amber-500/10 p-2 text-sm text-amber-100">{raceDef.label}: escolha entre {allowedDivs.map((k) => DIVINITIES[k as DivinityKey].label).join(', ')}.</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DIVINITY_KEYS.map((k) => {
              const d = DIVINITIES[k];
              const blocked = !!allowedDivs && !allowedDivs.includes(k);
              return (
                <button key={k} disabled={blocked} onClick={() => setDivinity(k)} className={cx('rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-30', divinity === k ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                  <p className="font-display text-lg">{d.symbol} {d.label} {blocked && '🔒'}</p>
                  <p className="text-xs text-slate-400">{d.domain}</p>
                  <p className="mt-1 text-sm text-slate-300">{d.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.favoredAbility && <Badge color="sky">+1 {ABILITY_LABELS[d.favoredAbility].short}</Badge>}
                    <Badge color="amber">Afinidade {d.startingAffinity}</Badge>
                  </div>
                  <p className="mt-2 text-xs"><strong className="text-amber-200">{d.blessing.label}:</strong> {d.blessing.description}</p>
                  {d.power && <p className="mt-1 text-xs"><strong className="text-violet-200">✨ {d.power.label}:</strong> {d.power.description} ({d.power.staminaCost} estamina)</p>}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card title="Classe">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CLASS_KEYS.map((k) => (
                <button key={k} onClick={() => pickClass(k)} className={cx('rounded-lg border p-2 text-left', classKey === k ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                  <p className="flex items-center gap-2 font-semibold"><TokenAvatar artKey={`classe:${k}`} color="#334155" size={30} />{CLASSES[k].label}</p>
                  <p className="text-[11px] text-slate-400">d{CLASSES[k].hitDie} · {CLASSES[k].primaryAbilities.map((a) => ABILITY_LABELS[a].short).join('/')}</p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-300">{cls.description}</p>
            <p className="mt-1 text-xs text-slate-400">
              Armaduras: {cls.armorProficiencies.join(', ') || 'nenhuma'} · Armas: {[...cls.weaponCategoryProficiencies, ...cls.weaponProficiencies.map((w) => ITEMS[w]?.name ?? w)].join(', ') || 'nenhuma'}
            </p>
          </Card>

          <Card
            title={<span>Passo 3 — <Term k="atributos">Atributos</Term> (point-buy)</span>}
            actions={<div className="flex items-center gap-2"><Badge color={pb.remaining === 0 ? 'emerald' : 'amber'}>{pb.remaining} pontos</Badge><Button size="sm" variant="subtle" onClick={applyStandardArray}>Sugerir</Button></div>}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {ABILITIES.map((a) => {
                const final = stats?.abilities[a] ?? scores[a];
                return (
                  <div key={a} className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
                    <div className="flex-1">
                      <p className="font-semibold">{ABILITY_LABELS[a].label} {cls.primaryAbilities.includes(a as never) && '⭐'}</p>
                      <p className="text-[11px] text-slate-400">{ABILITY_LABELS[a].hint}</p>
                    </div>
                    <Button size="sm" variant="subtle" onClick={() => setScore(a, scores[a] - 1)}>−</Button>
                    <div className="w-14 text-center">
                      <p className="text-lg font-bold">{scores[a]}</p>
                      <p className="text-[10px] text-slate-400">custo {POINT_BUY_COST[scores[a]]}</p>
                    </div>
                    <Button size="sm" variant="subtle" onClick={() => setScore(a, scores[a] + 1)}>+</Button>
                    <div className="w-14 text-center">
                      <p className="text-lg font-bold text-amber-200">{final}</p>
                      <p className="text-[10px] text-slate-400"><Term k="modificador">{formatModifier(abilityModifier(final))}</Term></p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">Valores base de 8 a 15; a coluna dourada já inclui os bônus de raça e do pai olímpico.</p>
          </Card>

          <Card title={`Perícias — escolha ${cls.skillChoices.count}`}>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SKILLS) as Skill[]).map((s) => {
                const fromClass = (cls.skillChoices.from as readonly string[]).includes(s);
                const isGranted = granted.has(s);
                const on = skills.includes(s) || isGranted;
                return (
                  <button key={s} disabled={!fromClass && !isGranted} onClick={() => toggleSkill(s)} className={cx('rounded-full border px-3 py-1 text-sm disabled:opacity-25', on ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-white/5')}>
                    {SKILLS[s].label} <span className="text-[10px] text-slate-400">{ABILITY_LABELS[SKILLS[s].ability].short}</span>{isGranted && ' 🎁'}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">🎁 = concedida pela raça ou pelo pai divino (não conta no limite).</p>
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card title={<span>Passo 4 — Inventário (<Term k="restricao">itens bloqueados</Term> 🔒)</span>} actions={<Button size="sm" variant="subtle" onClick={autoEquip}>Equipar automático</Button>}>
            <p className="mb-2 text-sm text-slate-300">Kit inicial de {cls.label} + até {EXTRA_ITEMS} itens extras. Toque num item bloqueado para ver o motivo.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.values(ITEMS).filter((i) => i.kind !== 'equipamento' || cls.startingKit.includes(i.key as never)).map((item) => {
                const r = check(item);
                const inKit = (cls.startingKit as readonly string[]).includes(item.key);
                const selected = inKit || extras.includes(item.key);
                return (
                  <button
                    key={item.key}
                    onClick={() => (r.allowed || selected ? !inKit && toggleExtra(item.key) : toast(`🔒 ${item.name}: ${r.reasons.join('; ')}`, 'erro'))}
                    className={cx('flex items-start gap-2 rounded-lg border p-2 text-left', selected ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-white/5', !r.allowed && 'opacity-50 grayscale')}
                  >
                    <span className="text-xl">{!r.allowed ? '🔒' : item.kind === 'arma' ? '⚔️' : item.kind === 'consumivel' ? '🧪' : item.kind === 'equipamento' ? '🎒' : '🛡️'}</span>
                    <span className="flex-1">
                      <span className="block font-semibold">{item.name} {inKit && <Badge color="emerald">kit</Badge>} {item.rarity && item.rarity !== 'comum' && <Badge color="violet">{item.rarity}</Badge>}</span>
                      <span className="block text-xs text-slate-400">
                        {item.kind === 'arma' && `${item.damage} ${item.damageType} · ${item.category}${item.bonusVsMonsters ? ` · +${item.bonusVsMonsters} vs monstros` : ''}`}
                        {(item.kind === 'armadura' || item.kind === 'escudo') && `CA ${item.kind === 'escudo' ? '+' : ''}${item.baseAC} · ${item.category}${item.strengthRequirement ? ` · FOR ${item.strengthRequirement}` : ''}`}
                        {item.kind === 'consumivel' && (item.effect.heal ? `Cura ${item.effect.heal}` : `Estamina ${item.effect.stamina}`)}
                      </span>
                      {!r.allowed && <span className="block text-xs text-rose-300">{r.reasons[0]}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
          <Card title="Equipamento">
            <div className="grid gap-3 sm:grid-cols-2">
              {(['mainHand', 'offHand', 'armor', 'shield'] as const).map((slot) => {
                const kind = slot === 'armor' ? 'armadura' : slot === 'shield' ? 'escudo' : 'arma';
                const options = inventoryKeys.filter((k) => ITEMS[k]?.kind === kind);
                const labels = { mainHand: 'Mão principal', offHand: 'Mão secundária', armor: 'Armadura', shield: 'Escudo' };
                return (
                  <label key={slot} className="block">
                    <span className="mb-1 block text-sm text-slate-300">{labels[slot]}</span>
                    <select value={equipment[slot] ?? ''} onChange={(e) => equipSlot(slot, e.target.value || null)} className="w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2">
                      <option value="">— vazio —</option>
                      {options.map((k) => {
                        const ok = check(ITEMS[k]).allowed;
                        return <option key={k} value={k} disabled={!ok}>{ok ? '' : '🔒 '}{ITEMS[k].name}</option>;
                      })}
                    </select>
                  </label>
                );
              })}
            </div>
            {validation.violations.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-rose-300">{validation.violations.map((v, i) => <li key={i}>⚠️ {v.reason}</li>)}</ul>
            )}
            {stats && <p className="mt-3 text-sm text-slate-300"><Term k="ca">CA</Term> resultante: <strong className="text-amber-200">{stats.armorClass}</strong></p>}
          </Card>
        </div>
      )}

      {step === 4 && stats && (
        <div className="space-y-4">
          <Card title="Quem é você?">
            <div className="space-y-3">
              <Field label="Nome do herói" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
              <TextArea label="História (opcional)" value={backstory} onChange={setBackstory} />
            </div>
          </Card>
          <Card title="Revisão">
            <p className="font-display text-lg">{name || '???'} — {raceDef.label} {cls.label}, {divDef.symbol} {divDef.label}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
              {ABILITIES.map((a) => (
                <div key={a} className="rounded-lg bg-white/5 p-2">
                  <p className="text-[11px] text-slate-400">{ABILITY_LABELS[a].short}</p>
                  <p className="text-xl font-bold">{stats.abilities[a]}</p>
                  <p className="text-xs text-amber-200">{formatModifier(stats.modifiers[a])}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Badge color="rose">❤️ <Term k="pv">PV</Term> {stats.maxHp}</Badge>
              <Badge color="sky">🛡️ <Term k="ca">CA</Term> {stats.armorClass}</Badge>
              <Badge color="amber">⚡ <Term k="estamina">Estamina</Term> {stats.maxStamina}</Badge>
              <Badge>🏃 {stats.speed} m ({stats.speedSquares} quadrados)</Badge>
              <Badge>🎯 <Term k="iniciativa">Iniciativa</Term> {formatModifier(stats.initiativeBonus)}</Badge>
              <Badge><Term k="proficiencia">Proficiência</Term> +{stats.proficiencyBonus}</Badge>
              {stats.resistances.length > 0 && <Badge color="emerald">Resiste: {stats.resistances.join(', ')}</Badge>}
            </div>
            {validation.errors.length > 0 && <ul className="mt-3 text-sm text-rose-300">{validation.errors.map((e) => <li key={e}>⚠️ {e}</li>)}</ul>}
          </Card>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl gap-2">
          <Button variant="ghost" className="flex-1" disabled={step === 0} onClick={() => setStep(step - 1)}>Anterior</Button>
          {step < STEPS.length - 1 ? (
            <Button variant="gold" className="flex-[2]" disabled={!canNext} onClick={() => { if (step === 2 && !Object.keys(equipment).length) setTimeout(autoEquip, 0); setStep(step + 1); }}>Próximo</Button>
          ) : (
            <Button variant="gold" className="flex-[2]" disabled={!canNext || busy} onClick={submit}>{busy ? 'Forjando...' : '⚔️ Criar herói'}</Button>
          )}
        </div>
      </nav>
    </div>
  );
}

import { ABILITY_LABELS, SKILLS, type Ability, type Skill } from '../rules/abilities';
import { d20Formula, roll, type AdvantageState } from '../dice';
import { CommandError, type EngineContext } from './context';
import type { CheckKind, PendingCheck, Token } from './types';

export const CHECK_HISTORY = 30;

export function checkLabel(kind: CheckKind, key: string): string {
  if (kind === 'pericia') return SKILLS[key as Skill]?.label ?? key;
  const ab = ABILITY_LABELS[key as Ability]?.label ?? key;
  return kind === 'resistencia' ? `Resistência de ${ab}` : `Teste de ${ab}`;
}

/** Modificador do token para o teste (atributo + proficiência quando treinado). */
export function checkModifier(t: Token, kind: CheckKind, key: string): { mod: number; proficient: boolean } {
  if (kind === 'pericia') {
    const skill = SKILLS[key as Skill];
    if (!skill) throw new CommandError('Perícia desconhecida');
    const proficient = (t.skills ?? []).includes(key);
    return { mod: t.abilityMods[skill.ability] + (proficient ? t.proficiency : 0), proficient };
  }
  if (!(key in t.abilityMods)) throw new CommandError('Atributo desconhecido');
  const proficient = kind === 'resistencia' && (t.saves ?? []).includes(key);
  return { mod: t.abilityMods[key as Ability] + (proficient ? t.proficiency : 0), proficient };
}

export function requestChecks(
  ctx: EngineContext,
  opts: { userIds: string[] | 'todos'; kind: CheckKind; key: string; dc: number; secretDc: boolean; label?: string | null },
): PendingCheck[] {
  const { state } = ctx;
  const heroes = state.tokens.filter((t) => t.kind === 'personagem' && t.ownerUserId && !t.dead && !t.hidden);
  const chosen = opts.userIds === 'todos' ? heroes : heroes.filter((t) => (opts.userIds as string[]).includes(t.ownerUserId!));
  if (!chosen.length) throw new CommandError('Nenhum herói na mesa para fazer o teste');
  const name = checkLabel(opts.kind, opts.key);
  const created: PendingCheck[] = chosen.map((t) => ({
    id: ctx.id('chk'),
    userId: t.ownerUserId!,
    tokenId: t.id,
    kind: opts.kind,
    key: opts.key,
    dc: opts.dc,
    secretDc: opts.secretDc,
    label: opts.label ?? null,
    status: 'pendente',
    createdAt: ctx.now,
  }));
  state.checks = [...(state.checks ?? []), ...created].slice(-CHECK_HISTORY);
  ctx.log(
    `🎯 O Mestre pede: ${name}${opts.secretDc ? '' : ` CD ${opts.dc}`}${opts.label ? ` — ${opts.label}` : ''} (${chosen.map((t) => t.name).join(', ')})`,
    { type: 'teste' },
  );
  return created;
}

export function rollCheck(ctx: EngineContext, checkId: string, adv: AdvantageState = 'normal') {
  const { state, actor } = ctx;
  const check = (state.checks ?? []).find((c) => c.id === checkId);
  if (!check) throw new CommandError('Teste não encontrado');
  if (check.status !== 'pendente') throw new CommandError('Este teste já foi rolado');
  if (actor.role !== 'MASTER' && check.userId !== actor.userId) throw new CommandError('Este teste é de outro jogador', 'forbidden');
  const t = state.tokens.find((x) => x.id === check.tokenId);
  if (!t) throw new CommandError('Personagem não está na mesa');

  // Vantagem natural contra condições (bênçãos de raça/divindade)
  const { mod, proficient } = checkModifier(t, check.kind, check.key);
  const r = roll(d20Formula(mod, adv), ctx.rng);
  const success = r.total >= check.dc;
  check.status = success ? 'sucesso' : 'falha';
  check.total = r.total;
  check.natural = r.natural;
  const name = checkLabel(check.kind, check.key);
  const sign = mod >= 0 ? `+${mod}` : String(mod);
  ctx.log(
    `${success ? '✅' : '❌'} ${t.name} — ${name}${check.label ? ` (${check.label})` : ''}: d20 ${r.natural ?? '?'} ${sign}${proficient ? ' (treinado)' : ''} = ${r.total}` +
      `${check.secretDc ? '' : ` vs CD ${check.dc}`} → ${success ? 'SUCESSO' : 'FALHA'}`,
    { type: 'teste', data: { checkId, total: r.total, natural: r.natural, success } },
  );
  ctx.emit({ type: 'dado', total: r.total, formula: r.formula, visibility: 'publico' });
  return { success, total: r.total };
}

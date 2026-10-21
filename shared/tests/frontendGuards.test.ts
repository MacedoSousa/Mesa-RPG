import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

/**
 * Guarda de regressão para os clientes React.
 * Um efeito com corpo de expressão, como useEffect(() => el.scrollIntoView()),
 * devolve o valor da expressão. Navegadores recentes fazem scrollIntoView devolver
 * uma Promise, o React a trata como "função de limpeza" e a tela quebrava a cada ação.
 * Todo efeito deve ter corpo em bloco: useEffect(() => { ... }).
 */
const ROOT = path.resolve(__dirname, '../..');
const CLIENTS = ['client-common/src', 'client-host/src', 'client-web/src'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(tsx?|jsx?)$/.test(name) ? [full] : [];
  });
}

describe('Guardas do frontend', () => {
  const sources = CLIENTS.flatMap((d) => files(path.join(ROOT, d)));

  it('encontra os arquivos dos clientes', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it.each(CLIENTS)('%s: nenhum useEffect devolve valor por engano', (dir) => {
    const offenders: string[] = [];
    for (const file of sources.filter((f) => f.includes(path.join(ROOT, dir)))) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/use(Layout)?Effect\(\s*\(\)\s*=>(?!\s*\{)/.test(line) || /use(Layout)?Effect\(\s*[a-zA-Z_]\w*\s*[,)]/.test(line)) {
          offenders.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

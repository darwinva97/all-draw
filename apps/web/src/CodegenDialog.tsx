/**
 * Diálogo "Generar código…" (menú Importar / Exportar): elige un generador de `@all-draw/codegen` aplicable a la
 * vista actual (o al espacio), muestra los ficheros con un resaltado sencillo y permite copiarlos o descargarlos
 * (un fichero tal cual; varios, en un .zip con `fflate`). Se carga perezosamente: ni el generador ni fflate entran
 * en el paquete inicial.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { GENERATORS, type CodeFile, type CodegenResult, type Generator, type GeneratorId } from '@all-draw/codegen';
import { useEditor, Icon, HelpLink, toast } from '@all-draw/editor';
import { tMsg, useT } from '@all-draw/i18n';
import { useDialog } from './Auth';
import './codegen.css';

/** Líneas que se pintan con resaltado; el resto se muestra sin colorear (rendimiento con salidas enormes). */
const MAX_HIGHLIGHT_LINES = 3000;

function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileBase = (s: string, fallback: string) =>
  // oxlint-disable-next-line no-control-regex -- los controles tampoco valen en un nombre de fichero
  s.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, '_').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 80) || fallback;

export default function CodegenDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { store, viewId } = useEditor();
  const box = useDialog(onClose);
  // Una foto del espacio al abrir: el código no cambia mientras se mira.
  const ws = useMemo(() => store.snapshot(), [store]);
  const view = viewId ? ws.views[viewId] : undefined;
  const forView = useMemo(() => (view ? GENERATORS.filter(g => safeApplies(g, ws, view.id)) : []), [ws, view]);
  const forSpace = useMemo(() => GENERATORS.filter(g => !forView.includes(g) && safeApplies(g, ws, null)), [ws, forView]);
  const [genId, setGenId] = useState<GeneratorId | null>(() => (forView[0] ?? forSpace[0])?.id ?? null);
  const gen = GENERATORS.find(g => g.id === genId);
  const scoped = !!gen && forView.includes(gen);
  const result = useMemo((): CodegenResult | { error: string } | null => {
    if (!gen) return null;
    try { return gen.generate(ws, scoped && view ? { viewId: view.id } : {}); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  }, [gen, ws, scoped, view]);
  const files = result && 'files' in result ? result.files : [];
  const [fileIdx, setFileIdx] = useState(0);
  const file: CodeFile | undefined = files[Math.min(fileIdx, files.length - 1)];
  const base = fileBase(scoped ? view?.name ?? '' : ws.meta.name, t('codigo'));

  const pick = (id: GeneratorId) => { setGenId(id); setFileIdx(0); };
  const copy = async () => {
    if (!file) return;
    try { await navigator.clipboard.writeText(file.content); toast.success(t('Copiado al portapapeles'), { description: file.path }); }
    catch { toast.error(t('No se pudo copiar al portapapeles')); }
  };
  const download = () => {
    if (!files.length || !gen) return;
    if (files.length === 1) { const f = files[0]!; downloadBlob(f.path.split('/').pop() || f.path, new Blob([f.content], { type: 'text/plain;charset=utf-8' })); return; }
    const zip = zipSync(Object.fromEntries(files.map(f => [f.path, strToU8(f.content)])), { level: 6 });
    downloadBlob(`${base}-${gen.id}.zip`, new Blob([zip as BlobPart], { type: 'application/zip' }));
  };

  const option = (g: Generator) => <option key={g.id} value={g.id}>{t(g.label)}</option>;
  return (
    <div className="modal" onClick={onClose}>
      <div ref={box} className="modal__box codegen" role="dialog" aria-modal="true" aria-labelledby="codegen-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <h2 id="codegen-title">{t('Generar código')}</h2>
        <p className="modal__lead">{t('Código de partida a partir del modelo: clases, esquemas SQL, máquinas XState, OpenAPI o Structurizr. El espacio no cambia.')}</p>
        {!forView.length && !forSpace.length
          ? <p className="codegen__empty">{t('Nada que generar: abre una vista de clases UML, entidad-relación, estados, C4 o ArchiMate, o importa una API.')}</p>
          : <>
            <div className="codegen__pick">
              <label htmlFor="codegen-gen">{t('Generador')}</label>
              <select id="codegen-gen" className="input" value={genId ?? ''} onChange={e => pick(e.target.value as GeneratorId)}>
                {forView.length > 0 && <optgroup label={t('Para la vista «{name}»', { name: view?.name ?? '' })}>{forView.map(option)}</optgroup>}
                {forSpace.length > 0 && <optgroup label={t('Para todo el espacio')}>{forSpace.map(option)}</optgroup>}
              </select>
            </div>
            {gen && <p className="codegen__desc">{t(gen.description)}</p>}
            {result && 'error' in result && <p className="codegen__error" role="alert">{t('No se pudo generar: {error}', { error: result.error })}</p>}
            {result && 'warnings' in result && result.warnings.length > 0 && (
              <details className="codegen__warn">
                <summary><Icon name="warning" size={14} />{t('{n} avisos', { n: result.warnings.length })}</summary>
                <ul>{result.warnings.map((w, i) => <li key={i}>{tMsg(w.key, w.vars)}</li>)}</ul>
              </details>
            )}
            {files.length > 1 && (
              <div className="codegen__files" role="tablist" aria-label={t('Ficheros generados')}>
                {files.map((f, i) => <button key={f.path} role="tab" aria-selected={file === f} className={file === f ? 'is-on' : ''} onClick={() => setFileIdx(i)} title={f.path}>{f.path.split('/').pop()}</button>)}
              </div>
            )}
            {file && <>
              <div className="codegen__path"><code>{file.path}</code><span>{t('{n} líneas', { n: file.content.split('\n').length })}</span></div>
              <pre className={`codegen__code lang-${file.language}`} tabIndex={0} aria-label={t('Vista previa de {file}', { file: file.path })}><code>{highlight(file.content, file.language)}</code></pre>
            </>}
            {result && 'files' in result && !files.length && <p className="codegen__empty">{t('El generador no ha producido ningún fichero.')}</p>}
          </>}
        <div className="modal__foot">
          <HelpLink slug="generar-codigo" />
          <span className="spacer" />
          <button className="btn" onClick={copy} disabled={!file}><Icon name="copy" size={14} />{t('Copiar')}</button>
          <button className="btn btn--primary" onClick={download} disabled={!files.length}><Icon name="download" size={14} />{files.length > 1 ? t('Descargar .zip ({n} ficheros)', { n: files.length }) : t('Descargar')}</button>
          <button className="btn" onClick={onClose}>{t('Cerrar')}</button>
        </div>
      </div>
    </div>
  );
}

function safeApplies(g: Generator, ws: Parameters<Generator['applies']>[0], viewId: string | null): boolean {
  try { return g.applies(ws, viewId); } catch { return false; }
}

// ---------------------------------------------------------------- resaltado mínimo (sin dependencias)
const KW: Record<string, RegExp> = {
  typescript: /^(?:import|export|from|const|let|var|function|return|class|interface|enum|extends|implements|type|public|private|protected|readonly|abstract|static|new|throw|if|else|async|await|as|of|in|void|null|undefined|true|false|string|number|boolean|unknown|Date)$/,
  java: /^(?:package|import|public|private|protected|static|final|abstract|class|interface|enum|extends|implements|void|return|new|throw|this|null|true|false|int|long|double|boolean|String|List|var)$/,
  sql: /^(?:CREATE|TABLE|INDEX|UNIQUE|PRIMARY|KEY|FOREIGN|REFERENCES|NOT|NULL|DEFAULT|ON|DELETE|UPDATE|CASCADE|SET|RESTRICT|NO|ACTION|ALTER|ADD|CONSTRAINT|IF|EXISTS|INTEGER|BIGINT|SMALLINT|SERIAL|BIGSERIAL|TEXT|VARCHAR|CHAR|NUMERIC|DECIMAL|REAL|DOUBLE|PRECISION|BOOLEAN|DATE|TIMESTAMP|TIMESTAMPTZ|TIME|UUID|JSON|JSONB|BLOB|BYTEA|PRAGMA|BEGIN|COMMIT|WITH|CHECK|AUTOINCREMENT)$/i,
  text: /^(?:workspace|model|views|person|softwareSystem|container|component|element|group|deploymentEnvironment|deploymentNode|containerInstance|softwareSystemInstance|infrastructureNode|systemLandscape|systemContext|custom|include|exclude|autoLayout|styles|tags|description|technology|properties|theme|title|!identifiers|!docs)$/,
  yaml: /^(?:true|false|null)$/,
  markdown: /^$/,
};
const TOKEN: Record<string, RegExp> = {
  typescript: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g,
  java: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*|@\w+)/g,
  sql: /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\n]|'')*'|"(?:[^"\n])*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)/g,
  text: /(#[^\n]*|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(!?[A-Za-z_][\w]*)/g,
  yaml: /(#[^\n]*)|('(?:[^'\n]|'')*'|"(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(^[ \t]*-?[ \t]*[\w$./{}-]+(?=:)|[A-Za-z_][\w]*)/gm,
  markdown: /(^#{1,6} [^\n]*)|(`[^`\n]*`)|(\|)|(\*\*[^*\n]+\*\*)/gm,
};

/** Trocea el código en `<span>` por tipo de token (comentario, cadena, número, palabra clave / clave YAML). */
function highlight(code: string, language: string): ReactNode[] {
  const re = TOKEN[language] ?? TOKEN.text!;
  const kw = KW[language] ?? KW.text!;
  const lines = code.split('\n');
  const head = lines.length > MAX_HIGHLIGHT_LINES ? lines.slice(0, MAX_HIGHLIGHT_LINES).join('\n') : code;
  const tail = lines.length > MAX_HIGHLIGHT_LINES ? '\n' + lines.slice(MAX_HIGHLIGHT_LINES).join('\n') : '';
  const out: ReactNode[] = [];
  let last = 0, k = 0;
  re.lastIndex = 0;
  for (let m = re.exec(head); m; m = re.exec(head)) {
    if (m[0] === '') { re.lastIndex++; continue; }
    if (m.index > last) out.push(head.slice(last, m.index));
    const [whole, comment, str, num, word] = m;
    let cls = '';
    if (language === 'markdown') cls = comment !== undefined ? 'tk-kw' : str !== undefined ? 'tk-str' : num !== undefined ? 'tk-punct' : 'tk-strong';
    else if (comment !== undefined) cls = 'tk-com';
    else if (str !== undefined) cls = 'tk-str';
    else if (num !== undefined) cls = 'tk-num';
    else if (word !== undefined) cls = language === 'yaml' && head[m.index + word.length] === ':' ? 'tk-key' : kw.test(word.trim()) ? 'tk-kw' : '';
    out.push(cls ? <span key={k++} className={cls}>{whole}</span> : whole);
    last = m.index + whole.length;
  }
  if (last < head.length) out.push(head.slice(last));
  if (tail) out.push(tail);
  return out;
}

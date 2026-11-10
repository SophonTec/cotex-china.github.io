import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, rmSync, renameSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep the password out of source, command arguments, logs and published assets.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(process.argv[2] || join(repo, '..', 'cotex-ambill-tool'));
const target = join(repo, 'tools', 'ambill');
const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
if (!password) throw new Error('Provide the shared password on stdin');
const template = readFileSync(join(repo, 'scripts', 'ambill-password-gate.html'), 'utf8');
const marker = '__ENCRYPTED_TOOL__';
if (template.split(marker).length !== 2) throw new Error('Expected one payload marker');

function pages(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ['node_modules', 'scripts', 'lib', 'js', 'css', 'assets', 'data', '__pycache__'].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

function asset(page, url) {
  if (/^(?:[a-z]+:|\/\/|\/)/i.test(url) || /[?#]/.test(url)) throw new Error(`Unsupported asset reference: ${url}`);
  const path = resolve(dirname(page), url);
  const rel = relative(source, path);
  if (rel.startsWith('..' + sep) || rel === '..') throw new Error('Asset escapes source directory');
  return { path, rel: rel.split(sep).join('/') };
}

function bundle(page) {
  let html = readFileSync(page, 'utf8');
  html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?\s*>/g, (_, url) => {
    const { path } = asset(page, url);
    const css = readFileSync(path, 'utf8');
    if (/url\s*\(/i.test(css)) throw new Error('Bundle CSS image/font references before publishing');
    return `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
  });
  html = html.replace(/<script\s+src="([^"]+)"\s*>\s*<\/script>/g, (_, url) => {
    const { path, rel } = asset(page, url);
    // Generic libraries contain no company-specific content and support OCR workers.
    if (rel.startsWith('lib/')) return `<script src="/tools/ambill/${rel}"></script>`;
    let script = readFileSync(path, 'utf8');
    // Workers must honor the tool's base path even on nested HTML entrypoints.
    if (rel === 'js/bl.js') script = script.replace('new URL(p, location.href)', 'new URL(p, document.baseURI)');
    return `<script>\n${script.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  });
  // First-party content must be encrypted, not left as publicly reachable files.
  if (/(?:src|href)="(?:\.\.\/)*(?:js|css|assets)\//.test(html)) {
    throw new Error('Unbundled first-party reference');
  }
  html = html.replace('<head>', '<head>\n<base href="/tools/ambill/">');
  return Buffer.from(html);
}

function seal(plaintext) {
  const iterations = 600000;
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(ciphertext.subarray(-16));
  const restored = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
  if (!restored.equals(plaintext)) throw new Error('Encryption round-trip verification failed');
  key.fill(0);
  restored.fill(0);
  plaintext.fill(0);
  return template.replace(marker, JSON.stringify({
    version: 1, iterations,
    salt: salt.toString('base64'), iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'),
  }));
}

// Prepare every HTML page before changing the published subtree. Never copy raw
// application JS, company assets, config, or the source repository into Pages.
const output = pages(source).map(page => ({ path: relative(source, page), html: seal(bundle(page)) }));
if (!output.some(page => page.path === 'index.html')) throw new Error('Missing index.html');
const stage = join(repo, 'tools', `.ambill-stage-${process.pid}`);
const backup = join(repo, 'tools', `.ambill-backup-${process.pid}`);
mkdirSync(stage, { recursive: true });
try {
  cpSync(join(source, 'lib'), join(stage, 'lib'), { recursive: true });
  for (const page of output) {
    const path = join(stage, page.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, page.html);
  }
  const hadTarget = existsSync(target);
  if (hadTarget) renameSync(target, backup);
  try { renameSync(stage, target); }
  catch (error) { if (hadTarget) renameSync(backup, target); throw error; }
  if (hadTarget) rmSync(backup, { recursive: true });
} finally {
  rmSync(stage, { recursive: true, force: true });
}
console.log(`Prepared ${output.length} encrypted HTML page(s) under tools/ambill/.`);

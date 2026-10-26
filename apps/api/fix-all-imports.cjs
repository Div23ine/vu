const fs = require('fs');
const path = require('path');

const EXT = /\.(js|mjs|cjs|jsx|json|css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|html|md|yaml|yml)$/i;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.open-next', '.turbo', '.git', 'coverage']);

function fixFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  const original = src;
  const fix = (p) => {
    if (EXT.test(p)) return p;
    if (p.endsWith('.ts')) return p.slice(0, -3) + '.js';
    if (p.endsWith('.tsx')) return p.slice(0, -4) + '.js';
    return p + '.js';
  };

  // import ... from '...'
  src = src.replace(/(\bfrom\s+['"])(\.\.?\/[^'"]+?)(['"])/g, (m, p1, p2, p3) => p1 + fix(p2) + p3);
  // export ... from '...'
  src = src.replace(/(\bexport\s+(?:\*|\{[^}]*\})\s+from\s+['"])(\.\.?\/[^'"]+?)(['"])/g, (m, p1, p2, p3) => p1 + fix(p2) + p3);
  // dynamic import('...')
  src = src.replace(/(\bimport\s*\(\s*['"])(\.\.?\/[^'"]+?)(['"]\s*\))/g, (m, p1, p2, p3) => p1 + fix(p2) + p3);

  if (src !== original) {
    fs.writeFileSync(filePath, src);
    return true;
  }
  return false;
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(p, out);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(p);
    }
  }
}

const files = [];
for (const d of ['apps', 'packages']) walk(d, files);

let count = 0;
for (const f of files) if (fixFile(f)) count++;
console.log(`Fixed ${count} of ${files.length} files`);

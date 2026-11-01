#!/usr/bin/env node
/**
 * 断言 AGENTS.md 与 docs/ 目录中引用的每个 `--cds-*` 都在 cds-theme.css 里有权威定义，
 * 并断言每个 `@keyframes cds-*` 关键帧都有明确的消费类 (Consumer Class)。
 * 退出码 0 = 全部通过，1 = 存在未定义引用或孤立关键帧（用作 CI 门禁）。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] ?? '.');
const CSS = 'code-examples/cds-theme.css';
const DOC = 'AGENTS.md';
const DOCS_DIR = 'docs';

const cssPath = path.join(ROOT, CSS);
const docPath = path.join(ROOT, DOC);
const docsDirPath = path.join(ROOT, DOCS_DIR);

const css = fs.readFileSync(cssPath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

const defined = new Map();
for (const m of css.matchAll(/(--cds-[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
  if (!defined.has(m[1])) defined.set(m[1], m[2].trim());
}

// 递归提取目录下所有 markdown 和 html 中的 --cds-* 引用
function findTokensInDir(dir) {
  if (!fs.existsSync(dir)) return [];
  let tokens = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tokens = tokens.concat(findTokensInDir(full));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.html')) {
      const content = fs.readFileSync(full, 'utf8');
      const matched = [...content.matchAll(/`(--cds-[a-z0-9-]+)`/g)].map((m) => m[1]);
      tokens = tokens.concat(matched);
    }
  }
  return tokens;
}

const agentsTokens = [...new Set([...doc.matchAll(/`(--cds-[a-z0-9-]+)`/g)].map((m) => m[1]))];
const docsTokens = [...new Set(findTokensInDir(docsDirPath))];
const referenced = [...new Set([...agentsTokens, ...docsTokens])];
const missingTokens = referenced.filter((t) => !defined.has(t));

console.log(`定义: ${defined.size} 个 token（${CSS}）`);
console.log(`引用: ${agentsTokens.length} 个 token（${DOC}）+ ${docsTokens.length} 个 token（${DOCS_DIR}/）共 ${referenced.length} 个不重复引用`);

let hasError = false;

if (missingTokens.length) {
  hasError = true;
  console.log(`\n✗ ${missingTokens.length} 个引用没有定义：\n`);
  for (const t of missingTokens) {
    const stem = t.replace(/^--cds-/, '').split('-')[0];
    const near = [...defined.keys()].filter((d) => d.startsWith(`--cds-${stem}`));
    console.log(`  ${t}`);
    if (near.length) console.log(`      同词根候选: ${near.join(', ')}`);
  }
} else {
  console.log('\n✓ 全部 Token 引用都有权威定义');
}

// 门禁 2: 断言所有 @keyframes cds-* 都有消费类 (防止孤立关键帧)
const cdsKeyframes = [...new Set([...css.matchAll(/@keyframes\s+(cds-[a-zA-Z0-9_-]+)/g)].map((m) => m[1]))];
const orphanedKeyframes = [];

// 先剥离注释再判断消费：注释里提到的关键帧名不算消费
// （复现：`/* TODO: cds-xxx 待接入 */` 曾被误判为已消费）
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

for (const kf of cdsKeyframes) {
  // 移除关键帧自身定义后，查找是否有对该动画名的消费规则
  const withoutDef = cssNoComments.replace(new RegExp(`@keyframes\\s+${kf}[^{]*\\{[^}]*(?:\\{[^}]*\\}[^}]*)*\\}`, 'g'), '');
  const isConsumed = new RegExp(`\\b${kf}\\b`).test(withoutDef);
  if (!isConsumed) {
    orphanedKeyframes.push(kf);
  }
}

console.log(`\n关键帧消费审计: ${cdsKeyframes.length} 个 @keyframes cds-* 检查`);
if (orphanedKeyframes.length) {
  hasError = true;
  console.log(`\n✗ ${orphanedKeyframes.length} 个关键帧无消费类 (Orphaned Keyframes)：\n`);
  for (const kf of orphanedKeyframes) {
    console.log(`  @keyframes ${kf}`);
  }
} else {
  console.log('✓ 全部 @keyframes cds-* 均有明确消费类');
}

// 门禁 3: 显式断言骨架屏核心 Token
const skeletonRequired = ['--cds-skel-i', '--cds-skeleton-base', '--cds-skeleton-sheen'];
const missingSkeleton = skeletonRequired.filter((t) => !defined.has(t));
if (missingSkeleton.length) {
  hasError = true;
  console.log(`\n✗ 缺失骨架屏核心动效 Token: ${missingSkeleton.join(', ')}`);
} else {
  console.log('✓ 骨架屏双模式动效核心 Token (--cds-skel-i, base, sheen) 完整就位');
}

if (hasError) {
  process.exit(1);
}

console.log('\n✨ 所有设计令牌与动效关键帧消费校验全部通过！');
process.exit(0);

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function fail(msg) { errors.push(msg); }

const raw = await readFile(join(root, 'data/data.json'), 'utf8').catch(() => null);
if (raw === null) { fail('data/data.json 不存在'); }

let data = null;
if (raw !== null) {
  try { data = JSON.parse(raw); } catch (e) { fail('data.json 不是合法 JSON: ' + e.message); }
}

if (data) {
  if (!data.overview || typeof data.overview !== 'object') fail('缺少 overview');
  if (!Array.isArray(data.majors)) fail('majors 必须是数组');

  for (const [i, m] of (data.majors ?? []).entries()) {
    const tag = `majors[${i}] (${m?.name ?? '?'})`;
    if (!m.id) fail(`${tag}: 缺少 id`);
    if (!m.name) fail(`${tag}: 缺少 name`);
    if (!m.field) fail(`${tag}: 缺少 field`);
    if (m.discipline !== '理工科') fail(`${tag}: discipline 必须为 理工科`);
    if (!Array.isArray(m.greenYears) || m.greenYears.length === 0) fail(`${tag}: greenYears 不能为空`);
    if (!m.salary || (m.salary.value !== null && typeof m.salary.value !== 'number')) fail(`${tag}: salary.value 必须是数字或 null`);
    // salary.value 为 null 时允许 sources 为空（暂无数据）
    if (m.salary.value !== null && (!Array.isArray(m.salary?.sources) || m.salary.sources.length === 0)) fail(`${tag}: salary 缺少 sources`);
    for (const [j, s] of (m.salary?.sources ?? []).entries()) {
      if (!s.url) fail(`${tag}.salary.sources[${j}]: 缺少 url`);
      if (s.type !== '一手' && s.type !== '二手') fail(`${tag}.salary.sources[${j}]: type 必须是 一手 或 二手`);
    }
    if (!m.summary) fail(`${tag}: 缺少 summary`);
    if (!Array.isArray(m.positions) || m.positions.length === 0) fail(`${tag}: positions 不能为空`);
    for (const [j, p] of (m.positions ?? []).entries()) {
      if (!p.title) fail(`${tag}.positions[${j}]: 缺少 title`);
      if (!p.detail) fail(`${tag}.positions[${j}]: 缺少 detail`);
    }
    if (!Array.isArray(m.sources) || m.sources.length === 0) fail(`${tag}: 缺少 sources（每个专业必带来源）`);
    for (const [j, s] of (m.sources ?? []).entries()) {
      if (!s.url) fail(`${tag}.sources[${j}]: 缺少 url`);
      if (s.type !== '一手' && s.type !== '二手') fail(`${tag}.sources[${j}]: type 必须是 一手 或 二手`);
    }
  }
}

if (errors.length) {
  console.error('❌ 校验失败：');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✅ 校验通过：${data.majors.length} 个专业`);

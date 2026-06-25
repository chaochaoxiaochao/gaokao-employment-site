export async function loadData() {
  const res = await fetch('data/data.json');
  if (!res.ok) throw new Error('data.json 加载失败: ' + res.status);
  return res.json();
}

export function renderOverview(overview, el) {
  const years = overview.years ?? [];
  const rateRows = (overview.employmentRate ?? [])
    .map((r, i) => `<tr><td>${years[i] ?? ''}</td><td>${r ?? '—'}</td></tr>`)
    .join('');
  const fields = (overview.greenFieldConcentration ?? [])
    .map(f => `<li>${f.field}：${f.note ?? ''}</li>`)
    .join('');
  el.innerHTML = `
    <p>近五年（${years[0] ?? ''}–${years[years.length - 1] ?? ''}）本科就业概况。</p>
    ${rateRows ? `<table class="data-table"><thead><tr><th>年份</th><th>就业率</th></tr></thead><tbody>${rateRows}</tbody></table>` : '<p class="muted">就业率数据待核验填充。</p>'}
    ${fields ? `<h3>绿牌方向集中度</h3><ul>${fields}</ul>` : ''}
  `;
}

export function renderMajorList(majors, { listEl, searchEl, fieldEl, sortEl }) {
  // 填充方向下拉
  const fields = [...new Set(majors.map(m => m.field))].sort();
  for (const f of fields) {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    fieldEl.appendChild(opt);
  }

  function apply() {
    const q = searchEl.value.trim();
    const field = fieldEl.value;
    const sort = sortEl.value;
    let rows = majors.filter(m =>
      (!q || m.name.includes(q)) && (!field || m.field === field)
    );
    rows.sort((a, b) => {
      if (sort === 'salary-asc') return a.salary.value - b.salary.value;
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh');
      return b.salary.value - a.salary.value; // salary-desc 默认
    });
    listEl.innerHTML = rows.length
      ? rows.map(m => `
          <li class="major-card">
            <a href="major.html?id=${encodeURIComponent(m.id)}">
              <span class="major-name">${m.name}</span>
              <span class="major-field">${m.field}</span>
              <span class="major-salary">参考月收入 ¥${m.salary.value}</span>
              <span class="major-green">绿牌年份：${m.greenYears.join('、')}</span>
            </a>
          </li>`).join('')
      : '<li class="muted">没有匹配的专业。</li>';
  }

  searchEl.addEventListener('input', apply);
  fieldEl.addEventListener('change', apply);
  sortEl.addEventListener('change', apply);
  apply();
}

export function renderMajorDetail(major, el) {
  if (!major) { el.innerHTML = '<p class="muted">未找到该专业。</p>'; return; }
  const positions = major.positions.map(p => `
    <li class="position">
      <span class="position-title">${p.title}</span>
      <p class="position-detail">${p.detail}</p>
    </li>`).join('');
  const sources = major.sources.map(s =>
    `<li><a href="${s.url}" target="_blank" rel="noopener">${s.name}</a> <span class="src-type">[${s.type}]</span></li>`
  ).join('');
  el.innerHTML = `
    <h2>${major.name}</h2>
    <p class="major-meta">${major.field} · ${major.discipline} · 绿牌年份：${major.greenYears.join('、')}</p>
    <section>
      <h3>就业表现</h3>
      <p>${major.summary}</p>
      <p>参考月收入：<strong>¥${major.salary.value}</strong>（${major.salary.year} 届）</p>
    </section>
    <section>
      <h3>对应岗位</h3>
      <ul class="position-list">${positions}</ul>
    </section>
    <section class="sources">
      <h3>数据来源</h3>
      <ul>${sources}</ul>
      <p class="muted">岗位说明为编辑整理，非来源统计。</p>
    </section>
  `;
}

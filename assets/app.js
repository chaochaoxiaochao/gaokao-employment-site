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
      if (sort === 'salary-asc') return (a.salary.value ?? 0) - (b.salary.value ?? 0);
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh');
      return (b.salary.value ?? 0) - (a.salary.value ?? 0); // salary-desc 默认
    });
    listEl.innerHTML = rows.length
      ? rows.map(m => `
          <li class="major-card">
            <a href="major.html?id=${encodeURIComponent(m.id)}">
              <span class="major-name">${m.name}</span>
              <span class="major-field">${m.field}</span>
              <span class="major-salary">${m.salary.value ? `参考月收入 ¥${m.salary.value}` : '月收入数据待补充'}</span>
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

// Boss直聘招聘热度排序（来源：boss-demand subagent 综合判断，2026-06-25）
const BOSS_DEMAND_RANK = [
  '自动化', '电气工程及其自动化', '新能源科学与工程', '微电子科学与工程',
  '机器人工程', '车辆工程', '机械电子工程', '信息安全',
  '信息工程', '网络工程', '能源与动力工程',
];

export function renderCharts(majors, { salary, greenCount, greenTimeline, demand }) {
  const GREEN_YEARS = [2022, 2023, 2024, 2025, 2026];
  const ACCENT = '#1f8a4c';
  const COLORS = ['#1f8a4c','#2da05a','#3db668','#56c97e','#74d994',
                  '#96e5ae','#b8f0c8','#1a6e3e','#145c33','#0e4a28','#083819'];

  // ── 图表1：参考月收入横向柱状图 ──
  const salaryData = majors
    .filter(m => m.salary.value)
    .sort((a, b) => a.salary.value - b.salary.value);
  if (salary && salaryData.length) {
    const c1 = echarts.init(salary);
    c1.setOption({
      tooltip: { trigger: 'axis', formatter: p => `${p[0].name}<br/>¥${p[0].value} /月` },
      grid: { left: 140, right: 60, top: 10, bottom: 30 },
      xAxis: { type: 'value', axisLabel: { formatter: v => `¥${v}` }, min: 5000 },
      yAxis: { type: 'category', data: salaryData.map(m => m.name), axisLabel: { fontSize: 12 } },
      series: [{
        type: 'bar', data: salaryData.map(m => m.salary.value),
        itemStyle: { color: ACCENT },
        label: { show: true, position: 'right', formatter: p => `¥${p.value}` },
      }],
    });
    window.addEventListener('resize', () => c1.resize());
  }

  // ── 图表2：绿牌上榜年数横向柱状图 ──
  const countData = [...majors].sort((a, b) => b.greenYears.length - a.greenYears.length);
  if (greenCount && countData.length) {
    const c2 = echarts.init(greenCount);
    c2.setOption({
      tooltip: { trigger: 'axis', formatter: p => `${p[0].name}<br/>${p[0].value} 年上榜` },
      grid: { left: 140, right: 60, top: 10, bottom: 30 },
      xAxis: { type: 'value', interval: 1, max: GREEN_YEARS.length },
      yAxis: { type: 'category', data: countData.map(m => m.name), axisLabel: { fontSize: 12 } },
      series: [{
        type: 'bar', data: countData.map(m => m.greenYears.length),
        itemStyle: { color: params => COLORS[params.dataIndex % COLORS.length] },
        label: { show: true, position: 'right', formatter: p => `${p.value} 年` },
      }],
    });
    window.addEventListener('resize', () => c2.resize());
  }

  // ── 图表3：绿牌年份时间轴（散点甘特）──
  if (greenTimeline && majors.length) {
    const names = majors.map(m => m.name);
    const scatterData = [];
    majors.forEach((m, yi) => {
      m.greenYears.forEach(year => {
        const xi = GREEN_YEARS.indexOf(year);
        if (xi >= 0) scatterData.push([xi, yi, year]);
      });
    });
    const c3 = echarts.init(greenTimeline);
    c3.setOption({
      tooltip: { formatter: p => `${names[p.value[1]]}<br/>${p.value[2]} 年版绿牌` },
      grid: { left: 140, right: 40, top: 20, bottom: 40 },
      xAxis: {
        type: 'category', data: GREEN_YEARS.map(String),
        axisLabel: { fontSize: 12 }, name: '年版', nameLocation: 'end',
        splitLine: { show: true, lineStyle: { type: 'dashed', color: '#eee' } },
      },
      yAxis: {
        type: 'category', data: names, axisLabel: { fontSize: 12 },
        splitLine: { show: true, lineStyle: { type: 'dashed', color: '#eee' } },
      },
      series: [{
        type: 'scatter',
        data: scatterData.map(d => ({ value: d })),
        symbolSize: 22,
        itemStyle: { color: ACCENT, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
      }],
    });
    window.addEventListener('resize', () => c3.resize());
  }

  // ── 图表4：Boss招聘热度排序（定性，1=最热）──
  if (demand && majors.length) {
    const total = BOSS_DEMAND_RANK.length;
    // 转为热度分：排名1 → 分最高
    const demandData = BOSS_DEMAND_RANK.map((name, i) => ({
      name, score: total - i,
    })).sort((a, b) => a.score - b.score); // 升序，横向柱状图从下往上热度增加
    const c4 = echarts.init(demand);
    c4.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: p => `${p[0].name}<br/>热度排名：第 ${total - p[0].value + 1} 位`,
      },
      grid: { left: 140, right: 60, top: 10, bottom: 40 },
      xAxis: {
        type: 'value', name: '热度（仅供参考）',
        axisLabel: { show: false }, splitLine: { show: false },
      },
      yAxis: { type: 'category', data: demandData.map(d => d.name), axisLabel: { fontSize: 12 } },
      series: [{
        type: 'bar',
        data: demandData.map(d => d.score),
        itemStyle: { color: params => {
          const ratio = params.value / total;
          // 热度低→浅绿，热度高→深绿
          const r = Math.round(31 + (8 - 31) * ratio);
          const g = Math.round(138 + (56 - 138) * (1 - ratio));
          const b = Math.round(76 + (25 - 76) * ratio);
          return `rgb(${r},${g},${b})`;
        }},
        label: {
          show: true, position: 'right',
          formatter: p => `第 ${total - p.value + 1} 位`,
        },
      }],
    });
    window.addEventListener('resize', () => c4.resize());
  }
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
      <p>参考月收入：<strong>${major.salary.value ? `¥${major.salary.value}` : '暂无数据'}</strong>${major.salary.year ? `（${major.salary.year} 届）` : ''}</p>
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

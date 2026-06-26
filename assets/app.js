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

function pgTagClass(rec) {
  if (rec === '强烈推荐') return 'high';
  if (rec === '建议考研') return 'mid';
  if (rec === '本科足够' || rec === '不必考研') return 'low';
  return 'neutral'; // 视情况
}

const LIST_ID_ALIAS = { 'mechatronics': 'mechanical-electronics' };

export function renderMajorList(majors, { listEl, searchEl, fieldEl, sortEl, regionEl }, regional) {
  // 填充方向下拉
  const fields = [...new Set(majors.map(m => m.field))].sort();
  for (const f of fields) {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    fieldEl.appendChild(opt);
  }

  const balanceOf = m => regional?.[LIST_ID_ALIAS[m.id] ?? m.id]?.balance ?? '';

  function apply() {
    const q = searchEl.value.trim();
    const field = fieldEl.value;
    const sort = sortEl.value;
    const region = regionEl ? regionEl.value : '';
    let rows = majors.filter(m =>
      (!q || m.name.includes(q)) &&
      (!field || m.field === field) &&
      (!region || balanceOf(m) === region)
    );
    rows.sort((a, b) => {
      if (sort === 'salary-asc') return (a.salary.value ?? 0) - (b.salary.value ?? 0);
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh');
      return (b.salary.value ?? 0) - (a.salary.value ?? 0); // salary-desc 默认
    });
    listEl.innerHTML = rows.length
      ? rows.map(m => {
          const pg = m.postgrad;
          const pgTag = pg ? `<span class="pg-tag pg-tag--${pgTagClass(pg.recommendation)}">${pg.recommendation}</span>` : '';
          const bal = balanceOf(m);
          const regionTag = bal ? `<span class="top5-tag top5-tag--region">${bal}</span>` : '';
          return `
          <li class="major-card">
            <a href="major.html?id=${encodeURIComponent(m.id)}">
              <span class="major-name">${m.name} ${pgTag}${regionTag}</span>
              <span class="major-field">${m.field}</span>
              <span class="major-salary">${m.salary.value ? `参考月收入 ¥${m.salary.value}` : '月收入数据待补充'}</span>
              <span class="major-green">绿牌年份：${m.greenYears.join('、')}</span>
            </a>
          </li>`;}).join('')
      : '<li class="muted">没有匹配的专业。</li>';
  }

  searchEl.addEventListener('input', apply);
  fieldEl.addEventListener('change', apply);
  sortEl.addEventListener('change', apply);
  if (regionEl) regionEl.addEventListener('change', apply);
  apply();
}

// Boss直聘招聘热度排序（来源：boss-demand subagent 综合判断，2026-06-25）
const BOSS_DEMAND_RANK = [
  '自动化', '电气工程及其自动化', '新能源科学与工程', '微电子科学与工程',
  '机器人工程', '车辆工程', '机械电子工程', '信息安全',
  '信息工程', '网络工程', '能源与动力工程',
];

export function renderCharts(majors, { salary, greenCount, greenTimeline, demand, jobGap }, jobGapData) {
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

  // ── 图表5：人才缺口规模横向柱状图 ──
  if (jobGap && jobGapData) {
    // 取每个专业最新一条有效 gap 数据
    const ID_ALIAS = { 'mechatronics': 'mechanical-electronics' };
    const gapItems = majors.map(m => {
      const key = ID_ALIAS[m.id] ?? m.id;
      const rows = jobGapData[key] ?? [];
      const best = [...rows].reverse().find(r => r.gap != null);
      return best ? { name: m.name, gap: best.gap, year: best.year, note: best.note ?? '' } : null;
    }).filter(Boolean).sort((a, b) => a.gap - b.gap);

    if (gapItems.length) {
      const c5 = echarts.init(jobGap);
      c5.setOption({
        tooltip: {
          trigger: 'axis',
          formatter: p => {
            const item = gapItems[p[0].dataIndex];
            return `${p[0].name}<br/>缺口约 ${(p[0].value / 10000).toFixed(0)} 万人（${item.year}年）<br/><span style="color:#999;font-size:.85em">${item.note}</span>`;
          },
        },
        grid: { left: 160, right: 80, top: 10, bottom: 40 },
        xAxis: {
          type: 'value',
          axisLabel: { formatter: v => v >= 10000 ? `${v / 10000}万` : v },
          name: '人才缺口（人）', nameLocation: 'end', nameGap: 8,
        },
        yAxis: { type: 'category', data: gapItems.map(d => d.name), axisLabel: { fontSize: 12 } },
        series: [{
          type: 'bar',
          data: gapItems.map(d => d.gap),
          itemStyle: { color: '#3b82f6' },
          label: {
            show: true, position: 'right',
            formatter: p => p.value >= 10000 ? `${(p.value / 10000).toFixed(0)}万` : p.value,
          },
        }],
      });
      window.addEventListener('resize', () => c5.resize());
    }
  }
}

// Top5 综合评分排序逻辑：绿牌年数×0.4 + 政策一手密度×0.3 + 薪资分位×0.3
// 结合 Reviewer-2 建议的排序：robotics > new-energy > microelectronics > electrical > automation
const TOP5_ORDER = [
  {
    id: 'robotics',
    tagline: '三大国家专项政策直接命名，人形机器人赛道爆发',
    regionTag: '南北均衡',
  },
  {
    id: 'new-energy',
    tagline: '双碳+新三样政策加持，2024-2025连续绿牌',
    regionTag: '南方更强',
  },
  {
    id: 'microelectronics',
    tagline: '卡脖子攻关典型，四连绿牌最稳定',
    regionTag: '南方更强',
  },
  {
    id: 'electrical-engineering',
    tagline: '新型电力系统核心，三连绿牌随双碳持续向好',
    regionTag: '南北均衡',
  },
  {
    id: 'automation',
    tagline: '2026版新入绿牌，智能制造政策红利显现',
    regionTag: '北方更强',
  },
];

// 绿牌年份时间轴，仅展示 2022–2026
const GREEN_AXIS = [2022, 2023, 2024, 2025, 2026];

export function renderTop5(majors, policyData, employmentData, el, regionalData) {
  if (!el) return;
  const majorMap = Object.fromEntries(majors.map(m => [m.id, m]));
  // data.json 用 mechatronics 而非 mechanical-electronics，做个映射
  const ID_ALIAS = { 'mechanical-electronics': 'mechatronics' };

  const cards = TOP5_ORDER.map((item, idx) => {
    const dataId = ID_ALIAS[item.id] ?? item.id;
    const major = majorMap[dataId] ?? majorMap[item.id];
    if (!major) return '';

    const rank = idx + 1;
    const rankLabel = rank === 1 ? '🏆 综合第一' : `Top ${rank}`;

    // 薪资
    const salary = major.salary?.value ? `¥${major.salary.value.toLocaleString()}` : '数据待补';

    // 绿牌点阵（2022-2026）
    const greenSet = new Set(major.greenYears);
    const dots = GREEN_AXIS.map(y =>
      `<span class="top5-green-dot top5-green-dot--${greenSet.has(y) ? 'on' : 'off'}" title="${y}年"></span>`
    ).join('');
    const greenCount = major.greenYears.length;

    // 政策关键词标签
    const policy = policyData?.[item.id];
    const policyTags = (policy?.keywords ?? []).slice(0, 2)
      .map(k => `<span class="top5-tag top5-tag--policy">${k}</span>`)
      .join('');

    // 考研建议标签
    const pgRec = major.postgrad?.recommendation;
    const pgTag = pgRec ? `<span class="top5-tag">${pgRec}</span>` : '';

    // 地域标签（优先取 regional.json 实际数据，回退到内置标注）
    const balance = regionalData?.[item.id]?.balance ?? item.regionTag;
    const regionTag = `<span class="top5-tag top5-tag--region">${balance}</span>`;

    return `
    <a class="top5-card${rank === 1 ? ' top5-card--rank1' : ''}"
       href="major.html?id=${encodeURIComponent(dataId)}">
      <div class="top5-rank">${rankLabel}</div>
      <p class="top5-name">${major.name}</p>
      <p class="top5-tagline">${item.tagline}</p>
      <div class="top5-stats">
        <div class="top5-stat">
          <span class="top5-stat-label">参考月收入</span>
          <span class="top5-stat-value">${salary}</span>
        </div>
        <div class="top5-stat">
          <span class="top5-stat-label">绿牌年数</span>
          <span class="top5-stat-value">${greenCount} 年</span>
        </div>
      </div>
      <div class="top5-green-bar">
        ${dots}
        <span class="top5-green-label">2022–2026绿牌</span>
      </div>
      <div class="top5-tags">
        ${policyTags}${pgTag}${regionTag}
      </div>
    </a>`;
  }).join('');

  el.innerHTML = cards || '<p class="muted">数据加载失败。</p>';
}

// data.json 用 mechatronics，而 regional/policy/employment 用 mechanical-electronics
const DETAIL_ID_ALIAS = { 'mechatronics': 'mechanical-electronics' };

function renderRegionSection(region) {
  if (!region) return '';
  const north = region.northStrength ?? 0;
  const south = region.southStrength ?? 0;
  const bar = (label, val, cls) => `
    <div class="region-bar-row">
      <span class="region-bar-label">${label}</span>
      <span class="region-bar-track"><span class="region-bar-fill region-bar-fill--${cls}" style="width:${val * 20}%"></span></span>
      <span class="region-bar-val">${val}/5</span>
    </div>`;
  const clusters = (region.hotClusters ?? []).map(c => `
    <li class="cluster">
      <span class="cluster-region">${c.region}</span>
      <span class="cluster-cities">${(c.cities ?? []).join(' · ')}</span>
      <p class="cluster-note">${c.note ?? ''}</p>
    </li>`).join('');
  const adv = region.regionAdvice ?? {};
  return `
    <section class="region-section">
      <h3>地域就业 <span class="chart-note">（${region.balance ?? ''}）</span></h3>
      <div class="region-strength">
        ${bar('北方', north, 'north')}
        ${bar('南方', south, 'south')}
      </div>
      <h4 class="region-subhead">热门产业集群</h4>
      <ul class="cluster-list">${clusters}</ul>
      <div class="region-policy">
        <p><strong>北方政策：</strong>${region.northPolicy ?? '—'}</p>
        <p><strong>南方政策：</strong>${region.southPolicy ?? '—'}</p>
      </div>
      <div class="region-advice">
        ${adv.northStudent ? `<p><strong>北方考生：</strong>${adv.northStudent}</p>` : ''}
        ${adv.southStudent ? `<p><strong>南方考生：</strong>${adv.southStudent}</p>` : ''}
      </div>
      <p class="muted" style="font-size:.8rem;margin-top:8px">地域为综合判断，非精确统计，仅供参考。</p>
    </section>`;
}

function renderPolicySection(policy) {
  if (!policy || !(policy.policies ?? []).length) return '';
  const keywords = (policy.keywords ?? [])
    .map(k => `<span class="top5-tag top5-tag--policy">${k}</span>`).join('');
  const rows = policy.policies.map(p => `
    <li class="policy-item">
      <div class="policy-head">
        <span class="policy-name">${p.name}</span>
        <span class="policy-meta">${p.issuer ?? ''}${p.year ? ` · ${p.year}` : ''} <span class="src-type">[${p.tier ?? ''}]</span></span>
      </div>
      <p class="policy-relevance">${p.relevance ?? ''}</p>
      ${p.note ? `<p class="policy-note muted">${p.note}</p>` : ''}
    </li>`).join('');
  return `
    <section class="policy-section">
      <h3>国家战略匹配 <span class="chart-note">（政策一手/二手已标注）</span></h3>
      <div class="top5-tags" style="margin-bottom:10px">${keywords}</div>
      <ul class="policy-list">${rows}</ul>
    </section>`;
}

function renderEmploymentTrend(emp) {
  if (!emp) return '';
  return `
    <p class="emp-trend"><strong>就业趋势：</strong>${emp.summary ?? emp.trend ?? ''}</p>`;
}

// ── 大学搜索页 ──
// universities.json 用 mechanical-electronics，data.json 用 mechatronics
const UNI_TO_DATA_ID = { 'mechanical-electronics': 'mechatronics' };

function uniCard(u, majorName) {
  const tags = [];
  tags.push(`<span class="uni-tier uni-tier--${u.tierGroup === '211' ? 'a' : u.tierGroup === '双非强校' ? 'b' : 'c'}">${u.tierGroup}</span>`);
  if (u.isSignature) tags.push('<span class="uni-flag uni-flag--star">王牌专业</span>');
  if (u.isNewProgram) tags.push('<span class="uni-flag uni-flag--new">近年新开</span>');
  const partners = (u.industryPartners ?? []).length
    ? `<p class="uni-partners"><strong>产学研：</strong>${u.industryPartners.join('、')}</p>` : '';
  const sources = (u.sources ?? []).map(s =>
    `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a> <span class="src-type">[${s.type}]</span>`
  ).join('；');
  return `
    <li class="uni-card">
      <div class="uni-head">
        <span class="uni-name">${u.name}</span>
        <span class="uni-loc">${u.location.province}·${u.location.city}</span>
      </div>
      ${majorName ? `<p class="uni-major">${majorName}</p>` : ''}
      <div class="uni-tags">${tags.join('')}</div>
      <p class="uni-rank"><strong>学科评估：</strong>${u.rank}</p>
      <p class="uni-note">${u.employmentNote}</p>
      ${partners}
      ${sources ? `<p class="uni-src muted">来源：${sources}</p>` : ''}
    </li>`;
}

export function renderUniversities(uniData, majors, els) {
  const { modeEl, majorEl, provinceEl, tierEl, listEl, titleEl } = els;
  const majorNameById = Object.fromEntries(majors.map(m => [m.id, m.name]));
  const majorKeys = Object.keys(uniData).filter(k => !k.startsWith('_'));

  for (const k of majorKeys) {
    const dataId = UNI_TO_DATA_ID[k] ?? k;
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = uniData[k].name ? uniData[k].name : (majorNameById[dataId] ?? k);
    majorEl.appendChild(opt);
  }
  const provinces = [...new Set(majorKeys.flatMap(k =>
    uniData[k].map(u => u.location.province)))].sort((a, b) => a.localeCompare(b, 'zh'));
  for (const pv of provinces) {
    const opt = document.createElement('option');
    opt.value = pv; opt.textContent = pv;
    provinceEl.appendChild(opt);
  }

  function syncMode() {
    const mode = modeEl.value;
    majorEl.style.display = mode === 'major' ? '' : 'none';
    provinceEl.style.display = mode === 'province' ? '' : 'none';
  }

  function apply() {
    const mode = modeEl.value;
    const tier = tierEl.value;
    let html = '', title = '';

    if (mode === 'major') {
      const mk = majorEl.value;
      if (!mk) { listEl.innerHTML = '<li class="muted">请选择一个专业。</li>'; titleEl.textContent = ''; return; }
      const majorName = uniData[mk].name ?? majorNameById[UNI_TO_DATA_ID[mk] ?? mk] ?? mk;
      let rows = uniData[mk].filter(u => !tier || u.tierGroup === tier);
      title = `${majorName} · 推荐院校（${rows.length}）`;
      html = rows.length ? rows.map(u => uniCard(u, '')).join('') : '<li class="muted">该层次暂无院校。</li>';
    } else {
      const prov = provinceEl.value;
      if (!prov) { listEl.innerHTML = '<li class="muted">请选择一个省/市。</li>'; titleEl.textContent = ''; return; }
      const rows = [];
      for (const k of majorKeys) {
        const majorName = uniData[k].name ?? majorNameById[UNI_TO_DATA_ID[k] ?? k] ?? k;
        for (const u of uniData[k]) {
          if (u.location.province === prov && (!tier || u.tierGroup === tier)) {
            rows.push({ u, majorName });
          }
        }
      }
      rows.sort((a, b) => a.u.name.localeCompare(b.u.name, 'zh'));
      title = `${prov} · 绿牌专业院校（${rows.length}）`;
      html = rows.length ? rows.map(r => uniCard(r.u, r.majorName)).join('') : '<li class="muted">该省/市该层次暂无院校。</li>';
    }
    titleEl.textContent = title;
    listEl.innerHTML = html;
  }

  modeEl.addEventListener('change', () => { syncMode(); apply(); });
  majorEl.addEventListener('change', apply);
  provinceEl.addEventListener('change', apply);
  tierEl.addEventListener('change', apply);
  syncMode();
  apply();
}

export function renderMajorDetail(major, el, { regional, policy, employment } = {}) {
  if (!major) { el.innerHTML = '<p class="muted">未找到该专业。</p>'; return; }
  const dataId = DETAIL_ID_ALIAS[major.id] ?? major.id;
  const region = regional?.[dataId];
  const pol = policy?.[dataId];
  const emp = employment?.[dataId];
  const positions = major.positions.map(p => `
    <li class="position">
      <span class="position-title">${p.title}</span>
      <p class="position-detail">${p.detail}</p>
    </li>`).join('');
  const sources = major.sources.map(s =>
    `<li><a href="${s.url}" target="_blank" rel="noopener">${s.name}</a> <span class="src-type">[${s.type}]</span></li>`
  ).join('');
  const pgSection = major.postgrad ? (() => {
    const pg = major.postgrad;
    const tagCls = pgTagClass(pg.recommendation);
    const pct = Math.round((pg.masterAvgSalary - pg.bachelorAvgSalary) / pg.bachelorAvgSalary * 100);
    return `
    <section class="postgrad-section">
      <h3>考研分析</h3>
      <div class="pg-header">
        <span class="pg-tag pg-tag--${tagCls} pg-tag--lg">${pg.recommendation}</span>
        <p class="pg-reason">${pg.recommendationReason}</p>
      </div>
      <div class="pg-stats">
        <div class="pg-stat">
          <span class="pg-stat-label">本科参考月薪</span>
          <span class="pg-stat-value">¥${pg.bachelorAvgSalary}</span>
        </div>
        <div class="pg-stat">
          <span class="pg-stat-label">硕士参考月薪</span>
          <span class="pg-stat-value">¥${pg.masterAvgSalary}</span>
        </div>
        <div class="pg-stat">
          <span class="pg-stat-label">硕士薪资提升</span>
          <span class="pg-stat-value pg-stat-value--highlight">+${pct}%</span>
        </div>
        <div class="pg-stat">
          <span class="pg-stat-label">深造率参考</span>
          <span class="pg-stat-value">约 ${pg.postgradRate}%</span>
        </div>
      </div>
      <p class="pg-detail"><strong>学历要求：</strong>${pg.degreeRequirement}</p>
      <p class="pg-detail"><strong>高学历岗位占比：</strong>${pg.highDegreeRatio}</p>
      <p class="muted" style="font-size:.8rem;margin-top:8px">薪资为行业综合估算，非统计数字，仅供参考。</p>
    </section>`;
  })() : '';
  el.innerHTML = `
    <h2>${major.name}</h2>
    <p class="major-meta">${major.field} · ${major.discipline} · 绿牌年份：${major.greenYears.join('、')}</p>
    <section>
      <h3>就业表现</h3>
      <p>${major.summary}</p>
      <p>参考月收入：<strong>${major.salary.value ? `¥${major.salary.value}` : '暂无数据'}</strong>${major.salary.year ? `（${major.salary.year} 届）` : ''}</p>
      ${renderEmploymentTrend(emp)}
    </section>
    ${renderPolicySection(pol)}
    ${renderRegionSection(region)}
    <section>
      <h3>对应岗位</h3>
      <ul class="position-list">${positions}</ul>
    </section>
    ${pgSection}
    <section class="sources">
      <h3>数据来源</h3>
      <ul>${sources}</ul>
      <p class="muted">岗位说明为编辑整理，非来源统计。</p>
    </section>
  `;
}

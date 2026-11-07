// 通用界面：选择模版 → 上传文件 → 核对修改 → 导出。具体单证的规则都在 js/templates/ 里。
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = {
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  };

  let tpl = null; // 当前模版
  const entries = []; // { id, file, doc, warnings, level, el }
  let seq = 0;

  // ---------------- 模版选择 ----------------
  function renderTemplates() {
    const list = $('#tplList');
    list.innerHTML = '';
    const groups = [...(DocTool.groups || []), { id: '_other', name: '其他' }];
    groups.forEach((g) => {
      const items = DocTool.templates.filter((t) => (t.group || '_other') === g.id);
      if (!items.length) return;
      list.appendChild(h(`<div class="tpl-group"><b>${esc(g.name)}</b>${g.hint ? `<small>${esc(g.hint)}</small>` : ''}</div>`));
      items.forEach((t) => {
        const b = h(`<button class="tpl${t.comingSoon ? ' soon' : ''}" ${t.comingSoon ? 'disabled' : ''} data-id="${t.id}">
          <span class="tpl-ico">${ICON.doc}</span>
          <span class="tpl-text"><b>${esc(t.name)}${t.badge ? `<em class="tag">${esc(t.badge)}</em>` : ''}</b><small>${esc(t.comingSoon ? '即将推出' : t.nameEn || '')}</small></span>
        </button>`);
        b.addEventListener('click', () => selectTemplate(t.id));
        list.appendChild(b);
      });
    });
  }

  function selectTemplate(id) {
    const t = DocTool.get(id);
    if (!t || t.comingSoon) return;
    if (tpl && tpl.id !== id && entries.length && !confirm('切换模版会清空当前已上传的文件，确定吗？')) return;
    if (tpl && tpl.id !== id) clearAll();
    tpl = t;
    document.querySelectorAll('.tpl').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    const g = (DocTool.groups || []).find((x) => x.id === t.group);
    $('#tplGroup').textContent = g ? g.name : '';
    $('#tplGroup').hidden = !g;
    $('#tplName').textContent = t.name;
    $('#tplDesc').textContent = t.description;
    $('#dropTitle').textContent = `拖入${t.uploadHint || '需要整理的文件'}，或点击选择`;
    try { localStorage.setItem('doctool.tpl', id); } catch (e) { /* ignore */ }
    renderBulk();
    updateStage();
  }

  // ---------------- 上传 ----------------
  // 整个页面都可以拖入文件
  let dragDepth = 0;
  document.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
  document.addEventListener('drop', (e) => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
    handleFiles(Array.from(e.dataTransfer.files));
  });
  $('#file').addEventListener('change', (e) => { const fs = Array.from(e.target.files); e.target.value = ''; handleFiles(fs); });
  document.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => $('#file').click()));

  async function handleFiles(files) {
    if (!tpl || !files.length) return;
    for (const f of files) {
      const entry = { id: ++seq, file: f, doc: null, warnings: [], level: 'loading' };
      entries.push(entry);
      entry.el = h(`<section class="card loading"><div class="card-head"><span class="spinner"></span><div><h3>${esc(f.name)}</h3><p class="muted">正在识别…</p></div></div></section>`);
      $('#list').appendChild(entry.el);
      updateStage();
      try {
        const read = await DocReaders.readFile(f);
        const { doc, warnings } = tpl.parse(read.rows, { fileName: f.name, source: read.source, workbook: read.workbook });
        entry.doc = doc; entry.warnings = warnings; entry.fatal = null;
      } catch (err) {
        entry.fatal = err.message || String(err);
      }
      const el = renderCard(entry);
      entry.el.replaceWith(el); entry.el = el;
      refresh(entry);
    }
  }

  // ---------------- 卡片 ----------------
  function renderCard(entry) {
    if (entry.fatal) {
      const el = h(`<section class="card error-card"><div class="card-head">
        <span class="pill error">无法识别</span>
        <div class="card-title"><h3>${esc(entry.file.name)}</h3><p class="msg error">${esc(entry.fatal)}</p></div>
        <div class="actions"><button class="icon-btn" data-act="remove" title="移除">${ICON.x}</button></div></div></section>`);
      el.querySelector('[data-act=remove]').addEventListener('click', () => removeEntry(entry));
      return el;
    }
    const exportsBtns = tpl.exports.filter((x) => x.perDoc).map((x, i) =>
      `<button class="btn ${i === 0 ? 'primary' : ''}" data-act="export" data-x="${x.id}">${ICON.down}<span>${esc(x.label)}</span></button>`).join('');
    const el = h(`<section class="card">
      <div class="card-head">
        <span class="pill"></span>
        <div class="card-title"><h3></h3><p class="muted file"></p></div>
        <div class="stats"></div>
        <div class="actions">
          ${(tpl.attachments || []).map((a) => `<button class="btn attach" data-act="attach" data-a="${a.id}">${ICON.upload}<span>${esc(a.label)}</span></button>`).join('')}
          <button class="btn ghost" data-act="toggle">${ICON.edit}<span>核对修改</span></button>
          ${tpl.preview ? `<button class="btn ghost" data-act="preview">${ICON.eye}<span>预览</span></button>` : ''}
          ${exportsBtns}
          <button class="icon-btn" data-act="remove" title="移除">${ICON.x}</button>
        </div>
      </div>
      <ul class="issues"></ul>
      <div class="editor" hidden></div>
    </section>`);
    $('.file', el).textContent = entry.file.name;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || !el.contains(b)) return;
      const act = b.dataset.act;
      if (act === 'toggle') toggleEditor(entry, b);
      else if (act === 'preview') preview(entry);
      else if (act === 'export') exportDocs(tpl.exports.find((x) => x.id === b.dataset.x), [entry]);
      else if (act === 'remove') removeEntry(entry);
      else if (act === 'attach') pickAttachment(entry, tpl.attachments.find((a) => a.id === b.dataset.a), b);
    });
    return el;
  }

  // 补充资料（如提单）：选文件 → 模版识别并写入 doc → 刷新
  function pickAttachment(entry, att, btn) {
    const inp = document.createElement('input');
    inp.type = 'file';
    if (att.accept) inp.accept = att.accept;
    inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      const label = $('span', btn), old = label.textContent;
      btn.disabled = true; label.textContent = '识别中…';
      try {
        const ws = await att.handle(f, entry.doc, (p) => { label.textContent = `识别中 ${Math.round(p * 100)}%`; });
        entry.warnings = entry.warnings.filter((w) => w.id !== 'need-' + att.id && w.att !== att.id)
          .concat((ws || []).map((w) => ({ ...w, att: att.id })));
      } catch (err) {
        entry.warnings = entry.warnings.filter((w) => w.att !== att.id).concat([{ level: 'error', msg: '识别失败：' + (err.message || err), att: att.id }]);
      }
      btn.disabled = false; label.textContent = old;
      rebuildEditor(entry);
      refresh(entry);
    });
    inp.click();
  }

  function rebuildEditor(entry) {
    const ed = $('.editor', entry.el);
    if (!ed.dataset.built) return;
    ed.innerHTML = '';
    buildEditor(entry, ed);
  }

  function toggleEditor(entry, btn) {
    const ed = $('.editor', entry.el);
    if (!ed.dataset.built) { buildEditor(entry, ed); ed.dataset.built = '1'; refresh(entry); }
    ed.hidden = !ed.hidden;
    btn.classList.toggle('on', !ed.hidden);
    $('span', btn).textContent = ed.hidden ? '核对修改' : '收起';
  }

  function buildEditor(entry, ed) {
    const doc = entry.doc;
    tpl.sections.forEach((sec, si) => {
      const s = h(`<div class="sec" data-sec="${si}"><h4>${esc(sec.title)}</h4></div>`);
      if (sec.fields) {
        const grid = h('<div class="grid"></div>');
        sec.fields.forEach((f) => {
          const isLines = f.type === 'lines';
          const ctl = f.options ? `<select>${f.options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>`
            : isLines ? `<textarea rows="${f.rows || 3}"></textarea>` : `<input ${f.type === 'number' ? 'type="number" step="any"' : ''} placeholder="${esc(f.placeholder || '')}">`;
          const lab = h(`<label class="field${isLines ? ' tall' : ''}"><span>${esc(f.label)}</span>${ctl}</label>`);
          const inp = lab.querySelector('input,textarea,select');
          inp.value = isLines ? (doc[f.key] || []).join('\n') : (doc[f.key] ?? '');
          inp.addEventListener(f.options ? 'change' : 'input', () => {
            if (isLines) doc[f.key] = inp.value.split('\n').map((x) => x.trim()).filter(Boolean);
            else if (f.type === 'number') doc[f.key] = inp.value === '' ? 0 : Number(inp.value);
            else doc[f.key] = inp.value.trim();
            refresh(entry);
          });
          grid.appendChild(lab);
        });
        s.appendChild(grid);
      }
      if (sec.items) {
        const it = sec.items;
        if (it.hint) s.querySelector('h4').insertAdjacentHTML('beforeend', ` <small>${esc(it.hint)}</small>`);
        const wrap = h(`<div class="table-wrap"><table class="items"><thead><tr><th class="no">#</th>${it.columns.map((c) => `<th style="${c.width ? `width:${c.width}` : ''}" class="${c.type === 'number' ? 'r' : ''}">${esc(c.label)}</th>`).join('')}${it.computed ? `<th class="r">${esc(it.computed.label)}</th>` : ''}<th></th></tr></thead><tbody></tbody></table></div>`);
        s.appendChild(wrap);
        const add = h(`<button class="btn ghost small">${ICON.plus}<span>${esc(it.addLabel || "添加一行")}</span></button>`);
        add.addEventListener('click', () => { const at = it.insertAt ? it.insertAt(doc) : doc[it.key].length; doc[it.key].splice(at, 0, it.newRow()); renderRows(entry, it, wrap); refresh(entry); });
        s.appendChild(add);
        s.appendChild(h('<div class="totals"></div>'));
        renderRows(entry, it, wrap);
      }
      ed.appendChild(s);
    });
  }

  function renderRows(entry, it, wrap) {
    const tb = $('tbody', wrap);
    tb.innerHTML = '';
    entry.doc[it.key].forEach((row, i) => {
      const tr = h(`<tr><td class="no">${i + 1}</td>${it.columns.map((c) => `<td><input data-k="${c.key}" class="${c.type === 'number' ? 'r' : ''}" ${c.type === 'number' ? 'inputmode="decimal"' : ''}></td>`).join('')}${it.computed ? '<td class="calc r"></td>' : ''}<td><button class="icon-btn small" title="删除此行">${ICON.x}</button></td></tr>`);
      tr.querySelectorAll('input').forEach((inp) => {
        const c = it.columns.find((x) => x.key === inp.dataset.k);
        inp.value = row[c.key] ?? '';
        inp.addEventListener('input', () => {
          if (c.type === 'number') { const v = inp.value.replace(/[,\s$]/g, ''); row[c.key] = v === '' || isNaN(Number(v)) ? null : Number(v); }
          else row[c.key] = inp.value.trim();
          refresh(entry);
        });
      });
      tr.querySelector('button').addEventListener('click', () => { entry.doc[it.key].splice(i, 1); renderRows(entry, it, wrap); refresh(entry); });
      tb.appendChild(tr);
    });
  }

  function issuesOf(entry) {
    return [...entry.warnings, ...tpl.validate(entry.doc)];
  }

  function refresh(entry) {
    if (entry.fatal) { entry.level = 'error'; updateStage(); return; }
    const el = entry.el, doc = entry.doc;
    const list = issuesOf(entry);
    entry.level = list.some((x) => x.level === 'error') ? 'error' : list.some((x) => x.level === 'warn') ? 'warn' : 'ok';
    const pill = $('.pill', el);
    pill.className = 'pill ' + entry.level;
    pill.innerHTML = { ok: `${ICON.check}可导出`, warn: '请核对', error: '有错误' }[entry.level];
    $('h3', el).textContent = tpl.title(doc);
    $('.stats', el).innerHTML = (tpl.stats ? tpl.stats(doc) : []).map((s) => `<div class="stat ${s.tone || ''}"><small>${esc(s.label)}</small><b>${esc(s.value)}</b></div>`).join('');
    const ul = $('.issues', el);
    ul.innerHTML = list.map((w) => `<li class="${w.level}">${esc(w.msg)}</li>`).join('');
    // 编辑区里的计算列与合计
    tpl.sections.forEach((sec, si) => {
      if (!sec.items || !$('.editor', el).dataset.built) return;
      const box = el.querySelector(`.sec[data-sec="${si}"]`);
      if (!box) return;
      if (sec.items.computed) box.querySelectorAll('.items tbody tr').forEach((tr, i) => { const c = $('.calc', tr); if (c) c.textContent = sec.items.computed.value(doc, i); });
      const tot = $('.totals', box);
      if (tot && sec.items.totals) tot.innerHTML = sec.items.totals(doc).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    });
    updateStage();
  }

  function removeEntry(entry) {
    entries.splice(entries.indexOf(entry), 1);
    entry.el.remove();
    updateStage();
  }
  function clearAll() { entries.splice(0); $('#list').innerHTML = ''; updateStage(); }
  $('#clearAll').addEventListener('click', () => { if (confirm('清空全部已上传的文件？')) clearAll(); });

  // ---------------- 步骤 / 底部操作栏 ----------------
  function updateStage() {
    const has = entries.length > 0;
    const ready = entries.filter((e) => e.level !== 'loading');
    const err = ready.filter((e) => e.level === 'error').length;
    const warn = ready.filter((e) => e.level === 'warn').length;
    const ok = ready.filter((e) => e.level === 'ok').length;
    $('#empty').hidden = has;
    $('#workspace').hidden = !has;
    $('#bulk').hidden = !has;
    const step = !has ? 1 : (err || warn) ? 2 : 3;
    document.querySelectorAll('.step').forEach((s) => {
      const n = +s.dataset.step;
      s.classList.toggle('done', n < step);
      s.classList.toggle('current', n === step);
    });
    $('#bulkSummary').innerHTML = `共 <b>${entries.length}</b> 份` +
      (ok ? ` · <span class="t-ok">${ok} 份可导出</span>` : '') +
      (warn ? ` · <span class="t-warn">${warn} 份请核对</span>` : '') +
      (err ? ` · <span class="t-err">${err} 份有错误</span>` : '');
  }

  function renderBulk() {
    const box = $('#bulkActions');
    box.innerHTML = '';
    tpl.exports.filter((x) => x.merge).forEach((x) => {
      const b = h(`<button class="btn">${ICON.down}<span>${esc(x.mergeLabel || '合并导出 ' + x.label)}</span></button>`);
      b.addEventListener('click', () => exportDocs(x, validEntries(), true));
      box.appendChild(b);
    });
    const zip = h(`<button class="btn primary">${ICON.down}<span>全部下载（ZIP）</span></button>`);
    zip.addEventListener('click', exportZip);
    box.appendChild(zip);
  }

  const validEntries = () => entries.filter((e) => e.doc && !e.fatal);

  // ---------------- 导出 ----------------
  function confirmIfError(list) {
    const bad = list.filter((e) => e.level === 'error');
    if (!bad.length) return true;
    return confirm(`${bad.map((e) => tpl.title(e.doc)).join('、')} 还有错误未处理，确定仍要导出吗？`);
  }

  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function exportDocs(x, list, merged) {
    if (!list.length || !confirmIfError(list)) return;
    const docs = list.map((e) => e.doc);
    saveBlob(await x.build(merged ? docs : [docs[0]]), x.fileName(merged ? docs : [docs[0]]));
  }

  async function exportZip() {
    const list = validEntries();
    if (!list.length || !confirmIfError(list)) return;
    const zip = new JSZip();
    const used = new Set();
    const add = (name, data) => {
      let n = name, k = 2;
      while (used.has(n)) n = name.replace(/(\.[^.]+)$/, ` (${k++})$1`);
      used.add(n); zip.file(n, data);
    };
    const docs = list.map((e) => e.doc);
    for (const x of tpl.exports) {
      if (x.merge && docs.length > 1) add(x.fileName(docs), await x.build(docs));
      else for (const d of docs) add(x.fileName([d]), await x.build([d]));
    }
    saveBlob(await zip.generateAsync({ type: 'blob' }), `${tpl.id.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.zip`);
  }

  function preview(entry) {
    const url = URL.createObjectURL(tpl.preview(entry.doc));
    $('#previewTitle').textContent = tpl.title(entry.doc);
    $('#previewFrame').src = url;
    $('#previewModal').hidden = false;
  }
  const closePreview = () => { $('#previewModal').hidden = true; $('#previewFrame').src = 'about:blank'; };
  $('#closePreview').addEventListener('click', closePreview);
  $('#previewModal').addEventListener('click', (e) => { if (e.target.id === 'previewModal') closePreview(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePreview(); });

  // ---------------- 启动 ----------------
  renderTemplates();
  let last = null;
  try { last = localStorage.getItem('doctool.tpl'); } catch (e) { /* ignore */ }
  const first = DocTool.templates.find((t) => !t.comingSoon);
  selectTemplate(last && DocTool.get(last) && !DocTool.get(last).comingSoon ? last : first.id);
})();

(() => {
  'use strict';
  const API = 'https://erp.cotex-china.com/tools-admin-api';
  const $ = id => document.getElementById(id);
  const kinds = { open: '打开工具', export: '导出下载', preview: '预览输出', backup: '产品库备份' };
  const selected = new Map();
  let token = sessionStorage.getItem('cotex-admin-token') || '';
  let page = 1, pageFiles = [], tools = [], total = 0, queryVersion = 0, previewVersion = 0, previewURL = '', previewFile = null;
  let toastTimer;
  const number = n => Number(n).toLocaleString('zh-CN');
  const time = value => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value)) : '—';
  const size = bytes => bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : bytes < 1073741824 ? (bytes / 1048576).toFixed(1) + ' MB' : (bytes / 1073741824).toFixed(2) + ' GB';
  function node(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; }
  function notify(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 4500); }
  function error(message = '') { $('global-error').textContent = message; $('global-error').hidden = !message; }
  function lock() {
    token = ''; sessionStorage.removeItem('cotex-admin-token'); queryVersion++;
    selected.clear(); $('records').replaceChildren(); closePreview();
    $('workspace').hidden = true; $('login-view').hidden = false; $('password').focus();
  }
  async function api(path, options = {}) {
    let response;
    try { response = await fetch(API + path, { ...options, headers: { ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers }, signal: AbortSignal.timeout(90000) }); }
    catch (_) { throw new Error('连接归档服务失败，请检查网络后重试。'); }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (response.status === 401 && path !== '/auth/login') lock();
      throw new Error(typeof body.detail === 'string' ? body.detail : '请求失败，请重试（' + response.status + '）');
    }
    return response;
  }
  async function json(path, options) { return (await api(path, options)).json(); }
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault(); $('login-button').disabled = true; $('login-error').textContent = '';
    try {
      const result = await json('/auth/login', { method: 'POST', body: JSON.stringify({ tool: 'admin', password: $('password').value }) });
      $('password').value = ''; token = result.token; sessionStorage.setItem('cotex-admin-token', token);
      await enter();
    } catch (e) { $('login-error').textContent = e.message; }
    finally { $('login-button').disabled = false; }
  });
  $('logout').addEventListener('click', async () => { try { await api('/auth/logout', { method: 'POST' }); } catch (_) {} lock(); });
  document.querySelectorAll('[data-launch]').forEach(link => {
    link.addEventListener('click', async event => {
      event.preventDefault();
      if (link.dataset.busy) return;
      link.dataset.busy = 'true'; link.setAttribute('aria-busy', 'true'); error();
      // Open synchronously to keep the user's click eligible for a new tab.
      const child = window.open('about:blank', '_blank');
      if (child) { child.sessionStorage.removeItem('cotex-admin-token'); child.opener = null; child.document.title = '正在打开工具…'; child.document.body.textContent = '正在打开工具，请稍候…'; }
      try {
        const result = await json('/admin/launch', { method: 'POST', body: JSON.stringify({ tool: link.dataset.launch }) });
        const url = new URL(link.href); url.searchParams.set('entry', 'admin-v1'); url.hash = 'launch=' + encodeURIComponent(result.ticket);
        if (child && !child.closed) child.location.replace(url.href); else location.assign(url.href);
      } catch (e) { if (child && !child.closed) child.close(); error(e.message); }
      finally { delete link.dataset.busy; link.removeAttribute('aria-busy'); }
    });
  });
  async function enter() { $('login-view').hidden = true; $('workspace').hidden = false; await refresh(); }
  async function summary() {
    const data = await json('/summary'); if (!token) return;
    $('stat-opens').textContent = number(data.today.open || 0);
    $('stat-exports').textContent = number((data.today.export || 0) + (data.today.backup || 0));
    $('stat-files').textContent = number(data.storage.count);
    $('stat-bytes').textContent = size(data.storage.bytes);
    $('updated').textContent = '更新于 ' + time(data.at).slice(11);
    const previous = $('filter-tool').value;
    tools = data.tools; $('tool-count').textContent = tools.length;
    $('filter-tool').replaceChildren(new Option('全部工具', ''));
    $('tool-nav').replaceChildren();
    tools.forEach(tool => {
      $('filter-tool').append(new Option(tool.name, tool.id));
      const button = node('button', undefined, 'nav-item'); button.dataset.tool = tool.id;
      button.append(node('span', '', 'tool-dot'), node('span', tool.name));
      button.title = '最近使用：' + time(tool.last_used);
      button.onclick = () => { $('filter-tool').value = tool.id; page = 1; updateNav(); load().catch(e => error(e.message)); };
      $('tool-nav').append(button);
    });
    $('filter-tool').value = previous; updateNav();
  }
  function updateNav() {
    $('all-tools').classList.toggle('active', !$('filter-tool').value);
    document.querySelectorAll('#tool-nav button').forEach(b => b.classList.toggle('active', b.dataset.tool === $('filter-tool').value));
  }
  $('all-tools').onclick = () => { $('filter-tool').value = ''; page = 1; updateNav(); load().catch(e => error(e.message)); };
  function selection() {
    $('selection-count').textContent = '已选 ' + selected.size + ' 份';
    $('bulk-download').disabled = $('bulk-delete').disabled = !selected.size;
    const count = pageFiles.filter(f => selected.has(f.id)).length;
    $('select-page').checked = count > 0 && count === pageFiles.length;
    $('select-page').indeterminate = count > 0 && count < pageFiles.length;
    $('select-page').disabled = !pageFiles.length;
    document.querySelectorAll('input[data-file]').forEach(i => i.checked = selected.has(i.dataset.file));
  }
  function pick(file, checked) {
    if (checked && selected.size >= 100 && !selected.has(file.id)) { notify('每批最多选择 100 份文件'); return; }
    if (checked) selected.set(file.id, file); else selected.delete(file.id);
  }
  $('select-page').onchange = event => { pageFiles.forEach(f => pick(f, event.target.checked)); selection(); };
  function render(items) {
    $('records').replaceChildren(); pageFiles = [];
    items.forEach(event => {
      const row = node('tr'); row.dataset.event = event.id;
      const stamp = time(event.at), when = node('td', stamp.slice(0, 10), 'time'); when.append(node('small', stamp.slice(11)));
      const toolCell = node('td'); toolCell.append(node('span', tools.find(t => t.id === event.tool)?.name || event.tool, 'tool-tag' + (event.tool === 'ambill-tool' ? ' am' : '')));
      const kind = node('td'); kind.append(node('span', kinds[event.kind] || event.kind, 'kind'));
      const fileCell = node('td');
      if (!event.files.length) fileCell.append(node('span', '—', 'no-file'));
      event.files.forEach(file => {
        const box = node('div', undefined, 'file-row' + (file.deleted_at ? ' deleted' : ''));
        if (!file.deleted_at) {
          pageFiles.push(file);
          const check = node('input'); check.type = 'checkbox'; check.dataset.file = file.id; check.setAttribute('aria-label', '选择 ' + file.name);
          check.onchange = () => { pick(file, check.checked); selection(); }; box.append(check);
        }
        box.append(node('span', file.name.split('.').pop().toUpperCase().slice(0, 5), 'file-icon'));
        const info = node('div', undefined, 'file-info');
        const title = node(file.deleted_at ? 'span' : 'button', file.name, 'file-name');
        if (!file.deleted_at) title.onclick = () => preview(file);
        info.append(title, node('small', size(file.size) + (file.deleted_at ? ' · 已删除 ' + time(file.deleted_at) : '' ))); box.append(info);
        if (!file.deleted_at) {
          const download = node('button', '↓', 'file-download'); download.setAttribute('aria-label', '下载 ' + file.name);
          download.onclick = () => singleDownload(file, download); box.append(download);
        }
        fileCell.append(box);
      });
      row.append(when, toolCell, kind, fileCell); $('records').append(row);
    });
    $('empty').hidden = !!items.length; selection();
  }
  async function load() {
    error(); const version = ++queryVersion;
    const start = $('filter-start').value, end = $('filter-end').value;
    if (start && end && start > end) { error('开始日期不能晚于结束日期'); return; }
    const params = new URLSearchParams({ page, tool: $('filter-tool').value, kind: $('filter-kind').value, start, end, q: $('filter-q').value.trim() });
    $('page-info').textContent = '正在加载…';
    const data = await json('/events?' + params);
    if (version !== queryVersion || !token) return;
    total = data.total;
    render(data.items); $('record-total').textContent = number(total);
    $('page-info').textContent = '共 ' + number(total) + ' 条 · 第 ' + page + ' / ' + Math.max(1, Math.ceil(total / data.limit)) + ' 页';
    $('prev').disabled = page <= 1; $('next').disabled = page * data.limit >= total;
  }
  async function refresh() {
    $('refresh').disabled = true; error();
    try { await summary(); await load(); }
    catch (e) { error(e.message); }
    finally { $('refresh').disabled = false; }
  }
  $('refresh').onclick = refresh;
  $('filters').onsubmit = event => { event.preventDefault(); page = 1; selected.clear(); updateNav(); load().catch(e => error(e.message)); };
  $('reset').onclick = () => { HTMLFormElement.prototype.reset.call($('filters')); selected.clear(); page = 1; updateNav(); load().catch(e => error(e.message)); };
  $('prev').onclick = () => { if (page > 1) { page--; load().catch(e => error(e.message)); } };
  $('next').onclick = () => { if (page * 30 < total) { page++; load().catch(e => error(e.message)); } };
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob), link = node('a'); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function singleDownload(file, button) {
    button.disabled = true;
    try { downloadBlob(await (await api('/files/' + file.id)).blob(), file.name); }
    catch (e) { notify(e.message); } finally { button.disabled = false; }
  }
  $('bulk-download').onclick = async () => {
    const ids = [...selected.keys()]; if (!ids.length) return;
    $('bulk-download').disabled = true; notify('正在准备 ZIP 文件…');
    try { const response = await api('/files/download', { method: 'POST', body: JSON.stringify({ ids }) }); downloadBlob(await response.blob(), 'CoTeX-文件归档-' + time(new Date()).slice(0, 10) + '.zip'); notify('已开始下载 ' + ids.length + ' 份文件'); }
    catch (e) { error(e.message); } finally { selection(); }
  };
  $('bulk-delete').onclick = async () => {
    const ids = [...selected.keys()]; if (!ids.length || !confirm('永久删除所选 ' + ids.length + ' 份文件？\n文件内容将从服务器移除，无法恢复。使用记录和删除时间会保留。')) return;
    $('bulk-delete').disabled = true;
    try { await json('/files/delete', { method: 'POST', body: JSON.stringify({ ids }) }); selected.clear(); closePreview(); await refresh(); notify('文件已删除，使用记录已保留'); }
    catch (e) { error(e.message); } finally { selection(); }
  };
  function closePreview() {
    previewVersion++; if (previewURL) URL.revokeObjectURL(previewURL); previewURL = ''; previewFile = null;
    $('preview-body').replaceChildren(); $('preview-dialog').close();
  }
  $('preview-close').onclick = closePreview;
  $('preview-dialog').addEventListener('cancel', event => { event.preventDefault(); closePreview(); });
  $('preview-download').onclick = () => { if (previewFile) singleDownload(previewFile, $('preview-download')); };
  async function safeZip(blob) {
    const zip = await JSZip.loadAsync(blob);
    const entries = Object.values(zip.files);
    if (entries.length > 3000 || entries.reduce((n, e) => n + (e._data?.uncompressedSize || 0), 0) > 128 * 1024 * 1024) throw new Error('文件较大，请下载后在本机查看');
    return zip;
  }
  async function showBlob(blob, filename, version, nested = false) {
    if (version !== previewVersion) return;
    if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = ''; }
    const body = $('preview-body'); body.replaceChildren();
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      const frame = node('iframe'); frame.title = 'PDF 文件预览'; previewURL = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })); frame.src = previewURL; body.append(frame);
    } else if (ext === 'xlsx' || ext === 'csv') {
      if (ext === 'xlsx') await safeZip(blob);
      if (version !== previewVersion) return;
      const book = XLSX.read(await blob.arrayBuffer(), { type: 'array', sheetRows: 200, cellHTML: false });
      if (version !== previewVersion) return;
      const tabs = node('div', undefined, 'sheet-tabs'), tableBox = node('div', undefined, 'sheet-scroll');
      body.append(node('p', '内容预览 · 每张表展示前 200 行、50 列；完整格式与图片请下载原文件查看。', 'preview-note'), tabs, tableBox);
      function sheet(name) {
        tableBox.replaceChildren(); const table = node('table', undefined, 'sheet-table');
        const data = XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: '', blankrows: true, raw: false });
        data.slice(0, 200).forEach(row => { const tr = node('tr'); row.slice(0, 50).forEach(value => tr.append(node('td', String(value)))); table.append(tr); });
        tableBox.append(table); [...tabs.children].forEach(b => b.classList.toggle('primary', b.textContent === name));
      }
      book.SheetNames.forEach(name => { const button = node('button', name); button.onclick = () => sheet(name); tabs.append(button); });
      if (book.SheetNames.length) sheet(book.SheetNames[0]);
    } else if (ext === 'zip' && !nested) {
      const zip = await safeZip(blob); if (version !== previewVersion) return;
      body.append(node('p', '压缩包内容 · 点击文件查看；顶部下载按钮下载完整压缩包。', 'preview-note'));
      const list = node('div', undefined, 'zip-list'); body.append(list);
      Object.values(zip.files).filter(entry => !entry.dir).forEach(entry => {
        const button = node('button', entry.name);
        button.onclick = async () => {
          button.disabled = true;
          try {
            const child = await entry.async('blob');
            if (version !== previewVersion) return;
            await showBlob(child, entry.name, version, true);
            const back = node('button', '← 返回压缩包'); back.onclick = () => showBlob(blob, filename, version).catch(e => notify(e.message)); body.prepend(back);
          } catch (e) { notify(e.message); button.disabled = false; }
        };
        list.append(button);
      });
    } else if (['json', 'txt'].includes(ext)) {
      let text = await blob.slice(0, 2 * 1024 * 1024).text();
      if (ext === 'json' && blob.size <= 2 * 1024 * 1024) { try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (_) {} }
      if (version !== previewVersion) return;
      body.append(node('p', '文本内容预览 · 最多展示 20 万字符；完整内容可下载。', 'preview-note'), node('pre', text.slice(0, 200000)));
    } else { body.append(node('p', '该文件请下载后查看。')); }
  }
  async function preview(file) {
    closePreview(); const version = ++previewVersion; previewFile = file;
    $('preview-title').textContent = file.name; $('preview-meta').textContent = size(file.size) + ' · 原始文件';
    $('preview-body').textContent = '正在加载文件…'; $('preview-dialog').showModal();
    try { const blob = await (await api('/files/' + file.id)).blob(); if (version === previewVersion) await showBlob(blob, file.name, version); }
    catch (e) { if (version === previewVersion) $('preview-body').textContent = e.message; }
  }
  if (token) enter(); else $('password').focus();
})();

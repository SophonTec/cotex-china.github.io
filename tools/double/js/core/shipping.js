// 从提单 / 装箱资料的文字里提取运输信息：提单号、船名航次、港口、柜号/封号、件数、毛重、体积。
// OCR 文字可能有错，所以：柜号用 ISO 6346 校验位核对；各柜合计与总数比对；不确定的都给出提示。
(function (root) {
  const ALPHA = { A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38 };
  function containerCheckOk(no) {
    if (!/^[A-Z]{4}\d{7}$/.test(no)) return false;
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const ch = no[i];
      const v = i < 4 ? ALPHA[ch] : Number(ch);
      sum += v * Math.pow(2, i);
    }
    return (sum % 11) % 10 === Number(no[10]);
  }

  // "16,810.000" → 16810；"16.810,000" → 16810；"41.370" → 41.37
  function num(s) {
    if (s === null || s === undefined) return null;
    let t = String(s).replace(/\s/g, '');
    if (/^\d{1,3}(\.\d{3})+,\d+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
    const n = Number(t);
    return isNaN(n) ? null : n;
  }

  function normType(s) {
    if (!s) return '';
    const t = s.toUpperCase().replace(/[’'`"°\s]/g, '');
    const size = (t.match(/(20|40|45)/) || [])[1] || '';
    if (/HQ/.test(t)) return size + 'HQ';
    if (/HC|HIGHCUBE/.test(t)) return size + 'HC';
    if (/RF|REEF/.test(t)) return size + 'RF';
    if (/OT|OPEN/.test(t)) return size + 'OT';
    if (/FR|FLAT/.test(t)) return size + 'FR';
    return size ? size + 'GP' : '';
  }

  const PKG_RE = /(\d[\d,.]*)\s*(PACKAGES?|PACKAGE\(S\)|PKGS?|CARTONS?|CTNS?|BAGS?|PALLETS?|PLTS?|ROLLS?|BALES?|CASES?|PCS)\b/i;
  const KG_RE = /(\d[\d,.]*)\s*(?:KGS?|KILOS?)\b/i;
  const CBM_RE = /(\d[\d,.]*)\s*(?:CBM|M3|M³|CU\.?\s*[MN])/i;
  const TYPE_RE = /\b(20|40|45)\s*['’°]?\s*(?:FT)?\s*(HIGH\s*CUBE|HC|HQ|GP|DV|DRY(?:\s*VAN)?|RF|REEFER|OT|FR)\b/i;

  function unitWord(u) {
    u = (u || '').toUpperCase();
    if (/^PACK/.test(u) || /^PKG/.test(u)) return 'PACKAGES';
    if (/^C(AR)?TN/.test(u)) return 'CARTONS';
    if (/^BAG/.test(u)) return 'BAGS';
    if (/^P(AL)?L?T/.test(u)) return 'PALLETS';
    return u.replace(/S?$/, 'S');
  }

  function parseShipping(text) {
    const warnings = [];
    const lines = String(text || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const all = lines.join('\n');
    const ship = { blNo: '', vessel: '', loadingPort: '', destinationPort: '', containers: [], totalPackages: null, packageUnit: '', totalWeight: null, totalCbm: null };

    let m;
    if ((m = all.match(/(?:BILL\s+OF\s+LADING|B\s*\/\s*L)\s*(?:NO\.?|NUMBER|N°)?\s*[:：.]?\s*([A-Z]{4}[A-Z0-9]{6,14})\b/i))) ship.blNo = m[1].toUpperCase();

    // 船名航次：标题行的下一行，或 "VESSEL: xxx"
    lines.forEach((l, i) => {
      if (ship.vessel) return;
      let mm = l.match(/(?:VESSEL|NAVIRE|OCEAN VESSEL)[^:：]*[:：]\s*([A-Z0-9][A-Z0-9 .\-\/]{3,})/i);
      if (mm && !/VOYAGE\s*NO|SEE CLAUSE/i.test(mm[1])) { ship.vessel = mm[1].trim(); return; }
      if (/VESSEL/i.test(l) && lines[i + 1]) {
        mm = lines[i + 1].match(/^([A-Z][A-Z0-9 .]+?\s*-?\s*[A-Z0-9]{3,}[A-Z]?)\b(?=\s+[a-z]|\s+X{4,}|\s*$|\s{2,})/);
        if (mm) ship.vessel = mm[1].replace(/\s+-\s+/, '-').trim();
      }
    });

    // 港口
    lines.forEach((l, i) => {
      let mm;
      if (!ship.loadingPort && (mm = l.match(/(?:PORT OF LOADING|LOADING PORT|PORT CHARGEMENT|POL)\s*[:：]\s*(.+)/i))) ship.loadingPort = mm[1].trim();
      if (!ship.destinationPort && (mm = l.match(/(?:PORT OF DISCHARGE|DISCHARGE PORT|DESTINATION PORT|PORT D[ÉE]CHARGEMENT|POD)\s*[:：]\s*(.+)/i))) ship.destinationPort = mm[1].trim();
      if (!ship.loadingPort && (mm = l.match(/FROM\s+([A-Z][A-Z ,()]+?)\s+TO\s+([A-Z][A-Za-z ,()]+)/))) { ship.loadingPort = mm[1].trim(); ship.destinationPort = ship.destinationPort || mm[2].trim(); }
    });

    // 柜号（ISO 6346：4 字母 + 7 数字）及其附近的信息
    const seen = new Set();
    const CN_RE = /\b([A-Z]{3}[UJZ])\s?(\d{6})\s?-?\s?(\d)\b/g;
    lines.forEach((l, i) => {
      let mm;
      CN_RE.lastIndex = 0;
      while ((mm = CN_RE.exec(l))) {
        const no = mm[1] + mm[2] + mm[3];
        if (seen.has(no)) continue;
        seen.add(no);
        const ctx = [l, lines[i + 1] || '', lines[i + 2] || ''].join(' ');
        const after = l.slice(mm.index + mm[0].length);
        const c = { no, seal: '', type: '', packages: null, unit: '', weight: null, cbm: null, checkOk: containerCheckOk(no) };
        let s;
        if ((s = after.match(/^\s*[\/／]\s*([A-Z0-9]{5,12})/))) c.seal = s[1];
        else if ((s = ctx.match(/SEAL(?:\s*NO\.?)?\s*[:：#]?\s*([A-Z0-9]{5,12})/i))) c.seal = s[1];
        if ((s = ctx.match(TYPE_RE))) c.type = normType(s[0]);
        if ((s = ctx.match(PKG_RE))) { c.packages = num(s[1]); c.unit = unitWord(s[2]); }
        if ((s = ctx.match(KG_RE))) c.weight = num(s[1]);
        if ((s = ctx.match(CBM_RE))) c.cbm = num(s[1]);
        ship.containers.push(c);
      }
    });

    // 总数
    if ((m = all.match(/TOTAL\s+GROSS\s+WEIGHT\s*[:：]?\s*(\d[\d,.]*)/i))) ship.totalWeight = num(m[1]);
    const sum = (k) => ship.containers.reduce((a, c) => a + (c[k] || 0), 0);
    if (ship.containers.length) {
      if (ship.totalWeight === null) ship.totalWeight = Math.round(sum('weight') * 1000) / 1000 || null;
      ship.totalCbm = Math.round(sum('cbm') * 1000) / 1000 || null;
      ship.totalPackages = sum('packages') || null;
      ship.packageUnit = (ship.containers.find((c) => c.unit) || {}).unit || '';
    }

    // 校验
    if (!ship.containers.length) warnings.push({ level: 'warn', msg: '没有识别到柜号' });
    ship.containers.forEach((c, i) => {
      if (!c.checkOk) warnings.push({ level: 'warn', msg: `柜号 ${c.no} 校验位不对，可能识别有误` });
    });
    const sw = sum('weight');
    if (ship.containers.length && ship.totalWeight !== null && sw && Math.abs(sw - ship.totalWeight) > 0.5)
      warnings.push({ level: 'warn', msg: `各柜毛重相加 ${sw} KGS 与总毛重 ${ship.totalWeight} KGS 不一致，可能有数字识别错误` });
    return { ship, warnings };
  }

  function containerSummary(containers) {
    const cnt = {};
    containers.forEach((c) => { const t = c.type || '?'; cnt[t] = (cnt[t] || 0) + 1; });
    return Object.entries(cnt).map(([t, n]) => `${n}x ${t}`).join(' + ');
  }

  function fmtNum(n, d) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function containerLine(c, i) {
    const parts = [`Container No.${i + 1}: ${c.no}${c.seal ? '/' + c.seal : ''}`];
    if (c.type) parts.push(c.type);
    if (c.packages != null) parts.push(`${c.packages} ${c.unit || 'PACKAGES'}`);
    if (c.weight != null) parts.push(`${c.weight}KGS`);
    if (c.cbm != null) parts.push(`${c.cbm}CBM`);
    return parts.join(' ');
  }

  root.DocShipping = { parseShipping, containerCheckOk, containerSummary, containerLine, fmtNum, num, normType };
})(typeof window !== 'undefined' ? window : globalThis);

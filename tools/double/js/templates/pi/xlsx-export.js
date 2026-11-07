// 按公司 Excel 模版导出：以内置模版（excel-template.js）为底稿，保留 Logo、抬头、签章、样式，
// 只替换数据，并按产品行数/条款行数自动插行、移动下方内容和签章。
(function (root) {
  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const T = (s) => `<t xml:space="preserve">${esc(s)}</t>`;
  const RPR = (u) => `<rPr><b/>${u ? '<u/>' : ''}<sz val="11"/><color theme="1"/><rFont val="Arial Regular"/><charset val="134"/></rPr>`;

  const cStr = (ref, s, text) => `<c r="${ref}" s="${s}" t="inlineStr"><is>${T(text)}</is></c>`;
  const cRich = (ref, s, label, value) =>
    `<c r="${ref}" s="${s}" t="inlineStr"><is><r>${RPR(false)}${T(label)}</r><r>${RPR(true)}${T(value)}</r></is></c>`;
  const cNum = (ref, s, n) => (n === null || n === undefined || n === '' || isNaN(Number(n)))
    ? `<c r="${ref}" s="${s}"/>` : `<c r="${ref}" s="${s}"><v>${Number(n)}</v></c>`;
  const cFormula = (ref, s, f, v) => `<c r="${ref}" s="${s}"><f>${esc(f)}</f><v>${Number(v) || 0}</v></c>`;

  function excelDate(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
  }

  // 解析模版工作表
  function splitSheet(xml) {
    const a = xml.indexOf('<sheetData>'), b = xml.indexOf('</sheetData>');
    const rows = {};
    const re = /<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g;
    let m;
    const body = xml.slice(a + 11, b);
    while ((m = re.exec(body))) rows[+m[1]] = m[0];
    return { head: xml.slice(0, a), rows, tail: xml.slice(b + 12) };
  }

  // 把一行（含单元格引用、公式里的行号）移动到新行号
  function moveRow(rowXml, newR) {
    return rowXml
      .replace(/<row r="\d+"/, `<row r="${newR}"`)
      .replace(/(<c r="[A-Z]+)\d+"/g, `$1${newR}"`);
  }
  // 替换某一行中某个单元格
  function setCell(rowXml, col, cellXml) {
    const re = new RegExp(`<c r="${col}\\d+"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
    if (re.test(rowXml)) return rowXml.replace(re, cellXml);
    return rowXml.replace('</row>', cellXml + '</row>');
  }
  const styleOf = (rowXml, col) => {
    const m = rowXml.match(new RegExp(`<c r="${col}\\d+" s="(\\d+)"`));
    return m ? m[1] : '0';
  };

  function buildSheet(tplXml, pi, P, single) {
    const { head, rows, tail } = splitSheet(tplXml);
    const tot = P.computeTotals(pi);
    const out = [];
    const n = Math.max(pi.items.length, 1);

    // 1–18 行：抬头、发票号、日期、客户/银行信息、表头
    for (let r = 1; r <= 18; r++) {
      if (!rows[r]) continue;
      let x = rows[r];
      if (r === 2) x = setCell(x, 'G', /^\d+$/.test(pi.invoiceNo) ? cNum('G2', styleOf(x, 'G'), pi.invoiceNo) : cStr('G2', styleOf(x, 'G'), pi.invoiceNo));
      if (r === 3) { const d = excelDate(pi.date); x = setCell(x, 'G', d ? cNum('G3', styleOf(x, 'G'), d) : cStr('G3', styleOf(x, 'G'), pi.date)); }
      if (r === 10) {
        x = setCell(x, 'B', cStr('B10', styleOf(x, 'B'), pi.clientLines.join('\n')));
        x = setCell(x, 'E', cStr('E10', styleOf(x, 'E'), pi.bankLines.join('\n')));
      }
      out.push(x);
    }

    // 产品行（从第 19 行开始）
    const itemTpl = rows[19];
    const st = (c) => styleOf(itemTpl, c);
    const rowOpen = itemTpl.match(/<row [^>]*>/)[0];
    for (let i = 0; i < n; i++) {
      const r = 19 + i, it = pi.items[i] || { desc: '', qty: null, unit: '', price: null };
      out.push(rowOpen.replace(/r="\d+"/, `r="${r}"`) +
        `<c r="A${r}" s="${st('A')}"/>` + cNum(`B${r}`, st('B'), i + 1) + cStr(`C${r}`, st('C'), it.desc) +
        cNum(`D${r}`, st('D'), it.qty) + cStr(`E${r}`, st('E'), it.unit) + cNum(`F${r}`, st('F'), it.price) +
        cFormula(`G${r}`, st('G'), `F${r}*D${r}`, tot.lines[i] || 0) + `<c r="H${r}" s="${st('H')}"/></row>`);
    }
    const lastItem = 18 + n;
    let d = n - 4; // 模版里是 4 个产品

    // 23–27 行：空行 + 合计框（行数随「金额汇总」变化）
    out.push(moveRow(rows[23], 23 + d));
    const sum = tot.summary.length ? tot.summary : [{ label: '', value: tot.total, auto: true }];
    const ns = sum.length;
    const fixedRows = [];
    sum.forEach((x, k) => {
      const r = 24 + d + k;
      const src = ns === 1 ? 26 : k === 0 ? 24 : k === ns - 1 ? 26 : 25;
      let row = moveRow(rows[src], r);
      if (ns === 1 && single) {
        row = setCell(row, 'D', `<c r="D${r}" s="${single.D}"/>`);
        row = setCell(row, 'E', `<c r="E${r}" s="${single.E}"/>`);
      }
      const sF = ns === 1 && single ? single.F : styleOf(row, 'F');
      const sG = ns === 1 && single ? single.G : styleOf(row, 'G');
      row = setCell(row, 'F', cStr(`F${r}`, sF, x.label));
      if (x.auto) {
        const f = [`SUM(G19:G${lastItem})`, ...fixedRows.map((fr) => `G${fr}`)].join('+');
        row = setCell(row, 'G', cFormula(`G${r}`, sG, f, x.value));
      } else {
        row = setCell(row, 'G', cNum(`G${r}`, sG, x.value));
        fixedRows.push(r);
      }
      out.push(row);
    });
    out.push(moveRow(rows[27], 24 + d + ns));
    d += ns - 3;

    // 条款（模版 28–35 行，共 8 行；行数随单据/其他条款变化）
    const terms = [
      ['plain', `PAYS D’ORIGINE: ${pi.origin}`],
      ['rich', 'LOADING PORT: ', pi.loadingPort],
      ['rich', 'DESTINATION PORT: ', pi.destinationPort],
      ['rich', 'MODE DE PAIEMENT: ', pi.payment],
      ['plain', `SHIPMENT: ${pi.shipment}`],
      ['plain', 'DOCUMENTS: '],
      ...pi.documents.map((t) => ['plain', t]),
      ...pi.otherTerms.map((t) => ['plain', t]),
    ];
    const m = terms.length;
    terms.forEach((t, k) => {
      const src = k === 0 ? 28 : k === m - 1 ? 35 : k === m - 2 ? 34 : 29 + Math.min(k - 1, 4);
      const r = 28 + d + k;
      let x = moveRow(rows[src], r);
      const s = styleOf(x, 'B');
      x = setCell(x, 'B', t[0] === 'rich' ? cRich(`B${r}`, s, t[1], t[2]) : cStr(`B${r}`, s, t[1]));
      out.push(x);
    });
    d += m - 8;

    // 36–46 行：公司收款账户（沿用模版内容）
    for (let r = 36; r <= 46; r++) if (rows[r]) out.push(moveRow(rows[r], r + d));

    const lastRow = 46 + d;
    const headFixed = head.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:H${lastRow}"/>`);
    return { xml: headFixed + '<sheetData>' + out.join('') + '</sheetData>' + tail, shift: d };
  }

  // 签章等位于第 22 行（0 起算）以下的图形整体下移
  function shiftDrawing(xml, shift) {
    return xml.replace(/<xdr:(from|to)><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(-?\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row>/g,
      (all, tag, col, off, row) => {
        const r = +row;
        return `<xdr:${tag}><xdr:col>${col}</xdr:col><xdr:colOff>${off}</xdr:colOff><xdr:row>${r >= 22 ? r + shift : r}</xdr:row>`;
      });
  }

  const sheetName = (s, used) => {
    let base = String(s || 'PI').replace(/[\[\]:*?\/\\]/g, '_').slice(0, 31) || 'PI';
    let name = base, k = 2;
    while (used.has(name.toLowerCase())) name = base.slice(0, 27) + ` (${k++})`;
    used.add(name.toLowerCase());
    return name;
  };

  async function buildXlsx(pis, type = 'blob', opts = {}) {
    const P = root.PIParser;
    const tpl = await JSZip.loadAsync(root.PI_TEMPLATE_XLSX, { base64: true });
    const sheetTpl = await tpl.file('xl/worksheets/sheet1.xml').async('string');
    let drawTpl = await tpl.file('xl/drawings/drawing1.xml').async('string');
    if (opts.title) drawTpl = drawTpl.replace('<a:t>PROFORMA INVOICE</a:t>', `<a:t>${esc(opts.title)}</a:t>`);
    const drawRels = await tpl.file('xl/drawings/_rels/drawing1.xml.rels').async('string');
    const sheetRels = await tpl.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
    let wb = await tpl.file('xl/workbook.xml').async('string');
    let wbRels = await tpl.file('xl/_rels/workbook.xml.rels').async('string');
    let ct = await tpl.file('[Content_Types].xml').async('string');

    // 合计框只有一行时，需要上下都有边框的样式：在模版样式表里补几个
    let single = null;
    {
      let st = await tpl.file('xl/styles.xml').async('string');
      const bm = st.match(/<borders count="(\d+)">([\s\S]*?)<\/borders>/);
      const xm = st.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);
      if (bm && xm) {
        const xfs = xm[2].match(/<xf [^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g);
        const T = '<top style="thin"><color auto="1"/></top>', B = '<bottom style="thin"><color auto="1"/></bottom>', Lb = '<left style="thin"><color auto="1"/></left>', Rb = '<right style="thin"><color auto="1"/></right>';
        const nb = +bm[1];
        const newBorders = [`<border>${Lb}<right/>${T}${B}<diagonal/></border>`, `<border><left/><right/>${T}${B}<diagonal/></border>`, `<border><left/>${Rb}${T}${B}<diagonal/></border>`];
        st = st.replace(bm[0], `<borders count="${nb + 3}">${bm[2]}${newBorders.join('')}</borders>`);
        const nx = +xm[1];
        const clone = (i, b) => xfs[i].replace(/borderId="\d+"/, `borderId="${b}"`);
        const add = [clone(39, nb), clone(40, nb + 1), clone(41, nb + 1), clone(42, nb + 2)];
        st = st.replace(xm[0], `<cellXfs count="${nx + 4}">${xm[2]}${add.join('')}</cellXfs>`);
        tpl.file('xl/styles.xml', st);
        single = { D: nx, E: nx + 1, F: nx + 2, G: nx + 3 };
      }
    }

    const used = new Set();
    let sheets = '', names = '', rels = '', overrides = '';
    pis.forEach((pi, i) => {
      const k = i + 1;
      const { xml, shift } = buildSheet(sheetTpl, pi, P, single);
      tpl.file(`xl/worksheets/sheet${k}.xml`, xml);
      tpl.file(`xl/worksheets/_rels/sheet${k}.xml.rels`, sheetRels.replace('drawing1.xml', `drawing${k}.xml`));
      tpl.file(`xl/drawings/drawing${k}.xml`, shiftDrawing(drawTpl, shift));
      tpl.file(`xl/drawings/_rels/drawing${k}.xml.rels`, drawRels);
      const nm = sheetName(pi.invoiceNo, used);
      const q = `'${nm.replace(/'/g, "''")}'`;
      sheets += `<sheet name="${esc(nm)}" sheetId="${k}" r:id="rIdSheet${k}"/>`;
      names += `<definedName name="_xlnm.Print_Area" localSheetId="${i}">${esc(q)}!$A:$H</definedName>` +
        `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${esc(q)}!$18:$18</definedName>`;
      rels += `<Relationship Id="rIdSheet${k}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${k}.xml"/>`;
      overrides += `<Override PartName="/xl/worksheets/sheet${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/drawings/drawing${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
    });
    tpl.file('xl/workbook.xml', wb.replace('{{SHEETS}}', sheets).replace('{{NAMES}}', names));
    tpl.file('xl/_rels/workbook.xml.rels', wbRels.replace('{{SHEETRELS}}', rels));
    tpl.file('[Content_Types].xml', ct.replace('{{OVERRIDES}}', overrides));
    return tpl.generateAsync({ type, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  }

  root.PIXlsx = { buildXlsx, _buildSheet: buildSheet };
})(typeof window !== 'undefined' ? window : globalThis);

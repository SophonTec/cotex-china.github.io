// 模版：形式发票 PI（客户 PI → 公司模版）
(function () {
  const cfg = window.PI_CONFIG;
  const P = window.PIParser;
  const money = (x) => window.PIPdf.money(x);
  const safeName = (s) => String(s || 'PI').replace(/[\\/:*?"<>|]/g, '_');
  const assets = () => window.PI_ASSETS || {};
  const buildPdfWith = (title) => (doc) => window.PIPdf.buildPdf(window.jspdf.jsPDF, doc, cfg, assets(), { title });
  const near = (x, y) => Math.abs(x - y) < 0.005;

  // 解析阶段的提示里，与字段编辑无关、需要一直显示的
  const STICKY = /序号不连续|账户|无法自动归类|表头|海运费|来自 PDF/;

  // 形式发票 PI 与商业发票 CI 内容相同、版式相同，只有标题和文件名不同
  function makeInvoiceTemplate({ id, code, name, nameEn, title, description }) {
  const buildPdf = buildPdfWith(title);
  return {
    id, group: 'bank', badge: '银行',
    name, nameEn,
    description,
    uploadHint: '客户发来的 PI',

    parse(rows, ctx) {
      const { pi, warnings } = P.parseRows(rows, ctx.fileName, cfg);
      if (ctx.source === 'pdf') warnings.unshift({ level: 'info', msg: '来自 PDF：已按版面位置还原表格，请重点核对产品明细和客户信息' });
      const keep = warnings.filter((w) => STICKY.test(w.msg));
      if (code === 'CI') keep.push({ level: 'info', msg: '已带出 PI 的全部明细和金额。如果这票 CI 和 PI 不同（明细更少、金额更小），请在「核对修改」里删行、改数量单价，并调整「金额汇总」' });
      return { doc: pi, warnings: keep };
    },

    validate(doc) {
      let out = [...P.validate(doc)];
      // CI 可能只开 PI 的一部分明细/金额：与原 PI 合计不同不算错误，只提醒
      if (code === 'CI') out = out.map((w) => (/客户文件/.test(w.msg) && w.level === 'error'
        ? { level: 'info', msg: `CI 与原 PI 金额不同：${w.msg.replace(/客户文件/g, '原 PI ')}（如果这票 CI 本来就只开部分明细，可忽略）` } : w));
      if (!doc.items.length) out.push({ level: 'error', msg: '没有产品明细' });
      if (!doc.loadingPort) out.push({ level: 'error', msg: '装货港为空' });
      if (!doc.destinationPort) out.push({ level: 'error', msg: '目的港为空' });
      if (!doc.clientLines.length) out.push({ level: 'error', msg: '客户信息为空' });
      if (!doc.payment) out.push({ level: 'warn', msg: '付款方式为空' });
      if (!doc.shipment) out.push({ level: 'warn', msg: '装运期为空' });
      doc.items.forEach((it, i) => { if (!it.unit) out.push({ level: 'warn', msg: `第 ${i + 1} 项单位为空` }); });
      return out;
    },

    title: (doc) => (doc.invoiceNo ? `${code} ${doc.invoiceNo}` : `${code}（未识别发票号）`),

    stats(doc) {
      const t = P.computeTotals(doc);
      const ref = [doc.customerGrandTotal, doc.customerTotal].filter((x) => x !== null && x !== undefined && !isNaN(x));
      return [
        { label: '产品', value: `${doc.items.length} 项` },
        { label: '合计', value: money(t.total) },
        ...(ref.length ? (() => {
          const same = ref.every((x) => near(x, t.fob) || near(x, t.total) || t.summary.some((s) => near(s.value, x)));
          return code === 'CI'
            ? [{ label: '与原 PI 合计', value: same ? '相同' : '不同', tone: same ? 'ok' : '' }]
            : [{ label: '与客户合计', value: same ? '一致' : '不一致', tone: same ? 'ok' : 'error' }];
        })() : []),
      ];
    },

    // 编辑表单（分组）
    sections: [
      { title: '基本信息', fields: [
        { key: 'invoiceNo', label: '发票号 INVOICE NO' },
        { key: 'date', label: '日期 INVOICE DATE', placeholder: '2026-11-03' },
      ] },
      { title: '客户与银行', fields: [
        { key: 'clientLines', label: '客户信息（每行一条）', type: 'lines', rows: 6 },
        { key: 'bankLines', label: '客户银行信息（每行一条）', type: 'lines', rows: 6 },
      ] },
      { title: '产品明细', items: {
        key: 'items',
        hint: '序号自动生成，金额 = 数量 × 单价',
        columns: [
          { key: 'desc', label: '品名 DESIGNATION', width: '40%' },
          { key: 'qty', label: '数量', type: 'number' },
          { key: 'unit', label: '单位' },
          { key: 'price', label: '单价 USD', type: 'number' },
        ],
        computed: { label: '金额 USD', value: (doc, i) => money(P.computeTotals(doc).lines[i]) },
        newRow: () => ({ desc: '', qty: null, unit: '', price: null }),
        totals: (doc) => [['产品金额合计', money(P.computeTotals(doc).fob)]],
      } },
      { title: '金额汇总', items: {
        key: 'summary',
        hint: '印在单据底部合计框里，可改名、删除、加行。金额留空 = 自动累计（产品金额 + 上面填了金额的行）；填数字 = 固定金额，如海运费',
        addLabel: '添加一行（如 SEA FREIGHT、INSURANCE）',
        columns: [
          { key: 'label', label: '名称（印在单据上）', width: '58%' },
          { key: 'amount', label: '金额 USD（留空自动）', type: 'number' },
        ],
        computed: { label: '显示金额', value: (doc, i) => money(P.computeTotals(doc).summary[i].value) },
        newRow: () => ({ label: '', amount: 0 }),
        insertAt: (doc) => { const f = doc.summary, l = f[f.length - 1]; return f.length && l.amount == null ? f.length - 1 : f.length; },
        totals: (doc) => {
          const t = P.computeTotals(doc);
          const rows = [['单据总额', money(t.total)]];
          if (doc.customerGrandTotal != null) rows.push(['客户文件含运费总额', money(doc.customerGrandTotal)]);
          else if (doc.customerTotal != null) rows.push(['客户文件 TOTAL', money(doc.customerTotal)]);
          return rows;
        },
      } },
      { title: '条款', fields: [
        { key: 'origin', label: "原产地 PAYS D'ORIGINE" },
        { key: 'loadingPort', label: '装货港 LOADING PORT' },
        { key: 'destinationPort', label: '目的港 DESTINATION PORT' },
        { key: 'payment', label: '付款方式 MODE DE PAIEMENT' },
        { key: 'shipment', label: '装运期 SHIPMENT' },
        { key: 'documents', label: '单据 DOCUMENTS（每行一条）', type: 'lines', rows: 3 },
        { key: 'otherTerms', label: '其他条款（每行一条，印在单据下方）', type: 'lines', rows: 3 },
      ] },
    ],

    preview: (doc) => buildPdf(doc).output('blob'),

    exports: [
      { id: 'pdf', label: 'PDF', perDoc: true,
        build: async (docs) => buildPdf(docs[0]).output('blob'),
        fileName: (docs) => `${safeName(docs[0].invoiceNo)} ${code}.pdf` },
      { id: 'xlsx', label: 'Excel', perDoc: true, merge: true, mergeLabel: '合并导出 Excel（每份一个工作表）',
        build: (docs) => window.PIXlsx.buildXlsx(docs, 'blob', { title }),
        fileName: (docs) => `${code}-${docs.map((d) => safeName(d.invoiceNo)).join('&').slice(0, 120)}.xlsx` },
    ],
  };
  }

  DocTool.register(makeInvoiceTemplate({
    id: 'pi', code: 'PI', name: '形式发票 PI', nameEn: 'Proforma Invoice', title: 'PROFORMA INVOICE',
    description: '把客户发来的 PI 转成公司模版，自动核对金额，导出 PDF / Excel',
  }));
  DocTool.register(makeInvoiceTemplate({
    id: 'ci', code: 'CI', name: '商业发票 CI', nameEn: 'Commercial Invoice', title: 'COMMERCIAL INVOICE',
    description: '上传 PI 生成商业发票：默认带出 PI 的全部明细和金额。CI 和 PI 不同时（明细更少、金额更小），在「核对修改」里删改明细、调整金额汇总即可',
  }));
})();

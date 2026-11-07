// 读取“补充资料”（如提单）的全部文字：
// - 文字型 PDF：直接取文字
// - 图片 / 扫描件 PDF：用内置 OCR（tesseract，英文）识别。识别结果可能有错，界面会提示核对。
(function (root) {
  const abs = (p) => new URL(p, location.href).href;
  let loading = null;
  function loadTesseract() {
    if (root.Tesseract) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'lib/ocr/tesseract.min.js';
      s.onload = res; s.onerror = () => rej(new Error('OCR 组件加载失败'));
      document.head.appendChild(s);
    });
    return loading;
  }

  let workerP = null;
  async function getWorker(onProgress) {
    if (location.protocol === 'file:') {
      throw new Error('图片识别需要通过网址打开本工具（双击文件夹里的「启动单证工具.command」，或部署到网上后使用）。也可以直接在下方手动填写。');
    }
    await loadTesseract();
    if (!workerP) {
      workerP = root.Tesseract.createWorker('eng', 1, {
        workerPath: abs('lib/ocr/worker.min.js'),
        corePath: abs('lib/ocr/'),
        langPath: abs('lib/ocr/'),
        gzip: true,
        cacheMethod: 'none',
        logger: (m) => onProgress && m.status === 'recognizing text' && onProgress(m.progress),
      });
    }
    return workerP;
  }

  function linesFromRows(rows) {
    return rows.map((r) => (r || []).filter((x) => x !== null && x !== '').join('   ')).join('\n');
  }

  async function pdfPagesToCanvases(buf, scale) {
    const lib = root.pdfjsLib;
    const doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
    const out = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      out.push(c);
    }
    return out;
  }

  // 返回 { text, method: 'text' | 'ocr' }
  async function readText(file, onProgress) {
    const buf = await file.arrayBuffer();
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    if (isPdf) {
      const r = await root.PIPdfReader.pdfToRows(buf.slice(0));
      if (r.textCount >= 30) return { text: linesFromRows(r.rows), method: 'text' };
      const w = await getWorker(onProgress);
      const canvases = await pdfPagesToCanvases(buf, 300 / 72);
      let text = '';
      for (const c of canvases) text += (await w.recognize(c)).data.text + '\n';
      return { text, method: 'ocr' };
    }
    if (/^image\//.test(file.type) || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.name)) {
      const w = await getWorker(onProgress);
      return { text: (await w.recognize(file)).data.text, method: 'ocr' };
    }
    if (/\.(xlsx|xls|xlsm|csv)$/i.test(file.name)) {
      const wb = root.XLSX.read(buf);
      const rows = root.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: null });
      return { text: linesFromRows(rows), method: 'text' };
    }
    throw new Error('不支持的文件类型');
  }

  root.DocOCR = { readText };
})(window);

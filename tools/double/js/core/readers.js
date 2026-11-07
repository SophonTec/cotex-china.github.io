// 读取上传的文件，统一转成“行 × 列”的二维数组，交给模版解析。
(function (root) {
  async function readFile(file) {
    const buf = await file.arrayBuffer();
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      const { rows, textCount, pages } = await root.PIPdfReader.pdfToRows(buf);
      if (textCount < 10) throw new Error('这个 PDF 是扫描件或图片，里面没有可识别的文字。请让对方提供 Excel 或由电脑直接导出的 PDF');
      return { source: 'pdf', rows, pages };
    }
    if (/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) {
      const wb = root.XLSX.read(buf, { cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = root.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
      return { source: 'excel', rows, workbook: wb };
    }
    throw new Error('不支持的文件类型，请上传 Excel（.xlsx / .xls）或 PDF');
  }
  root.DocReaders = { readFile };
})(window);

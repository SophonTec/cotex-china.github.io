// 单证模版注册中心。每种单证（PI、商业发票、装箱单……）是一个模版，调用 DocTool.register() 注册。
// 模版接口说明见 js/templates/README.md
window.DocTool = {
  templates: [],
  // 左侧分组（模版的 group 字段对应这里的 id）
  groups: [
    { id: 'bank', name: '银行交单', hint: '托收交单给银行的全套单证' },
    { id: 'batch', name: '客户单证 · 每次装柜', hint: '每次装柜后发给客户' },
  ],
  register(tpl) {
    if (this.templates.some((t) => t.id === tpl.id)) throw new Error('模版 id 重复：' + tpl.id);
    this.templates.push(tpl);
  },
  get(id) { return this.templates.find((t) => t.id === id); },
};

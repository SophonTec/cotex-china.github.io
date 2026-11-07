// 公司固定信息与转换规则。要改公司地址、银行信息或术语替换，只需改这个文件。
window.PI_CONFIG = {
  company: {
    name: 'DOUBLE INTERNATIONAL TRADE CO.,LTD',
    lines: [
      'ADD: OFFICE 401, NO.645, NORTH CHOUZHOU ROAD, YIWU, ZHEJIANG, CHINA',
      'TEL: 0086-0579-83450555    MOB: 008613516927500',
      'WEB: www.double-international.com',
    ],
  },

  // 公司收款账户（PDF 底部 "DETAIL DE COMPTE BANCAIRE" 固定输出这几行）
  beneficiary: {
    name: 'DOUBLE INTERNATIONAL TRADE CO.,LTD',
    accountNo: 'OSA15000101560019',
    bank: 'PINGAN BANK CO.,LTD OFFSHORE DEPT',
    address: 'NO.5047, ROAD SHENNAN DONG,SHENZHEN,P.R.CHINA',
    swift: 'SZDBCNBS',
    intermediaryBank: 'CITIBANK,NEW YORK',
    intermediarySwift: 'CITIUS33',
  },

  // 批次发票是人民币（RMB）时用的收款账户。留空（null）= 和上面美元账户相同。
  // 如果有单独的人民币账户，按上面 beneficiary 的格式填进来，例如：
  // beneficiaryRMB: { name: '...', accountNo: '...', bank: '...', address: '...', swift: '...', intermediaryBank: '', intermediarySwift: '' },
  beneficiaryRMB: null,

  // 运费默认值（USD）
  defaultSeaFreight: 0,

  // 文字替换（客户文件 → 公司模版），按顺序执行，用于付款方式、装运期等
  replacements: [
    [/\bA VUE\b/g, 'À VUE'],
    [/\bDAYS\b/g, 'JOURS'],
  ],
};

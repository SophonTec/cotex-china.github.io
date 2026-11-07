// 预留的单证模版（尚未开发）。想先在侧栏占个位置，就在下面列表里加一行；做好后把那一行删掉。
// 例：{ id: 'co', group: 'bank', name: '原产地证 CO', nameEn: 'Certificate of Origin' },
[
].forEach((t) => { if (!DocTool.get(t.id)) DocTool.register({ ...t, comingSoon: true, description: '即将推出' }); });

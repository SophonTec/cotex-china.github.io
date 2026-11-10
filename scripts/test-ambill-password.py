"""Verify the encrypted AM bill tool with synthetic data in an isolated browser."""
import getpass
import json
import os
from pathlib import Path
import re
import sys
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1].rstrip('/') + '/'
password = getpass.getpass('Tool password for verification: ')
with sync_playwright() as p:
    options = {'headless': True}
    if os.environ.get('CHROMIUM_EXECUTABLE'):
        options['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
    if base.startswith('https:') and os.environ.get('HTTPS_PROXY'):
        options['proxy'] = {'server': os.environ['HTTPS_PROXY']}
    browser = p.chromium.launch(**options)
    context = browser.new_context(accept_downloads=True)
    page = context.new_page()
    page.set_default_timeout(30000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    def locked():
        expect(page).to_have_title('AM 发票工具 · 访问验证')
        expect(page.locator('#unlock-form')).to_be_visible()
        assert page.evaluate("typeof AMStore === 'undefined'")
    def unlock():
        page.locator('#access-password').fill(password)
        page.locator('#unlock-button').click()
        expect(page).to_have_title('AM 发票工具')
        expect(page.locator('#storePill')).to_contain_text('浏览器')
        page.wait_for_function("document.querySelector('#f_bank').options.length > 0")
    response = page.goto(base, wait_until='networkidle')
    assert response.status == 200
    sealed_html = response.text()
    locked()
    assert 'AM_SEED_PRODUCTS' not in sealed_html and 'AM_DEFAULTS' not in sealed_html
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.locator('#access-password').fill('wrong-password-for-test')
    page.locator('#unlock-button').click()
    expect(page.locator('#unlock-message')).to_have_text('密码不正确，请重试。')
    page.evaluate("sessionStorage.setItem('unlocked','true');localStorage.setItem('unlocked','true')")
    page.reload(wait_until='networkidle'); locked()
    page.goto(base + 'index.html', wait_until='networkidle'); locked(); unlock()
    print('PASS encrypted root/index, wrong password, storage spoof, mobile entry', flush=True)
    for tab in ['library', 'history', 'invoice']:
        page.locator('[data-tab="'+tab+'"]').click()
        expect(page.locator('#tab-'+tab)).to_be_visible()
    count = page.evaluate('AM_SEED_PRODUCTS.length')
    assert count == 26, count
    for key, value in {'invoiceNo':'QAAM001','date':'2026-11-11','blNo':'QATEST123456','container':'MSCU6639871','ctns':'10','gw':'100','cbm':'5','buyerName':'QA TEST BUYER','buyerAddr':'TEST ADDRESS'}.items():
        page.locator('#f_'+key).fill(value)
    page.locator('#btnPick').click()
    page.locator('#pickGrid .pcard').first.click()
    page.locator('#pickOk').click()
    price = page.evaluate('AM_SEED_PRODUCTS[0].price')
    page.locator('#f_total').fill(str(round(price * 100, 2)))
    page.locator('#btnSuggest').click()
    expect(page.locator('#sumQty')).to_have_text('100')
    expect(page.locator('#sbDiff')).to_have_text('✓ 0.00')
    dialogs = []
    page.on('dialog', lambda d: (dialogs.append(d.message), d.dismiss()))
    with page.expect_download() as download_info:
        page.locator('#tab-invoice [data-export="all"]').click()
    download = download_info.value
    assert not dialogs, dialogs
    assert Path(download.path()).read_bytes().startswith(b'%PDF-')
    page.wait_for_function("AMStore.listInvoices().then(xs=>xs.some(x=>x.invoiceNo==='QAAM001'))")
    page.locator('[data-tab="history"]').click()
    expect(page.locator('#historyList')).to_contain_text('QAAM001')
    print('PASS 26 products, tabs, quantity calculation, full PDF download and history', flush=True)
    pdf_result = page.evaluate('''async () => {
      const inv=await AMStore.loadInvoice('QAAM001');
      inv.bankText=AM_DEFAULTS.banks[0].lines;
      const result={};
      for(const kind of ['ci','contract','pl','all']) {
        const doc=AMPdf.build(kind,inv,AM_DEFAULTS);
        const parsed=await pdfjsLib.getDocument({data:new Uint8Array(doc.output('arraybuffer'))}).promise;
        result[kind]=parsed.numPages;
        await parsed.destroy();
      }
      return result;
    }''')
    assert all(n >= 1 for n in pdf_result.values()) and pdf_result['all'] >= 3, pdf_result
    ocr = page.evaluate('''async () => {
      const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=500;
      const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1500,500);
      ctx.fillStyle='black';ctx.font='40px Arial';
      ['B/L NO. QATEST123456','100 CARTONS','1000 KGS  50 CBM','ON BOARD 11 NOV 2026'].forEach((s,i)=>ctx.fillText(s,30,70+i*90));
      const blob=await new Promise(r=>canvas.toBlob(r));
      const res=await AMBL.readBL(new File([blob],'qa.png',{type:'image/png'}));
      return {method:res.method,blNo:res.fields.blNo,raw:res.rawText};
    }''')
    assert ocr['method'] == 'ocr' and ocr['blNo'] == 'QATEST123456', ocr
    print('PASS individual/full PDF documents and OCR recognition', flush=True)
    page.reload(wait_until='networkidle'); locked(); unlock()
    page.locator('[data-tab="history"]').click()
    page.locator('[data-open="QAAM001"]').click()
    expect(page.locator('#f_invoiceNo')).to_have_value('QAAM001')
    assert password not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})')
    print('PASS reload requires password; browser invoice history persists', flush=True)
    no_js = browser.new_context(java_script_enabled=False)
    np = no_js.new_page(); np.goto(base)
    expect(np.locator('#access-password')).to_be_disabled()
    assert np.locator('#tab-invoice').count() == 0
    no_js.close()
    match = re.search(r'(<script id="sealed-tool" type="application/json">)(.*?)(</script>)',sealed_html,re.S)
    payload=json.loads(match.group(2));cipher=payload['ciphertext']
    payload['ciphertext']=('A' if cipher[0]!='A' else 'B')+cipher[1:]
    changed=sealed_html[:match.start(2)]+json.dumps(payload)+sealed_html[match.end(2):]
    tamper=browser.new_context();tp=tamper.new_page()
    tp.route(base,lambda route:route.fulfill(status=200,content_type='text/html',body=changed))
    tp.goto(base);tp.locator('#access-password').fill(password);tp.locator('#unlock-button').click()
    expect(tp.locator('#unlock-message')).to_have_text('密码不正确，请重试。')
    tamper.close()
    assert not errors, errors
    print(json.dumps({'url':base,'products':count,'pdf_pages':pdf_result,'ocr':True,'pageErrors':errors},ensure_ascii=False),flush=True)
    context.close();browser.close()

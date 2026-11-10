#!/usr/bin/env python3
"""Browser regression check. Usage: python script.py BASE_URL [OUTPUT_DIR].
Password is requested through hidden stdin and never included in reports.
"""
import getpass
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit, urlunsplit

from playwright.sync_api import expect, sync_playwright

base = sys.argv[1]
parts = urlsplit(base)
base = urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip('/') + '/', '', ''))
output = Path(sys.argv[2]) if len(sys.argv) > 2 else None
if output:
    output.mkdir(parents=True, exist_ok=True)
password = getpass.getpass('Tool password for verification: ')
if not password:
    raise SystemExit('A non-empty password is required.')

checks = []

def passed(message):
    checks.append(message)
    print('PASS:', message, flush=True)

with sync_playwright() as p:
    options = dict(headless=True)
    executable = os.environ.get('CHROMIUM_EXECUTABLE')
    if executable:
        options['executable_path'] = executable
    if base.startswith('https:') and os.environ.get('HTTPS_PROXY'):
        options['proxy'] = {'server': os.environ['HTTPS_PROXY']}
    browser = p.chromium.launch(**options)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    context.set_default_timeout(30000)
    page = context.new_page()
    page_errors = []
    page.on('pageerror', lambda e: page_errors.append(str(e)))

    def assert_locked(target):
        expect(target).to_have_title('单证工具 · 访问验证')
        expect(target.locator('#unlock-form')).to_be_visible()
        assert target.locator('#tplList, #workspace, #previewFrame').count() == 0
        assert target.evaluate("typeof DocTool === 'undefined' && typeof PI_CONFIG === 'undefined' && typeof PI_ASSETS === 'undefined'")

    def unlock(target):
        target.locator('#access-password').fill(password)
        target.locator('#unlock-button').click()
        expect(target).to_have_title('单证工具', timeout=30000)
        expect(target.locator('#tplList')).to_be_visible()
        target.wait_for_function("typeof DocTool !== 'undefined' && DocTool.templates.filter(t => !t.comingSoon).length === 6")

    response = page.goto(base, wait_until='networkidle', timeout=60000)
    assert response.status == 200, response.status
    public_html = response.text()
    assert_locked(page)
    for marker in ('window.DocTool', 'window.PI_CONFIG', 'window.PI_ASSETS', 'window.DocOCR', 'data:image/jpeg;base64,'):
        assert marker not in public_html, 'Sensitive application marker in locked response: ' + marker
    assert not page.locator('script[src*="js/core/"], script[src*="js/templates/"]').count()
    if output:
        page.screenshot(path=str(output / 'password-desktop.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    if output:
        page.screenshot(path=str(output / 'password-mobile.png'), full_page=True)
    page.set_viewport_size({'width': 1440, 'height': 1000})
    passed('Root serves only the password gate; application code/data remain sealed; mobile gate fits.')

    page.locator('#access-password').fill('incorrect-test-password-' + ('x' if password != 'incorrect-test-password-x' else 'y'))
    page.locator('#unlock-button').click()
    expect(page.locator('#unlock-message')).to_have_text('密码不正确，请重试。')
    assert_locked(page)
    page.evaluate("""() => {
        for (const store of [sessionStorage, localStorage]) {
            for (const key of ['unlocked', 'authenticated', 'double_unlocked', 'double_authenticated', 'cotex-double-unlocked']) store.setItem(key, 'true');
        }
    }""")
    page.reload(wait_until='networkidle')
    assert_locked(page)
    page.evaluate('sessionStorage.clear(); localStorage.clear()')
    passed('Wrong password and spoofed browser storage cannot unlock the tool.')

    index_response = page.goto(base + 'index.html', wait_until='networkidle', timeout=60000)
    assert index_response.status == 200
    assert_locked(page)
    unlock(page)
    assert page.url == base + 'index.html', page.url
    page.reload(wait_until='networkidle')
    assert_locked(page)
    passed('Direct index.html requires the same password; refresh locks again.')

    routed = base + '?password-check=1#template-check'
    page.goto(routed, wait_until='networkidle', timeout=60000)
    assert_locked(page)
    unlock(page)
    assert page.url == routed, page.url
    passed('Query strings and URL hash neither bypass the gate nor get lost after unlock.')

    templates = page.evaluate('DocTool.templates.filter(t=>!t.comingSoon).map(t=>({id:t.id,name:t.name}))')
    assert len(templates) == 6
    for template in templates:
        page.locator('#tplList button[data-id="' + template['id'] + '"]').click()
        expect(page.locator('#tplName')).to_have_text(template['name'])
    result = page.evaluate('''async () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['TEST',123]]), 'Test');
        const data = XLSX.write(wb, {type:'array',bookType:'xlsx'});
        const rows = XLSX.utils.sheet_to_json(XLSX.read(data).Sheets.Test, {header:1});
        if (rows[0][1] !== 123) throw Error('Excel roundtrip failed');
        const pdf = new jspdf.jsPDF();
        pdf.text('TEST DOCUMENT 123',20,20);
        const parsed = await PIPdfReader.pdfToRows(pdf.output('arraybuffer'));
        if (!JSON.stringify(parsed.rows).includes('TEST DOCUMENT 123')) throw Error('PDF roundtrip failed');
        const c = document.createElement('canvas');
        c.width=700;c.height=120;
        const ctx=c.getContext('2d');
        ctx.fillStyle='white';ctx.fillRect(0,0,700,120);
        ctx.fillStyle='black';ctx.font='48px Arial';ctx.fillText('CONTAINER TEST 12345',20,80);
        const blob=await new Promise(resolve=>c.toBlob(resolve));
        const ocr=await DocOCR.readText(new File([blob],'test.png',{type:'image/png'}));
        if (!ocr.text.includes('12345')) throw Error('OCR roundtrip failed');
        return {excel:true,pdf:true,ocr:true};
    }''')
    assert result == {'excel': True, 'pdf': True, 'ocr': True}
    stored_values = page.evaluate('JSON.stringify({local:{...localStorage},session:{...sessionStorage}})')
    assert password not in stored_values, 'Password persisted in browser storage'
    if output:
        page.screenshot(path=str(output / 'tool-unlocked.png'), full_page=True)
    page.reload(wait_until='networkidle')
    assert_locked(page)
    passed('Six templates and Excel/PDF/OCR roundtrips work after unlocking; no password persisted; refresh relocks.')

    no_js_context = browser.new_context(java_script_enabled=False)
    no_js_page = no_js_context.new_page()
    no_js_page.goto(base, wait_until='networkidle', timeout=60000)
    expect(no_js_page.locator('#unlock-form')).to_be_visible()
    expect(no_js_page.locator('noscript')).to_be_visible()
    assert no_js_page.locator('#tplList, #workspace, #previewFrame').count() == 0
    no_js_context.close()
    passed('Disabling JavaScript does not expose the application.')

    match = re.search(r'(<script\b[^>]*\bid=["\']sealed-tool["\'][^>]*>)(.*?)(</script>)', public_html, re.S)
    assert match, 'Missing sealed-tool payload'
    payload = json.loads(match.group(2))
    ciphertext = payload['ciphertext']
    payload['ciphertext'] = ('A' if ciphertext[0] != 'A' else 'B') + ciphertext[1:]
    changed = public_html[:match.start(2)] + json.dumps(payload) + public_html[match.end(2):]
    tamper_context = browser.new_context()
    tamper_page = tamper_context.new_page()
    tamper_page.route(base, lambda route: route.fulfill(status=200, content_type='text/html; charset=utf-8', body=changed))
    tamper_page.goto(base, wait_until='networkidle')
    tamper_page.locator('#access-password').fill(password)
    tamper_page.locator('#unlock-button').click()
    expect(tamper_page.locator('#unlock-message')).to_have_text('密码不正确，请重试。')
    assert_locked(tamper_page)
    tamper_context.close()
    passed('Modified ciphertext fails authenticated decryption even with the correct password.')

    assert not page_errors, page_errors
    print(json.dumps({'url': base, 'checks': len(checks), 'templates': len(templates), 'roundtrips': result, 'pageErrors': page_errors}, ensure_ascii=False), flush=True)
    context.close()
    browser.close()

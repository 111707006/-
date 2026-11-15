# Creative District：實際操作方案的三片玻璃。用法：python cd_glass.py <輸出資料夾> <網址> headless [p]
# 流程：捲到作業中心 → 按「看方案」→ 升起途中與升完各拍一張 → Esc 關閉 → 再打開 → 按 VIP 的按鈕 → 走到櫃檯那一站。p：手機尺寸
import os, sys, base64
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'cdp_base.py'), encoding='utf-8').read()
phone = len(sys.argv) > 4 and sys.argv[4] == 'p'
sys.argv = sys.argv[:4]
exec(src.split("\ntry:\n    call('Emulation", 1)[0])

def snap(name):
    open(os.path.join(out, name + '.png'), 'wb').write(base64.b64decode(call('Page.captureScreenshot', format='png')['data']))
    print('shot', name, flush=True)
def click(sel):
    r = ev("(() => { const e = document.querySelector(%r); if (!e) return null; const b = e.getBoundingClientRect(); const x = b.x + b.width / 2, y = b.y + b.height / 2; const t = document.elementFromPoint(x, y); return [x, y, !!t && (t === e || e.contains(t))]; })()" % sel)
    print('click', sel, r, flush=True)
    if not r: return
    for t in ('mousePressed', 'mouseReleased'): call('Input.dispatchMouseEvent', type=t, x=r[0], y=r[1], button='left', clickCount=1)
state = lambda: ev("JSON.stringify({view: document.body.dataset.view || '', stop: document.body.dataset.stop, lock: document.documentElement.classList.contains('lock'), hot: [...document.querySelectorAll('.glass.hot')].map(e => e.id), op: [...document.querySelectorAll('.glass')].map(e => +(+e.style.opacity).toFixed(2)), plan: document.querySelector('#talk').dataset.plan || '', href: document.querySelector('#talk').href, y: Math.round(scrollY / innerHeight * 100) / 100})")

try:
    if phone: call('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=2, mobile=True)
    else: call('Emulation.setDeviceMetricsOverride', width=1280, height=720, deviceScaleFactor=1, mobile=False)
    call('Runtime.enable'); call('Log.enable')
    call('Page.navigate', url=url + ('&' if '?' in url else '?') + 'nointro')
    for _ in range(120):
        if ev("window.__ready || document.body.classList.contains('nogpu')"): break
        time.sleep(0.25)
    ev("scrollTo(0, 3 * 1.25 * innerHeight + 1)"); time.sleep(3.5)
    print('at stop', state(), flush=True); snap('g1-stop3')
    click('[data-view="plans"]'); time.sleep(0.7); snap('g2-rising'); time.sleep(3)
    print('plans open', state(), flush=True); snap('g3-plans')
    if phone:
        click('#vbar [data-sel="0"]'); time.sleep(1.8); snap('g3b-single'); click('#vbar [data-sel="1"]'); time.sleep(1.5)
    key('Escape', 'Escape', 27); time.sleep(3)
    print('closed', state(), flush=True); snap('g4-closed')
    click('[data-view="plans"]'); time.sleep(4)
    click('#g1 .go'); time.sleep(1.2); snap('g5-leaving'); time.sleep(5)
    print('at counter', state(), flush=True); snap('g6-counter')
    print('errors', ev("JSON.stringify(window.__errs || [])"), flush=True)
finally:
    proc.terminate()

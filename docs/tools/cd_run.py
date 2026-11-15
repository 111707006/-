# Creative District：開場、幀率、替代版本。用法：python cd_run3.py <輸出資料夾> <網址> headless
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'cdp_base.py'), encoding='utf-8').read()
exec(src.split("\ntry:\n    call('Emulation", 1)[0])

FPS = """new Promise(res => { let n=0, t0=performance.now(), mx=0, last=t0; const f=(t)=>{ n++; mx=Math.max(mx,t-last); last=t;
 if (t-t0>4000) res(JSON.stringify({fps:+(n/((t-t0)/1000)).toFixed(1), maxGapMs:Math.round(mx), canvas:[document.querySelector('#stage').width, document.querySelector('#stage').height]}));
 else requestAnimationFrame(f); }; requestAnimationFrame(f); })"""
READY = "window.__ready ? 'ready' : document.body && document.body.classList.contains('nogpu') ? 'nogpu' : ''"

def snap(name):
    open(os.path.join(out, name + '.png'), 'wb').write(base64.b64decode(call('Page.captureScreenshot', format='png')['data']))
    print('shot', name, flush=True)

def load(tag, w, h, dsf, mobile, u=None):
    call('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=dsf, mobile=mobile)
    call('Page.navigate', url='about:blank'); time.sleep(0.4)
    t0 = time.time(); call('Page.navigate', url=u or url)
    st = None
    for _ in range(400):
        st = ev(READY)
        if st: break
        time.sleep(0.05)
    print(tag, 'state', st, 'after %.1fs' % (time.time() - t0), flush=True)
    return time.time()

try:
    # 1. 開場：由遠推近
    t = load('intro', 1280, 720, 1, False)
    for name, at in [('i1-0.4s', 0.4), ('i2-1.6s', 1.6), ('i3-3.0s', 3.0), ('i4-4.5s', 4.5), ('i5-7.5s', 7.5)]:
        time.sleep(max(0, t + at - time.time())); snap(name)
        print(name, 'hero on:', ev("document.querySelector('.panel.hero').classList.contains('on')"), flush=True)
    # 2. 幀率（讓解析度有時間升到上限）
    time.sleep(12)
    print('desktop stop0', ev(FPS), flush=True)
    for k in range(1, 5):
        ev("scrollTo(0, %d*1.25*innerHeight+1)" % k); time.sleep(4.5)
        print('desktop stop%d' % k, ev(FPS), flush=True)
        snap('s%d' % k)
    # 一進來就捲動：開場要快轉
    t = load('skip', 1280, 720, 1, False)
    ev("scrollTo(0, 1*1.25*innerHeight+1)"); time.sleep(3.5); snap('skip-to-1')
    print('skip stop', ev('document.body.dataset.stop'), flush=True)
    # 3. 手機
    t = load('phone', 390, 844, 3, True)
    time.sleep(8); print('phone stop0', ev(FPS), flush=True); snap('ph0')
    for k in (1, 3):
        ev("scrollTo(0, %d*1.25*innerHeight+1)" % k); time.sleep(4.5)
        print('phone stop%d' % k, ev(FPS), flush=True)
    # 4. 不支援 WebGPU 的手機：替代版本
    sid = call('Page.addScriptToEvaluateOnNewDocument', source="Object.defineProperty(Navigator.prototype, 'gpu', { get() { return undefined; } });")
    t = load('nogpu-phone', 390, 844, 3, True)
    time.sleep(2); snap('fb-p0')
    print('fb class', ev('document.body.className'), 'hero on', ev("document.querySelector('.panel.hero').classList.contains('on')"), 'load hidden', ev("getComputedStyle(document.getElementById('load')).visibility"), flush=True)
    for k in (2, 4):
        ev("scrollTo(0, %d*1.25*innerHeight+1)" % k); time.sleep(2.5); snap('fb-p%d' % k)
        print('fb stop', ev('document.body.dataset.stop'), 'panel', ev("(document.querySelector('.panel.on')||{}).innerText"), flush=True)
    t = load('nogpu-desktop', 1280, 720, 1, False); time.sleep(2); snap('fb-d0')
finally:
    proc.terminate()

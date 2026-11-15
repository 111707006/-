# Creative District：快速截圖（固定站點）。用法：python cd_shots.py <輸出資料夾> <網址> headless [站點,…]
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'cdp_base.py'), encoding='utf-8').read()
stops_arg = sys.argv[4] if len(sys.argv) > 4 else '0,1,2,3,4,2.5,3.5,p0,p1,p2,p3,p4'
sys.argv = sys.argv[:4]
exec(src.split("\ntry:\n    call('Emulation", 1)[0])

def one(tag):
    phone = tag.startswith('p'); t = tag.lstrip('p')
    if phone: call('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=2, mobile=True)
    else: call('Emulation.setDeviceMetricsOverride', width=1280, height=720, deviceScaleFactor=1, mobile=False)
    call('Page.navigate', url='about:blank'); time.sleep(0.3)
    call('Page.navigate', url=url + ('&' if '?' in url else '?') + 't=%s&time=12' % t)
    st = None
    for _ in range(120):
        st = ev("window.__ready ? 'ready' : document.body && document.body.classList.contains('nogpu') ? 'nogpu' : ''")
        if st: break
        time.sleep(0.25)
    if st != 'ready': print(tag, 'STATE', st, flush=True)
    time.sleep(2.5)
    shot(('p' if phone else 'd') + t)

try:
    for tag in stops_arg.split(','): one(tag)
finally:
    proc.terminate()

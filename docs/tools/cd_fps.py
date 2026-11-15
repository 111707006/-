# Creative District：比較高、低畫質的幀率。用法：python cd_fps.py <輸出資料夾> <網址> headless [解析度倍率]
# 用很高的解析度倍率把幀率壓到螢幕更新率以下，兩級才比得出差別。
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'cdp_base.py'), encoding='utf-8').read()
sc = sys.argv[4] if len(sys.argv) > 4 else '3'
sys.argv = sys.argv[:4]
exec(src.split("\ntry:\n    call('Emulation", 1)[0])
FPS = """new Promise(res => { let n=0, t0=performance.now(); const f=(t)=>{ n++;
 if (t-t0>3000) res(JSON.stringify({fps:+(n/((t-t0)/1000)).toFixed(1), q:window.__q, canvas:[document.querySelector('#stage').width, document.querySelector('#stage').height]}));
 else requestAnimationFrame(f); }; requestAnimationFrame(f); })"""
try:
    call('Emulation.setDeviceMetricsOverride', width=1280, height=720, deviceScaleFactor=1, mobile=False)
    for t in ('0', '1', '3', '4'):
        for q in ('high', 'low'):
            call('Page.navigate', url='about:blank'); time.sleep(0.3)
            call('Page.navigate', url=url + '?q=%s&scale=%s&t=%s' % (q, sc, t))
            for _ in range(200):
                if ev("window.__ready ? 1 : 0"): break
                time.sleep(0.05)
            time.sleep(1.5)
            print('stop', t, q, ev(FPS), flush=True)
finally:
    proc.terminate()

import os, sys
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'cdp_base.py'), encoding='utf-8').read()
exec(src.split("\ntry:\n    call('Emulation", 1)[0])
def snap(name):
    open(os.path.join(out, name + '.png'), 'wb').write(base64.b64decode(call('Page.captureScreenshot', format='png')['data']))
try:
    for tag, w, h, dsf, mob in [('fb-p', 390, 844, 3, True), ('fb-d', 1280, 720, 1, False)]:
        call('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=dsf, mobile=mob)
        call('Page.navigate', url='about:blank'); time.sleep(0.4)
        call('Page.navigate', url=url + '?nogpu'); time.sleep(3)
        print(tag, 'class', ev('document.body.className'), '| hero on', ev("document.querySelector('.panel.hero').classList.contains('on')"), '| load', ev("getComputedStyle(document.getElementById('load')).visibility"), '| note', ev("getComputedStyle(document.querySelector('.note')).display"), flush=True)
        snap(tag + '0')
        for k in (1, 2, 3, 4):
            ev("scrollTo(0, %d*1.25*innerHeight+1)" % k); time.sleep(1.5)
            print(tag, 'stop', ev('document.body.dataset.stop'), '| h2 shown', ev("(()=>{const h=document.querySelector('.panel.on h2');return h?getComputedStyle(h).display:'none'})()"), '| btn', ev("(()=>{const b=document.querySelector('.panel.on .btn');return b?b.getBoundingClientRect().width>0:false})()"), flush=True)
            if k in (2, 4): snap(tag + str(k))
finally:
    proc.terminate()

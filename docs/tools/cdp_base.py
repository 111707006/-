# 用獨立的 Chrome（GTX 1650）拍截圖並跑基準測試。只用標準函式庫。
# 用法：python cdp.py <輸出資料夾> <網址> [headless] [shots|bench|fallback]
# headless：不開視窗（不會搶走正在用這台電腦的人的焦點）。shots／bench：只拍截圖或只跑基準測試
import base64, json, os, socket, struct, subprocess, sys, tempfile, time, urllib.request

out, url, opts = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(out, exist_ok=True)
PORT = 9333
chrome = next(p for p in [r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
                          os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe')] if os.path.exists(p))
prof = tempfile.mkdtemp(prefix='fgchrome')
proc = subprocess.Popen([chrome, '--user-data-dir=' + prof, '--remote-debugging-port=%d' % PORT, '--force_high_performance_gpu', '--no-first-run',
                         '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
                         '--window-size=1000,760'] + (['--headless=new', '--enable-gpu', '--enable-unsafe-webgpu'] if 'headless' in opts else []) + ['about:blank'])
ws = None
for _ in range(40):
    try:
        tabs = json.load(urllib.request.urlopen('http://127.0.0.1:%d/json' % PORT))
        ws = next(t['webSocketDebuggerUrl'] for t in tabs if t['type'] == 'page'); break
    except Exception: time.sleep(0.5)
path = ws.split('%d' % PORT, 1)[1]
s = socket.create_connection(('127.0.0.1', PORT))
s.sendall(('GET %s HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n'
           % (path, PORT, base64.b64encode(os.urandom(16)).decode())).encode())
buf = b''
while b'\r\n\r\n' not in buf: buf += s.recv(4096)
buf = buf.split(b'\r\n\r\n', 1)[1]

def need(n):
    global buf
    while len(buf) < n: buf += s.recv(65536)
    r, buf = buf[:n], buf[n:]; return r
def recv():
    data = b''
    while True:
        h = need(2); fin, n = h[0] & 128, h[1] & 127
        if n == 126: n = struct.unpack('>H', need(2))[0]
        elif n == 127: n = struct.unpack('>Q', need(8))[0]
        data += need(n)
        if fin: return data
def send(o):
    d = json.dumps(o).encode(); m = os.urandom(4); n = len(d)
    h = b'\x81' + (bytes([128 | n]) if n < 126 else bytes([254]) + struct.pack('>H', n) if n < 65536 else bytes([255]) + struct.pack('>Q', n))
    s.sendall(h + m + bytes(b ^ m[i & 3] for i, b in enumerate(d)))
nid = 0
def call(method, **params):
    global nid
    nid += 1; send({'id': nid, 'method': method, 'params': params})
    while True:
        r = json.loads(recv())
        if r.get('id') == nid: return r.get('result', r)
def ev(js):
    r = call('Runtime.evaluate', expression=js, returnByValue=True, awaitPromise=True)
    return r.get('result', {}).get('value')
def shot(name):
    time.sleep(1.5)
    open(os.path.join(out, name + '.png'), 'wb').write(base64.b64decode(call('Page.captureScreenshot', format='png')['data']))
    print('shot', name, flush=True)
def key(code, k, vk=0):
    for t in ('keyDown', 'keyUp'): call('Input.dispatchKeyEvent', type=t, code=code, key=k, windowsVirtualKeyCode=vk or ord(k.upper()))

try:
    call('Emulation.setDeviceMetricsOverride', width=1280, height=720, deviceScaleFactor=1, mobile=False)
    call('Page.navigate', url=url)
    time.sleep(1.2); shot('01-loading')
    for _ in range(120):
        if ev('document.body.className') == 'm': break
        time.sleep(0.5)
    # 無視窗模式的瀏覽器語言是英文：按選單的語言鈕切回中文
    ev("document.body.dataset.l === 'en' && document.querySelector('.lg').click()")
    if 'fallback' in opts:
        # 替代版本的背景圖：沒有任何介面的場景截圖，存成 JPEG（輸出資料夾給 site/fallback）
        call('Emulation.setDeviceMetricsOverride', width=1600, height=900, deviceScaleFactor=1, mobile=False)
        ev("document.getElementById('d').click(); for (const e of document.body.children) if (e.tagName !== 'CANVAS') e.style.display = 'none'")
        time.sleep(3)
        for name, js in [('plaza', 'dev.lookAt(...dev.SPAWN)'), ('computers', 'dev.turn(0.55, -0.02)'), ('chests', 'dev.turn(-1.7)')]:
            ev(js); time.sleep(2.5)
            open(os.path.join(out, name + '.jpg'), 'wb').write(base64.b64decode(call('Page.captureScreenshot', format='jpeg', quality=70)['data']))
            print('shot', name, flush=True)
        raise SystemExit
    time.sleep(1); shot('02-menu')
    print('adapter', ev("navigator.gpu.requestAdapter().then(a => a.info.vendor + ' ' + a.info.architecture + ' ' + a.info.description)"), flush=True)
    ev("localStorage.removeItem('fgOpen'); document.getElementById('d').click(); document.getElementById('hn').style.display='none'; dev.lookAt(...dev.SPAWN)")
    time.sleep(2); shot('03-spawn')
    for name, a in [] if 'bench' in opts else [('04-right', 0.9), ('05-left-1', -1.2), ('06-left-2', -2.2), ('07-behind', 3.14)]:
        ev('dev.turn(%s)' % a); shot(name)
    if 'bench' not in opts:
        ev("document.querySelectorAll('#jl button')[4].click()"); time.sleep(0.45); shot('08-opening'); time.sleep(2); shot('09-map-process')
        ev('dev.closeWin()'); shot('10-opened-chest')
        ev("document.querySelectorAll('#jl button')[1].click()"); time.sleep(3.5); shot('11-info-computer'); key('Escape', 'Escape', 27)
        ev('dev.turn(0.9)'); shot('12-info-far')
        print('state', ev('JSON.stringify(dev.state())'), 'gpu', ev('dev.gpu ? dev.gpu() : ""'), flush=True)
    # 基準測試：固定 860x578（與前兩批相同），B 鍵飛 60 秒
    call('Emulation.setDeviceMetricsOverride', width=860, height=578, deviceScaleFactor=1, mobile=False)
    ev("localStorage.removeItem('fgOpen')")
    for run in range(0 if 'shots' in opts else 2):
        time.sleep(2); key('KeyB', 'b'); time.sleep(64)
        for _ in range(20):
            t = ev("document.getElementById('i').textContent")
            if t and 'Fly-through' in t: break
            time.sleep(1)
        print('bench', run + 1, t, flush=True)
finally:
    proc.terminate()

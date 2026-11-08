# Pruebas en Chrome sin interfaz sobre una COPIA de index.html. Nunca toca Firebase:
# las llamadas a firebaseio.com / googleapis.com se responden con datos de prueba.
# uso: python tests/run.py [opciones] a.js [b.js ...]
#   --fixture tests/fixture.json  datos iniciales simulados
#   --pdf ruta.pdf                deja el PDF en window.__pdfB64 (T.pdfFile() lo convierte en File)
#   --expected ruta.json          deja el JSON en window.__expected
#   --width 1000 --theme light|dark
#   --serve                       sirve por http y deja que la app cargue pdf.js real desde cdnjs
#   --shot salida.png             además guarda una captura
import argparse, base64, functools, hashlib, html, http.server, json, os, re, subprocess, sys, threading, time, urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tests", ".cache")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/"
PDFJS_SRI = {
    "pdf.min.js": "q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==",
    "pdf.worker.min.js": "BbrZ76UNZq5BhH7LL7pn9A4TKQpQeNCHOo65/akfelcIBbcVvYWOFQKPXIrykE3qZxYjmDX573oa4Ywsc7rpTw==",
}

def vendor():
    """Copias locales de pdf.js para las pruebas (con el worker en el hilo principal)."""
    os.makedirs(CACHE, exist_ok=True)
    for name, sri in PDFJS_SRI.items():
        p = os.path.join(CACHE, name)
        if not os.path.exists(p):
            urllib.request.urlretrieve(PDFJS_BASE + name, p)
        got = base64.b64encode(hashlib.sha512(open(p, "rb").read()).digest()).decode()
        if got != sri:
            os.remove(p)
            sys.exit("El hash de " + name + " no coincide; se borró la copia.")

PRELUDE = r"""<script>
try{localStorage.clear();localStorage.setItem('theme',%(theme)s);}catch(e){}
window.__errs=[];addEventListener('error',e=>__errs.push(e.message));addEventListener('unhandledrejection',e=>__errs.push(String(e.reason&&e.reason.stack||e.reason)));
window.__db=%(db)s;window.__puts=0;window.__pdfB64=%(pdf)s;window.__expected=%(exp)s;
const __realFetch=window.fetch.bind(window);
window.fetch=async(u,o)=>{u=String(u);
 if(!/firebaseio\.com|googleapis\.com/.test(u))return __realFetch(u,o);
 if(o&&o.method==='PUT'){__puts++;__db=JSON.parse(o.body);return{ok:true,status:200,json:async()=>({})};}
 return{ok:true,status:200,json:async()=>JSON.parse(JSON.stringify(__db))};};
const __canon=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x).sort().reduce((o,kk)=>{o[kk]=x[kk];return o;},{}):x);
window.T={R:[],
 ok(n,c,x){this.R.push((c?'PASS ':'FAIL ')+n+(!c&&x!==undefined?' -> '+x:''));},
 eq(n,a,b){const A=__canon(a),B=__canon(b);this.ok(n,A===B,A+' (esperado '+B+')');},
 sleep:ms=>new Promise(r=>setTimeout(r,ms)),
 L:(page,y,items)=>({page,y,items:items.map(([x,str])=>({x,str})),text:items.map(i=>i[1].trim()).filter(Boolean).join(' ')}),
 pdfFile(){const b=Uint8Array.from(atob(window.__pdfB64),c=>c.charCodeAt(0));return new File([b],'extracto.pdf',{type:'application/pdf'});},
 done(){if(__errs.length)this.R.push('FAIL errores JS -> '+JSON.stringify(__errs));const txt=this.R.join('\n');
  const p=document.createElement('pre');p.id='RES';p.textContent=txt;document.body.appendChild(p);
  try{if(parent!==window)parent.postMessage({__res:txt},'*');}catch(e){}
  if(location.protocol.indexOf('http')===0)__realFetch('/__result',{method:'POST',body:txt});}};
window.TEST=fn=>{(async()=>{await T.sleep(400);await fn();})().catch(e=>T.ok('la prueba no se cayó',false,e&&e.stack||e)).then(()=>T.done());};
</script>"""

def build(a):
    s = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    s, n = re.subn(r'const FB_API_KEY = "[^"]*";', 'const FB_API_KEY = "";', s)
    if n != 1:
        sys.exit("No encontré FB_API_KEY en index.html")
    j = lambda v: json.dumps(v, ensure_ascii=False).replace("</", "<\\/")
    db = json.load(open(a.fixture, encoding="utf-8"))
    pdf = base64.b64encode(open(a.pdf, "rb").read()).decode() if a.pdf else None
    exp = json.load(open(a.expected, encoding="utf-8")) if a.expected else None
    head = PRELUDE % {"theme": j(a.theme), "db": j(db), "pdf": j(pdf), "exp": j(exp)}
    if not a.serve:
        head += '<script src="pdf.min.js"></script><script src="pdf.worker.min.js"></script>'
    s = s.replace('<meta charset="UTF-8"/>', '<meta charset="UTF-8"/>' + head, 1)
    tests = "".join("<script>" + open(f, encoding="utf-8").read().replace("</", "<\\/") + "</script>" for f in a.files)
    s = s.replace("</body>", tests + "</body>", 1)
    out = os.path.join(CACHE, "run.html")
    open(out, "w", encoding="utf-8").write(s)
    return out

MIN_W = 500  # Chrome sin interfaz no baja de 500 px: para menos, la app corre en un marco de ese ancho

def frame(out, width):
    f = os.path.join(CACHE, "frame.html")
    open(f, "w", encoding="utf-8").write(
        '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#888">'
        f'<iframe src="{os.path.basename(out)}" style="width:{width}px;height:900px;border:0;display:block"></iframe>'
        "<script>addEventListener('message',e=>{if(e.data&&e.data.__res!=null){const p=document.createElement('pre');"
        "p.id='RES';p.textContent=e.data.__res;document.body.appendChild(p);}});</script></body>")
    return f

def run_file(out, a):
    page = frame(out, a.width) if a.width < MIN_W else out
    url = "file:///" + page.replace("\\", "/")
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
           f"--window-size={max(a.width, MIN_W)},900", "--virtual-time-budget=30000"]
    o = subprocess.run(cmd + ["--dump-dom", url], capture_output=True, timeout=240).stdout.decode("utf-8", "replace")
    if a.shot:
        subprocess.run(cmd + ["--screenshot=" + os.path.abspath(a.shot), url], capture_output=True, timeout=240)
    m = re.search(r'<pre id="RES">(.*?)</pre>', o, re.S)
    return html.unescape(m.group(1)) if m else None

def run_served(a):
    """Tiempo real por http: la app carga pdf.js de verdad desde cdnjs."""
    result = {}
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args): pass
        def do_POST(self):
            n = int(self.headers.get("Content-Length", 0))
            result["body"] = self.rfile.read(n).decode("utf-8")
            self.send_response(204); self.end_headers()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(H, directory=CACHE))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_port}/run.html"
    p = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--user-data-dir=" + os.path.join(CACHE, "chrome-profile"),
                          f"--window-size={a.width},900", "--remote-debugging-port=0", url],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.time()
    while "body" not in result and time.time() - t0 < 90:
        time.sleep(0.2)
    p.kill(); srv.shutdown()
    return result.get("body")

ap = argparse.ArgumentParser()
ap.add_argument("files", nargs="+")
ap.add_argument("--fixture", default=os.path.join(ROOT, "tests", "fixture.json"))
ap.add_argument("--pdf"); ap.add_argument("--expected")
ap.add_argument("--width", type=int, default=1000); ap.add_argument("--theme", default="light")
ap.add_argument("--serve", action="store_true"); ap.add_argument("--shot")
a = ap.parse_args()
vendor()
out = build(a)
res = run_served(a) if a.serve else run_file(out, a)
if res is None:
    print("FAIL la página no devolvió resultados"); sys.exit(1)
print(res)
lines = res.splitlines()
bad = [l for l in lines if l.startswith("FAIL")]
ok = [l for l in lines if l.startswith("PASS")]
print(f"\n{len(ok)} pasan, {len(bad)} fallan")
sys.exit(1 if bad or not ok else 0)

# Importar extractos y clasificarlos deslizando — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir el PDF del extracto Davibank, elegir un rango de fechas y clasificar cada compra deslizando una tarjeta (→ compartido, ← mío, ↑ no registrar, ↶ deshacer), guardando todo en un solo `persist`.

**Architecture:** Todo vive en `index.html` (app de un solo archivo, JS sin framework, funciones `renderX()` que devuelven HTML y botones con `onclick`). Se agrega una sección `IMPORTAR EXTRACTOS` con dos capas: lectores puros (texto → filas → tarjetas, sin DOM, probados con líneas sintéticas) y la interfaz (pantallas del importador dentro de la pestaña Registrar). pdf.js 3.11.174 se carga desde cdnjs solo al abrir un PDF, con hash SRI y el worker verificado y servido como blob.

**Tech Stack:** JS del navegador (ES2018, sin `?.`/`??`), pdf.js 3.11.174 (cdnjs), Firebase RTDB vía `persist()`, pruebas en Chrome sin interfaz con Python 3.10 (`tests/run.py`), revisión de sintaxis con `esprima` de Python.

**Spec:** `docs/superpowers/specs/2026-11-08-importar-extractos-design.md`

## Global Constraints

- El PDF nunca sale del dispositivo; la contraseña del PDF no se guarda en ningún lado (ni estado persistido, ni `localStorage`, ni el campo después de enviarla).
- pdf.js versión exacta `3.11.174` desde `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/`. SRI:
  - `pdf.min.js`: `sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==`
  - `pdf.worker.min.js`: `sha512-BbrZ76UNZq5BhH7LL7pn9A4TKQpQeNCHOo65/akfelcIBbcVvYWOFQKPXIrykE3qZxYjmDX573oa4Ywsc7rpTw==`
- Gasto importado: `{ id, type:"expense", user:"shared"|"B", paidBy:"B" (solo si compartido), registeredBy:"B", amount, date:"YYYY-MM-DD", description, category, isRecurring:false, note, importKey }`. No escribir campos `null` (Firebase los borra).
- `importKey` = `banco|fecha|comprobante|valor`; sin comprobante, se usa el comercio normalizado en su lugar.
- Nada se escribe hasta "Guardar"; un solo `persist`, así el ↶ general de la app lo revierte.
- Las pruebas NUNCA tocan Firebase real: `tests/run.py` vacía `FB_API_KEY` y responde las URLs `firebaseio.com`/`googleapis.com` con datos de prueba.
- El repositorio es público: ningún monto, comercio ni dato real del extracto va en archivos versionados. Las cifras del extracto real viven en `Pagos Casa/Extractos/Davibank-2026-10.expected.json` (ignorado por git).
- Texto visible en español. Todo texto que venga del PDF se pinta con `escH()`.
- JS compatible con el revisor `esprima` (ES2018): nada de `?.`, `??`, `catch{}` sin variable, grupos con nombre en regex ni el flag `u` con `\p{}`.
- Toda la lógica nueva va entre `// ═══ IMPORTAR EXTRACTOS ═══` y `// ═══ FIN IMPORTAR EXTRACTOS ═══`; cada tarea agrega código justo antes de la línea `FIN`.

## Ajustes respecto al diseño (aprobados al presentar el plan)

- **Rango por defecto:** va de la primera a la última tarjeta del extracto, no solo el periodo facturado; así entran las compras que llegaron tarde (como una del día anterior al corte).
- **Cambiar categoría:** la tarjeta muestra la categoría sugerida para cada lado ("Compartido: Mercado · Mío: Otro personal"); se cambia con un toque en el resumen, donde ya se sabe si es compartido o mío.
- **"No registrar" se recuerda:** su huella se guarda en `d.importSkipped` para que no vuelva a salir al reimportar un rango que se cruza.
- **Pruebas:** la carpeta `tests/` se agrega al repositorio con datos inventados; el extracto real solo se usa desde `Pagos Casa/`.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `index.html` | App. Se agrega la sección IMPORTAR EXTRACTOS (lectores, clasificación, carga de PDF, pantallas, gestos), su CSS, el botón en Registrar y el enganche en `render()`. |
| `tests/run.py` | Construye una copia de `index.html` con Firebase simulado, inyecta las pruebas y las corre en Chrome sin interfaz. |
| `tests/check_syntax.py` | Revisa la sintaxis de cada `<script>` de `index.html` con esprima. |
| `tests/fixture.json` | Datos de prueba inventados (no reales). |
| `tests/davibank_lines.js` | Líneas sintéticas con la misma forma que devuelve pdf.js para un extracto Davibank. |
| `tests/import_helpers.js` | Atajo para llegar a la pantalla de rango con las líneas sintéticas. |
| `tests/smoke.js`, `tests/import_parse.js`, `tests/import_logic.js`, `tests/import_pdf.js`, `tests/import_cdn.js`, `tests/import_password.js`, `tests/import_screens.js`, `tests/import_deck.js`, `tests/import_save.js`, `tests/import_mobile.js` | Pruebas. |
| `tests/make_locked_pdf.py` | Genera un PDF con contraseña para probar ese flujo. |
| `.gitignore` | Agrega `tests/.cache/`. |

Convención de pruebas: cada archivo de prueba llama `TEST(async()=>{ ... })` una sola vez; los archivos auxiliares solo definen datos o funciones. `T.ok(nombre, condición, detalle)`, `T.eq(nombre, actual, esperado)` (compara JSON con llaves ordenadas), `T.sleep(ms)`, `T.L(página, y, [[x,"texto"],...])` arma una línea, `T.pdfFile()` arma un `File` con el PDF pasado por `--pdf`. Cualquier error JS de la página cuenta como FAIL.

---

### Task 1: Herramientas de prueba

**Files:**
- Create: `tests/run.py`
- Create: `tests/check_syntax.py`
- Create: `tests/fixture.json`
- Create: `tests/smoke.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `python tests/run.py [--fixture F] [--pdf P] [--expected E] [--width N] [--theme light|dark] [--serve] [--shot PNG] a.js [b.js ...]` imprime una línea PASS/FAIL por aserción, sale con código 1 si algo falla. En la página: `T`, `TEST`, `__db` (datos simulados, se actualiza en cada PUT), `__puts` (número de PUT), `__pdfB64`, `__expected`.
- Produces: `python tests/check_syntax.py` imprime `script N ok` por bloque o lanza error.

- [ ] **Step 1: Agregar la carpeta de caché a `.gitignore`**

Agregar al final de `.gitignore`:

```
tests/.cache/
```

- [ ] **Step 2: Crear `tests/check_syntax.py`**

```python
# Revisa la sintaxis de cada <script> de index.html (no hay Node en este equipo).
import os, re, sys, esprima
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
for i, b in enumerate(re.findall(r"<script>(.*?)</script>", s, re.S)):
    b = b.replace(r"/^\p{Emoji_Presentation}/u", "/^x/")
    esprima.parseScript(b)
    print("script", i, "ok", len(b))
```

- [ ] **Step 3: Crear `tests/fixture.json` (datos inventados)**

```json
{
  "entries": [
    {"id": 1, "type": "expense", "user": "shared", "paidBy": "A", "registeredBy": "A", "amount": 8000, "date": "2026-09-22", "description": "Mercado tienda", "category": "Mercado", "isRecurring": false},
    {"id": 2, "type": "expense", "user": "B", "registeredBy": "B", "amount": 60000, "date": "2026-10-13", "description": "CINE PRUEBA", "category": "Entretenimiento", "isRecurring": false, "importKey": "davibank|2026-10-13|111111|60000"}
  ],
  "balances": {"A": 0, "B": 0},
  "names": {"A": "Marce", "B": "John"},
  "cats": {
    "shared": ["Casa / Arriendo", "Parqueadero", "Servicios", "Mercado", "Deuda banco", "Otro compartido"],
    "personal": ["Transporte", "Ropa", "Salud", "Entretenimiento", "Deuda personal", "Otro personal"]
  },
  "split": {"A": 50, "B": 50},
  "importRules": {"DIDI": {"decision": "B", "category": "Transporte"}},
  "importSkipped": ["davibank|2026-10-12|222222|6850"]
}
```

- [ ] **Step 4: Crear `tests/run.py`**

```python
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

def run_file(out, a):
    url = "file:///" + out.replace("\\", "/")
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
           f"--window-size={a.width},900", "--virtual-time-budget=30000"]
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
```

- [ ] **Step 5: Crear `tests/smoke.js`**

```js
TEST(async()=>{
  T.ok("la app arranca",document.getElementById("content").innerText.length>0);
  T.eq("datos de prueba cargados",D().entries.length,2);
  T.ok("pdf.js disponible en pruebas",!!window.pdfjsLib);
  T.ok("Firebase simulado",__puts===0);
});
```

- [ ] **Step 6: Correr las herramientas**

Run: `python tests/check_syntax.py`
Expected: `script 0 ok ...` y `script 1 ok ...`, sin error.

Run: `python tests/run.py tests/smoke.js`
Expected: 4 líneas PASS y `4 pasan, 0 fallan`.

- [ ] **Step 7: Commit**

```bash
git add .gitignore tests/run.py tests/check_syntax.py tests/fixture.json tests/smoke.js
git commit -m "Test: herramientas de prueba en Chrome sin interfaz con Firebase simulado"
```

---

### Task 2: Lector Davibank (funciones puras)

**Files:**
- Create: `tests/davibank_lines.js`
- Create: `tests/import_parse.js`
- Modify: `index.html` (insertar la sección nueva justo antes de la línea `// ── Actions ───...`)

**Interfaces:**
- Consumes: líneas `{page:number, y:number, items:[{x:number,str:string}], text:string}` ordenadas por página y por altura descendente (`text` = piezas recortadas unidas con un espacio).
- Produces:
  - `parseDavibank(lines) → {bank:"davibank", label:"Davibank", period:{from,to}|null, declaredTotal:number|null, rows:[Row]}` con `Row = {section:"pago"|"periodo"|"otros"|"anterior"|"interes", date:"YYYY-MM-DD", ref:string, desc:string, amount:number, cuotaN:number, cuotaOf:number}`.
  - `detectBank(lines) → {id, label, parse}|null`.
  - `impAmount(str) → number`, `impPeriod(text) → {from,to}|null`, `MESES_CORTOS`.

- [ ] **Step 1: Crear las líneas sintéticas `tests/davibank_lines.js`**

Misma forma que el extracto real (posiciones x de las columnas, descripción partida en dos líneas, encabezado de tarjeta, pago alterno, avance a 36 cuotas), con comercios y montos inventados.

```js
// Extracto Davibank inventado con la misma forma que el real (para pruebas sin PDF).
const TX=(p,y,date,ref,desc,v,cuotas,pago,saldo)=>T.L(p,y,[[42,date]].concat(ref?[[108,ref]]:[],[[150,desc],[284,v],[347,cuotas],[394,pago],[474,saldo],[524,"2,09%"],[554,"28,25%"]]));
window.DAVI_LINES=[
  T.L(1,761,[[436,"Contrato No:"],[495,"0000"]]),
  T.L(1,756,[[17,"Extracto de tu tarjeta de crédito"]]),
  T.L(1,736,[[524,"Período facturado"]]),
  T.L(1,724,[[482,"19 sep. 2026 al 16 oct. 2026"]]),
  T.L(1,428,[[35,"+ Cuota transacciones periodo"],[242,"$ 100.000"],[335,"+ Valor transacciones del periodo"],[537,"$ 1.206.850"]]),
  T.L(1,403,[[35,"+ Intereses corrientes"],[256,"$ 1.234"],[335,"+ Intereses corrientes"],[551,"$ 1.234"]]),
  T.L(1,332,[[35,"+ Otros cargos"],[335,"+ Otros cargos"]]),
  T.L(1,21,[[20,"Davibank pertenece a Davivienda Group S.A."],[400,"Página 1 de 4"]]),
  T.L(2,730,[[60,"Tus pagos y abonos"]]),
  T.L(2,706,[[50,"Fecha"],[375,"A intereses"],[450,"A intereses"],[535,"Total"]]),
  T.L(2,679,[[42,"22/09/2026"],[90,"PAGO PSE"],[224,"$ 93.000"],[300,"$ 0"],[378,"$ 0"],[462,"$ 0"],[528,"$ 93.000"]]),
  T.L(2,613,[[446,"*Conoce más de estas tasas, en la última página."]]),
  T.L(2,610,[[60,"Transacciones del periodo facturado"]]),
  T.L(2,586,[[50,"Fecha"],[90,"No."],[288,"Valor"],[397,"Pago a"],[470,"Saldo"],[540,"Tasa*"]]),
  T.L(2,577,[[38,"(DD/MM/AAAA)"],[90,"Comprobante"],[150,"Descripción"],[279,"transacción"],[341,"Cuotas"],[397,"capital"],[463,"pendiente"],[526,"M.V."],[559,"E.A."]]),
  T.L(2,559,[[150,"0000 TITULAR PRUEBA"]]),
  TX(2,544,"13/10/2026","111111","CINE PRUEBA","$ 60.000","1/1","$ 60.000","$ 0"),
  TX(2,529,"12/10/2026","222222","FARMACIA DEL","$ 6.850","1/1","$ 6.850","$ 0"),
  T.L(2,521,[[150,"CENTRO"]]),
  TX(2,514,"07/10/2026","","KTAL PAGO ALTERNO","$ 1.000.000","1/36","$ 28.170","$ 971.830"),
  TX(2,499,"05/10/2026","333333","TIENDA CUOTAS","$ 120.000","1/3","$ 40.000","$ 80.000"),
  T.L(2,21,[[20,"Davibank pertenece a Davivienda Group S.A."],[400,"Página 2 de 4"]]),
  T.L(3,733,[[446,"*Conoce más de estas tasas, en la última página."]]),
  T.L(3,730,[[60,"Transacciones del periodo facturado"]]),
  TX(3,679,"20/09/2026","444444","JUMBO PRUEBA","$ 8.000","1/1","$ 8.000","$ 0"),
  T.L(3,400,[[60,"Otros cargos"]]),
  T.L(3,373,[[80,"Fecha (DD/MM/AAAA)"],[286,"Descripción"],[463,"Valor transacción"]]),
  T.L(3,354,[[102,"16/10/2026"],[243,"SEGURO DE VIDA OBLIGATORIO"],[479,"$ 5.490"]]),
  T.L(3,315,[[60,"Transacciones de periodos anteriores"]]),
  T.L(3,264,[[150,"0000 TITULAR PRUEBA"]]),
  TX(3,249,"18/09/2026","555555","DIDI","$ 12.000","1/1","$ 12.000","$ 0"),
  TX(3,234,"05/09/2026","000000","AVANCE CAJERO","$ 450.000","1/36","$ 3.323","$ 116.306"),
  T.L(3,21,[[20,"Davibank pertenece a Davivienda Group S.A."],[400,"Página 3 de 4"]]),
  T.L(4,730,[[53,"Para pagar tu tarjeta usa alguno de estos canales"]]),
  T.L(4,49,[[25,"Número de tarjeta"],[170,"0000000000000000"]])
];
```

Cuadre de las líneas inventadas: periodo 60.000 + 6.850 + 1.000.000 + 120.000 + 8.000 = 1.194.850; anterior a 1 cuota 12.000; total 1.206.850 = "Valor transacciones del periodo".

- [ ] **Step 2: Escribir la prueba `tests/import_parse.js`**

```js
TEST(async()=>{
  T.ok("detecta Davibank",detectBank(DAVI_LINES)&&detectBank(DAVI_LINES).id==="davibank");
  T.eq("no detecta otro banco",detectBank([T.L(1,700,[[30,"Extracto de cuenta de ahorros"]])]),null);
  T.eq("montos",[impAmount("$ 1.014.129"),impAmount("$ 0"),impAmount("-$ 5.000"),impAmount("$ 1.234,50")],[1014129,0,-5000,1235]);
  T.eq("periodo",impPeriod("19 sep. 2026 al 16 oct. 2026"),{from:"2026-09-19",to:"2026-10-16"});
  T.eq("periodo que cruza el año",impPeriod("20 dic. 2026 al 18 ene. 2027"),{from:"2026-12-20",to:"2027-01-18"});
  const p=parseDavibank(DAVI_LINES);
  T.eq("periodo leído",p.period,{from:"2026-09-19",to:"2026-10-16"});
  T.eq("total declarado",p.declaredTotal,1206850);
  const cnt={};p.rows.forEach(r=>{cnt[r.section]=(cnt[r.section]||0)+1;});
  T.eq("filas por sección",cnt,{pago:1,periodo:5,otros:1,anterior:2,interes:1});
  T.eq("pago toma el total",p.rows.find(r=>r.section==="pago"),{section:"pago",date:"2026-09-22",ref:"",desc:"PAGO PSE",amount:93000,cuotaN:1,cuotaOf:1});
  T.eq("compra normal",p.rows.find(r=>r.ref==="111111"),{section:"periodo",date:"2026-10-13",ref:"111111",desc:"CINE PRUEBA",amount:60000,cuotaN:1,cuotaOf:1});
  T.eq("descripción en dos líneas",p.rows.find(r=>r.ref==="222222").desc,"FARMACIA DEL CENTRO");
  T.eq("pago alterno sin comprobante",p.rows.find(r=>/KTAL/.test(r.desc)),{section:"periodo",date:"2026-10-07",ref:"",desc:"KTAL PAGO ALTERNO",amount:1000000,cuotaN:1,cuotaOf:36});
  T.eq("compra a cuotas con valor completo",p.rows.find(r=>r.ref==="333333").amount,120000);
  T.eq("compra en la página siguiente",p.rows.find(r=>r.ref==="444444").section,"periodo");
  T.eq("otros cargos",p.rows.find(r=>r.section==="otros"),{section:"otros",date:"2026-10-16",ref:"",desc:"SEGURO DE VIDA OBLIGATORIO",amount:5490,cuotaN:1,cuotaOf:1});
  T.eq("anteriores",p.rows.filter(r=>r.section==="anterior").map(r=>[r.desc,r.cuotaOf]),[["DIDI",1],["AVANCE CAJERO",36]]);
  T.eq("intereses al cierre",p.rows.find(r=>r.section==="interes"),{section:"interes",date:"2026-10-16",ref:"INT",desc:"Intereses corrientes",amount:1234,cuotaN:1,cuotaOf:1});
  T.ok("ignora encabezado de tarjeta",!p.rows.some(r=>/TITULAR/.test(r.desc)));
});
```

- [ ] **Step 3: Correr la prueba y ver que falla**

Run: `python tests/run.py tests/davibank_lines.js tests/import_parse.js`
Expected: FAIL `la prueba no se cayó -> ReferenceError: detectBank is not defined`.

- [ ] **Step 4: Implementar en `index.html`**

Insertar justo antes de la línea `// ── Actions ────────────────────────────────────────────────────────────────`:

```js
// ═══ IMPORTAR EXTRACTOS ═════════════════════════════════════════════════════
// Lectores puros: reciben líneas {page,y,items:[{x,str}],text} (ver pdfToLines) y devuelven filas.
const MESES_CORTOS={ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12};
const IMP_MONEY="-?\\$ ?-?[\\d.,]+";
function impAmount(s){
  const str=String(s||"");const neg=str.indexOf("-")>=0;
  const n=Math.round(Number(str.replace(/[^\d,]/g,"").replace(",",".")))||0;
  return neg?-n:n;
}
function impDate(dd,mm,yyyy){return yyyy+"-"+mm+"-"+dd;}
function impPeriod(text){
  const m=String(text).match(/(\d{1,2}) (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.? (\d{4}) al (\d{1,2}) (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.? (\d{4})/i);
  if(!m)return null;
  const f=(d,mo,y)=>y+"-"+String(MESES_CORTOS[mo.toLowerCase()]).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  return{from:f(m[1],m[2],m[3]),to:f(m[4],m[5],m[6])};
}
const DAVI_SECTIONS=[["Tus pagos y abonos","pago"],["Transacciones del periodo facturado","periodo"],["Otros cargos","otros"],["Transacciones de periodos anteriores","anterior"],["Para pagar tu tarjeta usa alguno de estos canales",null]];
const DAVI_TX=new RegExp("^(\\d{2})/(\\d{2})/(\\d{4}) (?:(\\d{4,8}) )?(.+?) ("+IMP_MONEY+") (\\d+)/(\\d+) "+IMP_MONEY+" "+IMP_MONEY+"(?: [\\d,]+% [\\d,]+%)?$");
const DAVI_PAGO=new RegExp("^(\\d{2})/(\\d{2})/(\\d{4}) (.+?)((?: "+IMP_MONEY+"){2,})$");
const DAVI_OTRO=new RegExp("^(\\d{2})/(\\d{2})/(\\d{4}) (.+?) ("+IMP_MONEY+")$");
function parseDavibank(lines){
  const out={bank:"davibank",label:"Davibank",period:null,declaredTotal:null,rows:[]};
  let sec=null,prev=null,interes=0;
  lines.forEach(l=>{
    const t=l.text;
    if(!out.period&&t.indexOf(" al ")>=0){const p=impPeriod(t);if(p)out.period=p;}
    let m=t.match(new RegExp("Valor transacciones del periodo ("+IMP_MONEY+")"));
    if(m&&out.declaredTotal===null)out.declaredTotal=impAmount(m[1]);
    m=t.match(new RegExp("^\\+ Intereses corrientes .*?("+IMP_MONEY+")$"));
    if(m)interes=impAmount(m[1]);
    const h=DAVI_SECTIONS.find(s=>t===s[0]||t.indexOf(s[0]+" ")===0);
    if(h){sec=h[1];prev=null;return;}
    if(!sec)return;
    if(sec==="pago"){
      m=t.match(DAVI_PAGO);
      if(m){const a=m[5].match(new RegExp(IMP_MONEY,"g"));out.rows.push({section:"pago",date:impDate(m[1],m[2],m[3]),ref:"",desc:m[4].trim(),amount:impAmount(a[a.length-1]),cuotaN:1,cuotaOf:1});}
      prev=null;return;
    }
    if(sec==="otros"){
      m=t.match(DAVI_OTRO);
      if(m)out.rows.push({section:"otros",date:impDate(m[1],m[2],m[3]),ref:"",desc:m[4].trim(),amount:impAmount(m[5]),cuotaN:1,cuotaOf:1});
      prev=null;return;
    }
    m=t.match(DAVI_TX);
    if(m){
      const row={section:sec,date:impDate(m[1],m[2],m[3]),ref:m[4]||"",desc:m[5].trim(),amount:impAmount(m[6]),cuotaN:Number(m[7]),cuotaOf:Number(m[8])};
      const di=l.items.find(i=>{const s=i.str.trim();return s&&!/^\d{2}\/\d{2}\/\d{4}$/.test(s)&&s!==row.ref;});
      out.rows.push(row);prev={row,page:l.page,y:l.y,x:di?di.x:null};return;
    }
    // Descripción partida: una sola pieza, justo debajo de la fila y alineada con su descripción.
    const parts=l.items.filter(i=>i.str.trim());
    const gap=prev?prev.y-l.y:99;
    if(prev&&parts.length===1&&l.page===prev.page&&gap>0&&gap<=11&&prev.x!==null&&Math.abs(parts[0].x-prev.x)<=4&&t.indexOf("$")<0){
      prev.row.desc+=" "+t;prev.y=l.y;return;
    }
    prev=null;
  });
  if(interes>0)out.rows.push({section:"interes",date:out.period?out.period.to:"",ref:"INT",desc:"Intereses corrientes",amount:interes,cuotaN:1,cuotaOf:1});
  return out;
}
const IMPORT_BANKS=[
  {id:"davibank",label:"Davibank",parse:parseDavibank,
   test:lines=>lines.some(l=>/Extracto de tu tarjeta de cr.dito/i.test(l.text))&&lines.some(l=>/davibank/i.test(l.text))}
];
function detectBank(lines){return IMPORT_BANKS.find(b=>b.test(lines))||null;}
// ═══ FIN IMPORTAR EXTRACTOS ═════════════════════════════════════════════════

```

- [ ] **Step 5: Correr las pruebas**

Run: `python tests/check_syntax.py`
Expected: sin error.

Run: `python tests/run.py tests/davibank_lines.js tests/import_parse.js`
Expected: `18 pasan, 0 fallan`.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/davibank_lines.js tests/import_parse.js
git commit -m "Feat: lector del extracto Davibank (texto a filas)"
```

---

### Task 3: Clasificación (descartes, duplicados, categorías, control)

**Files:**
- Create: `tests/import_logic.js`
- Modify: `index.html` (`emptyState()`, `migrate()` y la sección IMPORTAR EXTRACTOS antes de `FIN`)

**Interfaces:**
- Consumes: `parseDavibank` (Task 2).
- Produces:
  - `merchantKey(desc) → string` (mayúsculas, sin tildes, solo A–Z y espacios).
  - `importKey(bank,row) → "banco|fecha|ref-o-comercio|valor"`.
  - `findDuplicate(row,d) → entry|null` (gasto con mismo valor y fecha ±3 días).
  - `catListFor(d,dec) → string[]` (`dec`: `"shared"` usa `d.cats.shared`; `"B"` usa `d.cats.personal`).
  - `suggestCategory(desc,dec,d) → string`.
  - `classifyImport(parsed,d) → {cards:[Card], discarded:[Card & {reason}], control:{declared, computed, diff}}` con `Card = Row & {key, merchant, dup}`, tarjetas ordenadas por fecha ascendente (estable).
  - `d.importRules` (`{}` por defecto) y `d.importSkipped` (`[]` por defecto) en `emptyState()`/`migrate()`.

- [ ] **Step 1: Escribir la prueba `tests/import_logic.js`**

```js
TEST(async()=>{
  const cats=emptyState().cats;
  T.eq("comercio normalizado",[merchantKey("DLO*DIDI"),merchantKey("LA PANADERIA 12"),merchantKey("Pastelería  Ñapa")],["DLO DIDI","LA PANADERIA","PASTELERIA NAPA"]);
  T.eq("huella con comprobante",importKey("davibank",{date:"2026-10-13",ref:"123456",desc:"X",amount:60000}),"davibank|2026-10-13|123456|60000");
  T.eq("huella sin comprobante",importKey("davibank",{date:"2026-10-16",ref:"",desc:"SEGURO DE VIDA",amount:5490}),"davibank|2026-10-16|SEGURO DE VIDA|5490");
  // categorías
  const d0={cats,importRules:{}};
  T.eq("mercado compartido",suggestCategory("JUMBO PRUEBA","shared",d0),"Mercado");
  T.eq("mercado mío",suggestCategory("JUMBO PRUEBA","B",d0),"Otro personal");
  T.eq("D1",suggestCategory("TIENDA D1 BARRIO","shared",d0),"Mercado");
  T.eq("mercadolibre no es mercado",suggestCategory("MERPAGO*MERCADOLIBRE","shared",d0),"Otro compartido");
  T.eq("transporte",suggestCategory("DLO*DIDI","B",d0),"Transporte");
  T.eq("comida a domicilio no es transporte",suggestCategory("DIDI CO FOOD","B",d0),"Otro personal");
  T.eq("farmacia",suggestCategory("FARMATODO SUCURSAL","B",d0),"Salud");
  T.eq("cine",suggestCategory("MULTIPLEX CENTRO","B",d0),"Entretenimiento");
  T.eq("cargo del banco",suggestCategory("SEGURO DE VIDA OBLIGATORIO","shared",d0),"Deuda banco");
  const d1={cats,importRules:{"CINE PRUEBA":{decision:"B",category:"Ropa"},"DIDI":{decision:"B",category:"No existe"}}};
  T.eq("usa la última decisión",suggestCategory("CINE PRUEBA","B",d1),"Ropa");
  T.eq("regla de otra decisión no aplica",suggestCategory("CINE PRUEBA","shared",d1),"Otro compartido");
  T.eq("regla con categoría borrada",suggestCategory("DIDI","B",d1),"Transporte");
  // duplicados
  const dd={entries:[{type:"expense",amount:8000,date:"2026-09-22",description:"Mercado tienda"},{type:"income",amount:12000,date:"2026-09-18"}]};
  T.eq("duplicado a 2 días",(findDuplicate({amount:8000,date:"2026-09-20"},dd)||{}).description,"Mercado tienda");
  T.eq("a 4 días no",findDuplicate({amount:8000,date:"2026-09-26"},dd),null);
  T.eq("solo gastos",findDuplicate({amount:12000,date:"2026-09-18"},dd),null);
  // clasificación completa
  const p=parseDavibank(DAVI_LINES);
  const r=classifyImport(p,{cats,entries:[]});
  T.eq("control",r.control,{declared:1206850,computed:1206850,diff:0});
  T.eq("descartes",r.discarded.map(x=>[x.desc,x.reason]),[
    ["PAGO PSE","Pago o abono a la tarjeta"],
    ["KTAL PAGO ALTERNO","Traslado del pago mínimo alterno (no es una compra)"],
    ["AVANCE CAJERO","Compra a cuotas de un periodo anterior (ya facturada)"]]);
  T.eq("tarjetas por fecha",r.cards.map(c=>c.desc),["DIDI","JUMBO PRUEBA","TIENDA CUOTAS","FARMACIA DEL CENTRO","CINE PRUEBA","SEGURO DE VIDA OBLIGATORIO","Intereses corrientes"]);
  T.eq("tarjeta lleva huella y comercio",[r.cards[0].key,r.cards[0].merchant,r.cards[0].dup],["davibank|2026-09-18|555555|12000","DIDI",null]);
  const r2=classifyImport(p,{cats,entries:[{type:"expense",amount:60000,date:"2026-10-13",importKey:"davibank|2026-10-13|111111|60000"},{type:"expense",amount:8000,date:"2026-09-22",description:"Mercado tienda"}],importSkipped:["davibank|2026-10-12|222222|6850"]});
  T.eq("ya importada",r2.discarded.filter(x=>x.reason==="Ya importada antes").map(x=>x.desc),["CINE PRUEBA"]);
  T.eq("ya marcada no registrar",r2.discarded.filter(x=>x.reason==="Ya la marcaste como no registrar").map(x=>x.desc),["FARMACIA DEL CENTRO"]);
  T.eq("marca posible duplicado",(r2.cards.find(c=>c.desc==="JUMBO PRUEBA").dup||{}).description,"Mercado tienda");
  const rep=classifyImport({bank:"davibank",period:null,declaredTotal:null,rows:[{section:"periodo",date:"2026-10-01",ref:"",desc:"X",amount:100,cuotaN:1,cuotaOf:1},{section:"periodo",date:"2026-10-01",ref:"",desc:"X",amount:100,cuotaN:1,cuotaOf:1},{section:"periodo",date:"2026-10-02",ref:"9999",desc:"REVERSO",amount:-100,cuotaN:1,cuotaOf:1}]},{cats,entries:[]});
  T.eq("filas idénticas no se pisan",rep.cards.map(c=>c.key),["davibank|2026-10-01|X|100","davibank|2026-10-01|X|100#2"]);
  T.eq("negativos se descartan",rep.discarded.map(x=>x.reason),["Valor negativo o en cero (reverso o ajuste)"]);
  T.eq("sin total declarado",rep.control,{declared:null,computed:100,diff:null});
  // estado por defecto
  T.eq("estado vacío",[emptyState().importRules,emptyState().importSkipped],[{},[]]);
  T.eq("migrate completa",[migrate({}).importRules,migrate({}).importSkipped],[{},[]]);
});
```

Nota: el control cuenta las filas del periodo con su valor (también el reverso negativo) más las anteriores a 1 cuota. En `rep` la suma es 100 + 100 − 100 = 100.

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `python tests/run.py tests/davibank_lines.js tests/import_logic.js`
Expected: FAIL con `ReferenceError: merchantKey is not defined`.

- [ ] **Step 3: Agregar `importRules` e `importSkipped` al estado**

En `emptyState()`, cambiar `terceros:[],wishlist:[],juntos:{saldoInicial:0},` por:

```js
    terceros:[],wishlist:[],juntos:{saldoInicial:0},importRules:{},importSkipped:[],
```

En `migrate(d)`, cambiar la lista de llaves para que termine en `"juntos","importRules","importSkipped"]`:

```js
  ["names","cats","goals","split","settled","recurring","budgets","loans","entries","balances","viajes","catSettled","trash","plan","terceros","wishlist","juntos","importRules","importSkipped"].forEach(k=>{if(!d[k])d[k]=e[k];});
```

- [ ] **Step 4: Implementar la clasificación (antes de `// ═══ FIN IMPORTAR EXTRACTOS`)**

```js
function impUpper(desc){return String(desc||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function merchantKey(desc){return impUpper(desc).replace(/[^A-Z ]/g," ").replace(/\s+/g," ").trim();}
function importKey(bank,row){return [bank,row.date,row.ref||merchantKey(row.desc),row.amount].join("|");}
function daysApart(a,b){return Math.abs(Date.parse(a)-Date.parse(b))/864e5;}
function findDuplicate(row,d){
  return (d.entries||[]).find(e=>e.type==="expense"&&Number(e.amount)===row.amount&&e.date&&daysApart(e.date,row.date)<=3)||null;
}
// [patrón sobre el texto en mayúsculas, categoría si es compartido, categoría si es mío]
const IMPORT_KEYWORDS=[
  [/\b(JUMBO|EXITO|CARULLA|OLIMPICA|D1|ARA|ISIMO|VAQUITA|SUPERMERCAD\w*|MERCADO|MAKRO|PRICESMART|ALKOSTO)\b/,"Mercado","Otro personal"],
  [/\b(FARMA\w*|DROG\w*|CRUZ VERDE|LOCATEL)\b/,"Otro compartido","Salud"],
  [/\b(EDS|TERPEL|PRIMAX|BIOMAX|UBER|CABIFY|PEAJE\w*|PARQUEADERO|PARKING)\b|^(DLO\W*)?DIDI$/,"Otro compartido","Transporte"],
  [/\b(MULTIPLEX|CINE\w*|PROCINAL|NETFLIX|SPOTIFY|HBO\w*|HELPHBOMAXCOM|DISNEY|STEAM|PLAYSTATION|XBOX|MICROSOFT\w*|ENTRETENIMIENTO)\b/,"Otro compartido","Entretenimiento"],
  [/\b(EPM|CLARO|MOVISTAR|TIGO|UNE|ETB|INTERNET)\b/,"Servicios","Otro personal"],
  [/\b(SEGURO|INTERESES|CUOTA DE MANEJO)\b/,"Deuda banco","Deuda personal"]
];
function catListFor(d,dec){const c=d.cats||{};return dec==="shared"?(c.shared||[]):(c.personal||[]);}
function suggestCategory(desc,dec,d){
  const list=catListFor(d,dec);
  const rule=(d.importRules||{})[merchantKey(desc)];
  if(rule&&rule.decision===dec&&list.indexOf(rule.category)>=0)return rule.category;
  const up=impUpper(desc);
  for(const [re,sh,pe] of IMPORT_KEYWORDS){
    if(re.test(up)){const c=dec==="shared"?sh:pe;if(list.indexOf(c)>=0)return c;break;}
  }
  return list.find(c=>/^Otro/i.test(c))||list[0]||"";
}
function classifyImport(parsed,d){
  const done=new Set((d.entries||[]).map(e=>e.importKey).filter(Boolean));
  const skipped=new Set(d.importSkipped||[]);
  const seen={},cards=[],discarded=[];
  let computed=0;
  parsed.rows.forEach(r=>{
    if(r.section==="periodo"||(r.section==="anterior"&&r.cuotaOf===1))computed+=r.amount;
    let key=importKey(parsed.bank,r);
    seen[key]=(seen[key]||0)+1;
    if(seen[key]>1)key+="#"+seen[key];
    const item={...r,key,merchant:merchantKey(r.desc)};
    let reason="";
    if(r.section==="pago")reason="Pago o abono a la tarjeta";
    else if(/^KTAL PAGO ALTERNO/i.test(r.desc))reason="Traslado del pago mínimo alterno (no es una compra)";
    else if(r.section==="anterior"&&r.cuotaOf>1)reason="Compra a cuotas de un periodo anterior (ya facturada)";
    else if(r.amount<=0)reason="Valor negativo o en cero (reverso o ajuste)";
    else if(done.has(key))reason="Ya importada antes";
    else if(skipped.has(key))reason="Ya la marcaste como no registrar";
    if(reason)discarded.push({...item,reason});
    else cards.push({...item,dup:findDuplicate(r,d)});
  });
  cards.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  const declared=parsed.declaredTotal;
  return{cards,discarded,control:{declared,computed,diff:declared===null?null:declared-computed}};
}
```

- [ ] **Step 5: Correr las pruebas**

Run: `python tests/check_syntax.py`
Expected: sin error.

Run: `python tests/run.py tests/davibank_lines.js tests/import_logic.js`
Expected: `30 pasan, 0 fallan`.

Run: `python tests/run.py tests/davibank_lines.js tests/import_parse.js`
Expected: `18 pasan, 0 fallan`.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/import_logic.js
git commit -m "Feat: clasifica las filas del extracto (descartes, duplicados, categorías)"
```

---

### Task 4: Leer el PDF con pdf.js

**Files:**
- Create: `tests/import_pdf.js`
- Create: `tests/import_cdn.js`
- Modify: `index.html` (sección IMPORTAR EXTRACTOS antes de `FIN`)

**Interfaces:**
- Consumes: `detectBank`, `parseDavibank`, `classifyImport`.
- Produces:
  - `loadPdfJs() → Promise<pdfjsLib>`. Si `window.pdfjsLib` ya existe (pruebas), lo devuelve tal cual. Si falla, la promesa se rechaza con `Error("PDFJS_LOAD")`.
  - `pdfToLines(file, password?) → Promise<Line[]>`. Con contraseña faltante o incorrecta, rechaza con el `PasswordException` de pdf.js (`name==="PasswordException"`; `code` 1 = falta, 2 = incorrecta).

- [ ] **Step 1: Escribir la prueba con el extracto real `tests/import_pdf.js`**

Usa el PDF y las cifras esperadas de `Pagos Casa/Extractos/` (ignorados por git; no copiar sus valores a archivos versionados).

```js
TEST(async()=>{
  const E=window.__expected;
  const lines=await pdfToLines(T.pdfFile());
  T.ok("devuelve líneas con texto",lines.length>50&&typeof lines[0].text==="string");
  T.ok("ordenadas por página y altura",lines.every((l,i)=>i===0||l.page>lines[i-1].page||(l.page===lines[i-1].page&&l.y<=lines[i-1].y)));
  const bank=detectBank(lines);
  T.ok("detecta Davibank",!!bank&&bank.id==="davibank");
  const p=bank.parse(lines);
  T.eq("periodo",p.period,E.period);
  T.eq("total declarado",p.declaredTotal,E.declaredTotal);
  const cnt={};p.rows.forEach(r=>{cnt[r.section]=(cnt[r.section]||0)+1;});
  T.eq("filas por sección",cnt,E.rows);
  const per=p.rows.filter(r=>r.section==="periodo");
  const pick=r=>({date:r.date,ref:r.ref,desc:r.desc,amount:r.amount});
  T.eq("primera fila",pick(per[0]),E.first);
  T.eq("última fila",pick(per[per.length-1]),E.last);
  T.eq("descripciones en dos líneas",per.filter(r=>r.desc===E.merged[0]).length,E.merged[1]);
  T.ok("sin líneas sueltas como compras",!p.rows.some(r=>/^\d{4} /.test(r.desc)||r.desc.length<3));
  const res=classifyImport(p,{entries:[],cats:emptyState().cats});
  T.eq("control cuadra",res.control.diff,0);
  T.eq("tarjetas",res.cards.length,E.cards);
  T.eq("suma de tarjetas",res.cards.reduce((s,c)=>s+c.amount,0),E.cardsTotal);
  T.eq("descartadas",res.discarded.length,E.discarded);
});
```

- [ ] **Step 2: Escribir la prueba de carga real desde cdnjs `tests/import_cdn.js`**

```js
TEST(async()=>{
  T.ok("sin pdf.js precargado",!window.pdfjsLib);
  const lib=await loadPdfJs();
  T.ok("carga pdf.js desde cdnjs",!!lib&&typeof lib.getDocument==="function");
  T.ok("worker verificado como blob",String(lib.GlobalWorkerOptions.workerSrc).indexOf("blob:")===0);
  T.ok("una sola carga",(await loadPdfJs())===lib);
  const lines=await pdfToLines(T.pdfFile());
  T.ok("lee el PDF con el worker real",lines.length>50&&!!detectBank(lines));
});
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `python tests/run.py --pdf "Pagos Casa/Extractos/Davibank-2026-10.pdf" --expected "Pagos Casa/Extractos/Davibank-2026-10.expected.json" tests/import_pdf.js`
Expected: FAIL con `ReferenceError: pdfToLines is not defined`.

- [ ] **Step 4: Implementar (antes de `// ═══ FIN IMPORTAR EXTRACTOS`)**

```js
// pdf.js se carga solo al abrir un PDF. El worker se descarga con verificación de integridad y se sirve como blob.
const PDFJS_BASE="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const PDFJS_SRI={
  lib:"sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==",
  worker:"sha512-BbrZ76UNZq5BhH7LL7pn9A4TKQpQeNCHOo65/akfelcIBbcVvYWOFQKPXIrykE3qZxYjmDX573oa4Ywsc7rpTw=="
};
let pdfjsPromise=null;
function loadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(pdfjsPromise)return pdfjsPromise;
  pdfjsPromise=(async()=>{
    await new Promise((ok,ko)=>{
      const s=document.createElement("script");
      s.src=PDFJS_BASE+"pdf.min.js";s.integrity=PDFJS_SRI.lib;s.crossOrigin="anonymous";
      s.onload=ok;s.onerror=()=>ko(new Error("PDFJS_LOAD"));
      document.head.appendChild(s);
    });
    const r=await fetch(PDFJS_BASE+"pdf.worker.min.js",{integrity:PDFJS_SRI.worker});
    if(!r.ok)throw new Error("PDFJS_LOAD");
    const url=URL.createObjectURL(new Blob([await r.text()],{type:"text/javascript"}));
    window.pdfjsLib.GlobalWorkerOptions.workerSrc=url;
    return window.pdfjsLib;
  })().catch(()=>{pdfjsPromise=null;throw new Error("PDFJS_LOAD");});
  return pdfjsPromise;
}
// Texto del PDF agrupado en líneas: piezas a ±2 puntos de altura forman una línea, de izquierda a derecha.
async function pdfToLines(file,password){
  const lib=await loadPdfJs();
  const data=new Uint8Array(await file.arrayBuffer());
  const doc=await lib.getDocument({data,password:password||undefined}).promise;
  const lines=[];
  for(let p=1;p<=doc.numPages;p++){
    const tc=await (await doc.getPage(p)).getTextContent();
    const pg=[];
    tc.items.forEach(it=>{
      const str=it.str||"";if(!str.trim())return;
      const x=it.transform[4],y=it.transform[5];
      let ln=pg.find(l=>Math.abs(l.y-y)<=2);
      if(!ln){ln={page:p,y,items:[]};pg.push(ln);}
      ln.items.push({x,str});
    });
    pg.sort((a,b)=>b.y-a.y);
    pg.forEach(l=>{l.items.sort((a,b)=>a.x-b.x);l.text=l.items.map(i=>i.str.trim()).filter(Boolean).join(" ");lines.push(l);});
  }
  try{doc.destroy();}catch(e){}
  return lines;
}
```

- [ ] **Step 5: Correr las pruebas**

Run: `python tests/check_syntax.py`
Expected: sin error.

Run: `python tests/run.py --pdf "Pagos Casa/Extractos/Davibank-2026-10.pdf" --expected "Pagos Casa/Extractos/Davibank-2026-10.expected.json" tests/import_pdf.js`
Expected: `14 pasan, 0 fallan`.

Run: `python tests/run.py --serve --pdf "Pagos Casa/Extractos/Davibank-2026-10.pdf" tests/import_cdn.js`
Expected: `5 pasan, 0 fallan` (necesita internet; tarda hasta 90 s).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/import_pdf.js tests/import_cdn.js
git commit -m "Feat: lee el PDF en el navegador con pdf.js verificado"
```

---

### Task 5: Pantallas del importador (archivo, contraseña, errores, rango)

**Files:**
- Create: `tests/import_helpers.js`
- Create: `tests/import_screens.js`
- Create: `tests/make_locked_pdf.py`
- Create: `tests/import_password.js`
- Modify: `index.html` (`renderAgregar()`, CSS antes de `</style>`, sección IMPORTAR EXTRACTOS antes de `FIN`)

**Interfaces:**
- Consumes: `pdfToLines`, `detectBank`, `classifyImport`, `catListFor`, `suggestCategory`, `MESES_CORTOS`, `escH`, `fmt`, `render`, `showToast`, `D`, `today`.
- Produces (usado por Tasks 6 y 7):
  - Estado `imp` (`null` = cerrado) con `{step:"pick"|"loading"|"password"|"range"|"deck"|"summary", err, parsed, res, from, to, showDisc, deck:[Card], idx, dec:{[key]:"shared"|"B"|"skip"}, hist:[índice], cat:{[key]:categoría}}`, y `impFile` (File en memoria).
  - `openImport()`, `closeImport(force)`, `onImportFile(input)`, `readImport(password?)`, `submitImportPassword()`, `importParsed(parsed)`, `impInRange()`, `setImportRange(k,v)`, `toggleImportDisc()`, `impHead(title)`, `impDateLabel(iso)`, `impPeriodLabel(period)`, `renderImport()`, `renderImportRange(d)`.
  - `renderImport()` delega en `renderSwipe(d)` (Task 6) y `renderImportSummary(d)` (Task 7). Mientras no existan, esta tarea las define como stubs que Task 6 y Task 7 reemplazan.
  - `startDeck()` (Task 5 lo define; Task 6 lo usa).
  - IDs del DOM: `imp-open`, `imp-file`, `imp-err`, `imp-loading`, `imp-pw`, `imp-ctl`, `imp-from`, `imp-to`, `imp-start`, `imp-disc-btn`, `imp-disc`.

- [ ] **Step 1: Crear `tests/import_helpers.js`**

```js
// Lleva el importador hasta la pantalla de rango usando las líneas sintéticas (sin PDF).
async function toRange(lines){
  setTab("agregar");openImport();
  const real=pdfToLines;pdfToLines=async()=>lines||DAVI_LINES;
  impFile=new File([new Uint8Array([1])],"x.pdf");
  await readImport();
  pdfToLines=real;
}
```

- [ ] **Step 2: Escribir la prueba `tests/import_screens.js`**

```js
TEST(async()=>{
  setTab("agregar");
  T.ok("botón importar en Registrar",!!document.getElementById("imp-open"));
  openImport();
  T.ok("pantalla de archivo",!!document.getElementById("imp-file"));
  T.ok("acepta solo PDF",document.getElementById("imp-file").getAttribute("accept").indexOf("pdf")>=0);
  // sin internet
  const realL=loadPdfJs;loadPdfJs=()=>Promise.reject(new Error("PDFJS_LOAD"));
  impFile=new File([new Uint8Array([1])],"x.pdf");await readImport();
  loadPdfJs=realL;
  T.ok("sin internet: mensaje",document.getElementById("imp-err").textContent.indexOf("conexión")>=0);
  // PDF dañado
  const realP=pdfToLines;
  pdfToLines=async()=>{throw new Error("Invalid PDF structure");};await readImport();
  T.ok("PDF dañado: mensaje",document.getElementById("imp-err").textContent.indexOf("No pude abrir")>=0);
  // escaneado (sin texto)
  pdfToLines=async()=>[];await readImport();
  T.ok("escaneado: mensaje",document.getElementById("imp-err").textContent.indexOf("escaneado")>=0);
  // banco no reconocido
  pdfToLines=async()=>[T.L(1,700,[[30,"Banco X"]]),T.L(1,690,[[30,"Extracto de cuenta"]]),T.L(1,680,[[30,"Saldo"]])];await readImport();
  T.ok("banco no reconocido",document.getElementById("imp-err").textContent.indexOf("No reconozco")>=0);
  pdfToLines=realP;
  // rango con el extracto sintético y la fixture (CINE ya importada, FARMACIA marcada no registrar)
  await toRange();
  T.eq("paso rango",imp.step,"range");
  T.ok("control cuadra",document.getElementById("imp-ctl").textContent.indexOf("cuadra")>=0);
  T.eq("rango por defecto cubre todas las tarjetas",[imp.from,imp.to],["2026-09-18","2026-10-16"]);
  T.eq("tarjetas",imp.res.cards.map(c=>c.desc),["DIDI","JUMBO PRUEBA","TIENDA CUOTAS","SEGURO DE VIDA OBLIGATORIO","Intereses corrientes"]);
  T.ok("botón con el número",document.getElementById("imp-start").textContent.indexOf("5")>=0);
  T.ok("contador de descartes",document.getElementById("imp-disc-btn").textContent.indexOf("5 descartados")>=0);
  toggleImportDisc();
  T.ok("lista de descartes con motivo",document.getElementById("imp-disc").textContent.indexOf("Ya importada antes")>=0);
  setImportRange("from","2026-09-19");
  T.eq("rango filtra",impInRange().length,4);
  setImportRange("to","2026-09-01");
  T.ok("rango vacío deshabilita",document.getElementById("imp-start").disabled);
  setImportRange("from","2026-09-18");setImportRange("to","2026-10-16");
  // control que no cuadra
  const bad=DAVI_LINES.map(l=>l.text.indexOf("Valor transacciones")>=0?T.L(1,428,[[335,"+ Valor transacciones del periodo"],[537,"$ 1.300.000"]]):l);
  await toRange(bad);
  T.ok("control no cuadra: diferencia",document.getElementById("imp-ctl").textContent.indexOf("93.150")>=0);
  T.ok("puede seguir igual",!document.getElementById("imp-start").disabled);
  // texto del PDF escapado (fila descartada: se pinta en la lista de descartes)
  importParsed({bank:"davibank",label:"Davibank",period:null,declaredTotal:null,rows:[{section:"pago",date:"2026-10-01",ref:"",desc:"<img src=x onerror=alert(1)>",amount:1000,cuotaN:1,cuotaOf:1}]});
  T.ok("sin total: aviso",document.getElementById("imp-ctl").textContent.indexOf("No encontré el total")>=0);
  toggleImportDisc();
  T.ok("no inyecta HTML",!document.querySelector("#content img"));
  closeImport(true);
  T.ok("salir cierra",imp===null&&!!document.getElementById("imp-open"));
  T.eq("no guardó nada",__puts,0);
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `python tests/run.py tests/davibank_lines.js tests/import_helpers.js tests/import_screens.js`
Expected: FAIL `botón importar en Registrar`.

- [ ] **Step 4: Botón en Registrar**

En `renderAgregar()`, cambiar el inicio:

```js
function renderAgregar(){
  const d=D();
```

por:

```js
function renderAgregar(){
  if(imp)return renderImport();
  const d=D();
```

y cambiar la primera línea del HTML devuelto, `return`<div class="sec">`, por:

```js
  return`<div class="sec">
    ${editId?"":`<button class="btn btn-dark" id="imp-open" onclick="openImport()">📥 Importar extracto del banco</button>`}
```

(el resto de `renderAgregar` queda igual).

- [ ] **Step 5: CSS del importador**

Insertar justo antes de `</style>`:

```css
.imp-deck{position:relative;margin:6px 0 14px;padding:4px;overflow:hidden;}
.imp-card{position:relative;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;background:var(--card);border:2px solid var(--line);border-radius:18px;padding:18px;box-shadow:var(--card-shadow);transition:transform .16s ease,border-color .15s;}
.imp-card.drag{transition:none;cursor:grabbing;}
.imp-card.go-r{border-color:var(--good);} .imp-card.go-l{border-color:var(--pb);} .imp-card.go-u{border-color:var(--ink3);}
.imp-merchant{font-size:19px;font-weight:700;color:var(--ink);overflow-wrap:anywhere;margin-bottom:4px;}
.imp-amt{font-size:30px;font-weight:700;font-family:var(--num);color:var(--ink);margin:10px 0;}
.imp-acts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;}
.imp-acts .btn{margin:0;padding:12px 4px;font-size:14px;}
.imp-row{display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);}
.imp-row select{margin:0;padding:6px 8px;font-size:13px;width:auto;max-width:42%;}
.imp-row .d{flex:1;min-width:0;font-size:13px;color:var(--ink);overflow-wrap:anywhere;}
.imp-hint{font-size:12px;color:var(--ink2);margin-top:6px;}
.imp-warn{font-size:12px;color:var(--gold);margin-top:8px;}
.imp-tag{background:var(--inset);color:var(--ink2);margin:0 6px 6px 0;}
```

- [ ] **Step 6: Implementar las pantallas (antes de `// ═══ FIN IMPORTAR EXTRACTOS`)**

```js
// ── Interfaz del importador (vive en la pestaña Registrar; el sondeo de 30 s no la redibuja) ──
let imp=null;     // estado del importador; null = cerrado
let impFile=null; // PDF elegido, solo en memoria (para reintentar con contraseña)
const IMPORT_OWNER="B"; // los extractos son de John
const DEC_LABEL={shared:"Compartido",B:"Mío",skip:"No registrar"};
function impDateLabel(iso){if(!iso)return"";const p=iso.split("-");return Number(p[2])+" "+Object.keys(MESES_CORTOS)[Number(p[1])-1]+" "+p[0];}
function impPeriodLabel(per){return per?impDateLabel(per.from)+"–"+impDateLabel(per.to):"";}
function impHead(title){return`<div class="row" style="margin-bottom:12px;"><div class="ct" style="margin:0;">${title}</div><button class="btn-sm btn-dark" onclick="closeImport()">✕ Salir</button></div>`;}
function openImport(){imp={step:"pick",err:""};impFile=null;render();}
function closeImport(force){
  if(!force&&imp&&imp.dec&&Object.keys(imp.dec).length&&!confirm("¿Salir sin guardar? Se pierden las decisiones."))return;
  imp=null;impFile=null;render();
}
async function onImportFile(input){const f=input.files&&input.files[0];if(!f)return;impFile=f;await readImport();}
async function readImport(password){
  imp={step:"loading",err:""};render();
  let lines;
  try{lines=await pdfToLines(impFile,password);}
  catch(e){
    if(e&&e.name==="PasswordException")imp={step:"password",err:e.code===2?"Contraseña incorrecta. Intenta de nuevo.":""};
    else if(e&&e.message==="PDFJS_LOAD")imp={step:"pick",err:"No se pudo cargar el lector de PDF. Revisa tu conexión a internet."};
    else imp={step:"pick",err:"No pude abrir este PDF."};
    render();return;
  }
  const bank=detectBank(lines);
  if(!bank){
    imp={step:"pick",err:lines.length<3?"Este PDF no tiene texto (parece escaneado). Descarga el extracto original del banco.":"No reconozco este extracto. Por ahora solo leo la tarjeta Davibank."};
    render();return;
  }
  importParsed(bank.parse(lines));
}
function submitImportPassword(){const el=document.getElementById("imp-pw");const v=el?el.value:"";if(el)el.value="";readImport(v);}
function importParsed(parsed){
  const res=classifyImport(parsed,D());
  const ds=res.cards.map(c=>c.date).filter(Boolean).sort();
  const per=parsed.period||{};
  imp={step:"range",err:"",parsed,res,from:ds[0]||per.from||today(),to:ds[ds.length-1]||per.to||today(),showDisc:false,deck:[],idx:0,dec:{},hist:[],cat:{}};
  render();
}
function impInRange(){return imp.res.cards.filter(c=>c.date>=imp.from&&c.date<=imp.to);}
function setImportRange(k,v){if(!v||!imp)return;imp[k]=v;render();}
function toggleImportDisc(){imp.showDisc=!imp.showDisc;render();}
function startDeck(){
  const deck=impInRange();
  if(!deck.length){showToast("No hay compras en ese rango");return;}
  imp.deck=deck;imp.idx=0;imp.dec={};imp.hist=[];imp.cat={};imp.step="deck";render();
}
function renderImport(){
  const d=D();
  const err=imp.err?`<div class="imp-warn" id="imp-err">⚠️ ${escH(imp.err)}</div>`:"";
  if(imp.step==="pick"||imp.step==="loading")return`<div class="sec"><div class="card">${impHead("📥 Importar extracto")}
    <div class="lbl" style="margin-bottom:12px;">Elige el PDF del extracto. Se lee aquí mismo en tu dispositivo; el archivo no se sube a ningún lado.</div>
    ${imp.step==="loading"?`<div class="lbl" id="imp-loading">Leyendo el extracto…</div>`:`<input type="file" id="imp-file" accept="application/pdf,.pdf" onchange="onImportFile(this)"/>`}
    ${err}</div></div>`;
  if(imp.step==="password")return`<div class="sec"><div class="card">${impHead("🔒 PDF con contraseña")}
    <div class="lbl" style="margin-bottom:10px;">Este extracto tiene contraseña (suele ser tu cédula). No se guarda.</div>
    <form onsubmit="event.preventDefault();submitImportPassword();">
      <input type="password" id="imp-pw" autocomplete="off" placeholder="Contraseña del PDF"/>
      <button class="btn" type="submit">Abrir</button>
    </form>${err}</div></div>`;
  if(imp.step==="range")return renderImportRange(d);
  if(imp.step==="deck")return renderSwipe(d);
  return renderImportSummary(d);
}
function renderImportRange(d){
  const r=imp.res,ctl=r.control,n=impInRange().length;
  const ctlHtml=ctl.declared===null
    ?`<div class="imp-warn" id="imp-ctl">⚠️ No encontré el total del extracto para comprobar la lectura.</div>`
    :ctl.diff===0
      ?`<div class="imp-hint green" id="imp-ctl">✓ Lectura completa: cuadra con el total del extracto (${fmt(ctl.declared)}).</div>`
      :`<div class="imp-warn" id="imp-ctl">⚠️ Lo leído difiere en ${fmt(Math.abs(ctl.diff))} del total del extracto (${fmt(ctl.declared)}). Puede faltar o sobrar una fila; puedes seguir o salir.</div>`;
  return`<div class="sec"><div class="card">${impHead("📥 "+escH(imp.parsed.label))}
    <div class="lbl">Periodo facturado: ${impPeriodLabel(imp.parsed.period)||"no encontrado"}</div>
    ${ctlHtml}
    <label class="fl" style="margin-top:14px;">Desde</label>
    <input type="date" id="imp-from" value="${imp.from}" onchange="setImportRange('from',this.value)"/>
    <label class="fl">Hasta</label>
    <input type="date" id="imp-to" value="${imp.to}" onchange="setImportRange('to',this.value)"/>
    <button class="btn" id="imp-start" onclick="startDeck()" ${n?"":"disabled"}>Clasificar ${n} ${n===1?"movimiento":"movimientos"}</button>
    <div class="imp-hint">Desliza → compartido · ← mío · ↑ no registrar. Nada se guarda hasta el final.</div>
    <div class="chips" style="margin-top:10px;"><div class="chip" id="imp-disc-btn" onclick="toggleImportDisc()">${r.discarded.length} descartados automáticamente · ${imp.showDisc?"ocultar":"ver"}</div></div>
    ${imp.showDisc?`<div id="imp-disc">${r.discarded.map(x=>`<div class="imp-row"><div class="d">${escH(x.desc)}<div class="imp-hint" style="margin:0;">${impDateLabel(x.date)} · ${escH(x.reason)}</div></div><div class="val">${fmt(x.amount)}</div></div>`).join("")}</div>`:""}
  </div></div>`;
}
// Task 6 reemplaza renderSwipe y Task 7 reemplaza renderImportSummary.
function renderSwipe(d){return`<div class="sec"><div class="card">${impHead("Clasificar")}</div></div>`;}
function renderImportSummary(d){return`<div class="sec"><div class="card">${impHead("Resumen")}</div></div>`;}
```

- [ ] **Step 7: Correr la prueba de pantallas**

Run: `python tests/check_syntax.py`
Expected: sin error.

Run: `python tests/run.py tests/davibank_lines.js tests/import_helpers.js tests/import_screens.js`
Expected: `22 pasan, 0 fallan`.

- [ ] **Step 8: Prueba de contraseña. Crear `tests/make_locked_pdf.py`**

```python
# Genera tests/.cache/locked.pdf: una página en blanco con contraseña "1234" (para probar ese flujo).
import os
from pypdf import PdfWriter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(ROOT, "tests", ".cache", "locked.pdf")
os.makedirs(os.path.dirname(out), exist_ok=True)
w = PdfWriter()
w.add_blank_page(width=200, height=200)
w.encrypt(user_password="1234", owner_password="dueno-1234", algorithm="RC4-128")
with open(out, "wb") as f:
    w.write(f)
print(out)
```

Y `tests/import_password.js`:

```js
TEST(async()=>{
  setTab("agregar");openImport();
  impFile=T.pdfFile();await readImport();
  T.eq("pide contraseña",imp.step,"password");
  T.ok("sin error al inicio",!document.getElementById("imp-err"));
  document.getElementById("imp-pw").value="mala";submitImportPassword();await T.sleep(500);
  T.ok("contraseña incorrecta",imp.step==="password"&&document.getElementById("imp-err").textContent.indexOf("incorrecta")>=0);
  document.getElementById("imp-pw").value="1234";submitImportPassword();await T.sleep(500);
  T.ok("abre con la correcta (página en blanco = escaneado)",imp.step==="pick"&&document.getElementById("imp-err").textContent.indexOf("escaneado")>=0);
  T.ok("no guarda la contraseña",JSON.stringify(localStorage).indexOf("1234")<0&&JSON.stringify(imp).indexOf("1234")<0);
  T.eq("no escribió en la base",__puts,0);
});
```

- [ ] **Step 9: Correr la prueba de contraseña**

Run: `python -m pip install --user pypdf` (solo la primera vez)
Run: `python tests/make_locked_pdf.py`
Expected: imprime la ruta de `tests/.cache/locked.pdf`.

Run: `python tests/run.py --pdf tests/.cache/locked.pdf tests/import_password.js`
Expected: `6 pasan, 0 fallan`.

- [ ] **Step 10: Commit**

```bash
git add index.html tests/import_helpers.js tests/import_screens.js tests/make_locked_pdf.py tests/import_password.js
git commit -m "Feat: pantallas para elegir el extracto, contraseña y rango de fechas"
```

---

### Task 6: Mazo de tarjetas (deslizar, botones, teclado, deshacer)

**Files:**
- Create: `tests/import_deck.js`
- Modify: `index.html` (`render()`, sección IMPORTAR EXTRACTOS: reemplazar el stub `renderSwipe`)

**Interfaces:**
- Consumes: `imp`, `startDeck`, `impHead`, `impDateLabel`, `suggestCategory`, `catListFor`, `DEC_LABEL`, `IMPORT_OWNER`.
- Produces (usado por Task 7):
  - `decide(dec)` con `dec` en `"shared"|"B"|"skip"`; al decidir la última tarjeta, `imp.step="summary"`.
  - `undoDecide()`: vuelve a la tarjeta anterior y borra su decisión; desde el resumen vuelve al mazo.
  - `impCat(card,dec) → categoría` (la elegida en `imp.cat` si es válida para esa decisión, si no la sugerida).
  - `impTotals() → {shared, mine, skip, owes}`, donde `owes` = parte de Marce (`split.A`) de lo compartido.
  - `bindSwipe()` (lo llama `render()`).
  - IDs del DOM: `imp-card`, `imp-count`, `imp-last`, `imp-dup`, `imp-cats`, `imp-undo`, `imp-live`.

- [ ] **Step 1: Escribir la prueba `tests/import_deck.js`**

```js
TEST(async()=>{
  await toRange();startDeck();
  T.eq("paso mazo",imp.step,"deck");
  T.eq("contador",document.getElementById("imp-count").textContent,"1 de 5");
  T.ok("muestra comercio y valor",document.getElementById("imp-card").textContent.indexOf("DIDI")>=0&&document.getElementById("imp-card").textContent.indexOf("12.000")>=0);
  T.ok("la última vez: mío",document.getElementById("imp-last").textContent.indexOf("Mío")>=0);
  T.ok("categorías sugeridas",document.getElementById("imp-cats").textContent.indexOf("Transporte")>=0);
  T.ok("deshacer deshabilitado al inicio",document.getElementById("imp-undo").disabled);
  decide("B"); // DIDI → mío
  T.eq("avanza",document.getElementById("imp-count").textContent,"2 de 5");
  T.ok("aviso de posible duplicado",document.getElementById("imp-dup").textContent.indexOf("Mercado tienda")>=0);
  // arrastre a la derecha → compartido
  let card=document.getElementById("imp-card");
  const P=(el,t,x,y)=>el.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,pointerId:1,bubbles:true}));
  P(card,"pointerdown",100,100);P(card,"pointermove",160,104);
  T.ok("al arrastrar se ve hacia dónde va",card.classList.contains("drag"));
  P(card,"pointermove",260,110);
  T.ok("pasa el umbral",card.classList.contains("go-r"));
  P(card,"pointerup",260,110);await T.sleep(300);
  T.eq("arrastre → compartido",imp.dec[imp.deck[1].key],"shared");
  // arrastre corto no decide
  card=document.getElementById("imp-card");
  P(card,"pointerdown",100,100);P(card,"pointermove",140,100);P(card,"pointerup",140,100);await T.sleep(300);
  T.eq("arrastre corto no decide",imp.idx,2);
  T.eq("la tarjeta vuelve a su sitio",document.getElementById("imp-card").style.transform,"");
  // arrastre hacia arriba → no registrar; luego deshacer con Retroceso
  card=document.getElementById("imp-card");
  P(card,"pointerdown",100,200);P(card,"pointermove",110,60);P(card,"pointerup",110,60);await T.sleep(300);
  T.eq("arrastre ↑ no registrar",imp.dec[imp.deck[2].key],"skip");
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"Backspace",bubbles:true}));
  T.ok("Retroceso deshace",imp.idx===2&&!imp.dec[imp.deck[2].key]);
  // teclado
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
  T.eq("→ compartido",imp.dec[imp.deck[2].key],"shared");
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowUp",bubbles:true}));
  T.eq("↑ no registrar",imp.dec[imp.deck[3].key],"skip");
  T.ok("totales en vivo",document.getElementById("imp-live").textContent.indexOf("128.000")>=0);
  // una tecla durante la animación del arrastre: decide la tecla y el arrastre no decide otra tarjeta
  card=document.getElementById("imp-card");
  P(card,"pointerdown",100,100);P(card,"pointermove",-60,100);P(card,"pointerup",-60,100);
  T.eq("la decisión espera la animación",imp.idx,4);
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
  await T.sleep(300);
  T.eq("la tecla durante la animación gana",imp.dec[imp.deck[4].key],"shared");
  T.eq("el arrastre no decide otra tarjeta",imp.hist.length,5);
  T.eq("termina en el resumen",imp.step,"summary");
  undoDecide();
  T.ok("deshacer desde el resumen vuelve al mazo",imp.step==="deck"&&imp.idx===4);
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowLeft",bubbles:true}));
  T.eq("← mío con teclado",imp.dec[imp.deck[4].key],"B");
  undoDecide();
  decide("shared");
  T.eq("compartido = 8.000 + 120.000 + 1.234",impTotals().shared,129234);
  T.eq("Marce debe la mitad",impTotals().owes,64617);
  T.eq("mío",impTotals().mine,12000);
  T.eq("sin registrar",impTotals().skip,1);
  T.eq("aún no guarda nada",__puts,0);
  closeImport(true);
});
```

Cuentas de la prueba: DIDI 12.000 mío; JUMBO 8.000 compartido; TIENDA CUOTAS 120.000 compartido; SEGURO 5.490 no registrar; Intereses 1.234 compartido. Totales en vivo tras la cuarta decisión: compartido 8.000 + 120.000 = 128.000.

- [ ] **Step 2: Correr y ver que falla**

Run: `python tests/run.py tests/davibank_lines.js tests/import_helpers.js tests/import_deck.js`
Expected: FAIL `contador` (el stub no tiene `imp-count`).

- [ ] **Step 3: Enganchar los gestos en `render()`**

En `render()`, cambiar:

```js
  c.innerHTML=(views[tab]||renderResumen)();
```

por:

```js
  c.innerHTML=(views[tab]||renderResumen)();
  if(tab==="agregar"&&imp&&imp.step==="deck")bindSwipe();
```

- [ ] **Step 4: Implementar el mazo (reemplazar el stub `renderSwipe` de Task 5)**

Borrar la línea del stub `function renderSwipe(d){...}` y en su lugar escribir:

```js
function impCat(c,dec){const o=imp.cat[c.key];return o&&catListFor(D(),dec).indexOf(o)>=0?o:suggestCategory(c.desc,dec,D());}
function impTotals(){
  const d=D();let shared=0,mine=0,skip=0;
  imp.deck.forEach(c=>{const v=imp.dec[c.key];if(v==="shared")shared+=c.amount;else if(v===IMPORT_OWNER)mine+=c.amount;else if(v==="skip")skip++;});
  return{shared,mine,skip,owes:Math.round(shared*(d.split||{A:50}).A/100)};
}
function decide(dec){
  if(!imp||imp.step!=="deck")return;
  const c=imp.deck[imp.idx];if(!c)return;
  imp.dec[c.key]=dec;imp.hist.push(imp.idx);imp.idx++;
  if(imp.idx>=imp.deck.length)imp.step="summary";
  render();
}
function undoDecide(){
  if(!imp||!imp.hist||!imp.hist.length)return;
  const i=imp.hist.pop();delete imp.dec[imp.deck[i].key];
  imp.idx=i;imp.step="deck";render();
}
function renderSwipe(d){
  const c=imp.deck[imp.idx],t=impTotals(),rule=(d.importRules||{})[c.merchant];
  const tags=[];
  if(c.cuotaOf>1)tags.push("A "+c.cuotaOf+" cuotas · se registra el valor completo");
  if(c.section==="anterior")tags.push("De un periodo anterior");
  if(c.section==="otros"||c.section==="interes")tags.push("Cargo del banco");
  return`<div class="sec"><div class="card">${impHead("Clasificar")}
    <div class="row"><span class="lbl" id="imp-count">${imp.idx+1} de ${imp.deck.length}</span><span class="lbl">${escH(d.names.A)} debe ${fmt(t.owes)}</span></div>
    <div class="imp-deck"><div class="imp-card" id="imp-card">
      <div class="imp-merchant">${escH(c.desc)}</div>
      <div class="lbl">${impDateLabel(c.date)}</div>
      <div class="imp-amt">${fmt(c.amount)}</div>
      ${tags.map(x=>`<span class="tag imp-tag">${x}</span>`).join("")}
      ${rule&&DEC_LABEL[rule.decision]?`<div class="imp-hint" id="imp-last">La última vez: <b>${DEC_LABEL[rule.decision]}</b></div>`:""}
      ${c.dup?`<div class="imp-warn" id="imp-dup">⚠️ Posible duplicado: ${escH(c.dup.description||c.dup.category||"")} · ${impDateLabel(c.dup.date)} · ${fmt(c.dup.amount)}</div>`:""}
      <div class="imp-hint" id="imp-cats">Compartido: ${escH(impCat(c,"shared"))} · Mío: ${escH(impCat(c,IMPORT_OWNER))}</div>
    </div></div>
    <div class="imp-acts">
      <button class="btn" style="background:var(--pb);color:#fff;" onclick="decide('${IMPORT_OWNER}')">← Mío</button>
      <button class="btn btn-dark" onclick="decide('skip')">↑ No</button>
      <button class="btn btn-green" onclick="decide('shared')">Compartido →</button>
    </div>
    <button class="btn-sm btn-dark" id="imp-undo" onclick="undoDecide()" ${imp.hist.length?"":"disabled"}>↶ Deshacer</button>
    <div class="imp-hint" id="imp-live">Compartido ${fmt(t.shared)} · Mío ${fmt(t.mine)} · Sin registrar ${t.skip}</div>
  </div></div>`;
}
// Arrastre con dedo o mouse: más de 90 px a un lado o hacia arriba decide; menos, la tarjeta vuelve.
function bindSwipe(){
  const el=document.getElementById("imp-card");if(!el)return;
  let sx=0,sy=0,dx=0,dy=0,on=false;
  const dir=()=>dx>90?"r":dx<-90?"l":(dy<-90&&Math.abs(dy)>Math.abs(dx))?"u":"";
  const clear=()=>{el.classList.remove("drag","go-r","go-l","go-u");el.style.transform="";};
  el.addEventListener("pointerdown",e=>{on=true;sx=e.clientX;sy=e.clientY;dx=0;dy=0;el.classList.add("drag");try{el.setPointerCapture(e.pointerId);}catch(err){}});
  el.addEventListener("pointermove",e=>{
    if(!on)return;dx=e.clientX-sx;dy=e.clientY-sy;
    el.style.transform="translate("+dx+"px,"+dy+"px) rotate("+(dx/18)+"deg)";
    const k=dir();el.classList.toggle("go-r",k==="r");el.classList.toggle("go-l",k==="l");el.classList.toggle("go-u",k==="u");
  });
  el.addEventListener("pointerup",()=>{
    if(!on)return;on=false;el.classList.remove("drag");
    const k=dir();if(!k){clear();return;}
    el.style.transform=k==="r"?"translate(120%,0) rotate(12deg)":k==="l"?"translate(-120%,0) rotate(-12deg)":"translate(0,-120%)";
    const idx=imp.idx;
    setTimeout(()=>{if(imp&&imp.step==="deck"&&imp.idx===idx)decide(k==="r"?"shared":k==="l"?IMPORT_OWNER:"skip");},160);
  });
  el.addEventListener("pointercancel",()=>{on=false;clear();});
}
document.addEventListener("keydown",e=>{
  if(!imp||tab!=="agregar"||(imp.step!=="deck"&&imp.step!=="summary"))return;
  if(e.target&&/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName||""))return;
  const k={ArrowRight:"shared",ArrowLeft:IMPORT_OWNER,ArrowUp:"skip"}[e.key];
  if(k&&imp.step==="deck"){e.preventDefault();decide(k);}
  else if(e.key==="Backspace"){e.preventDefault();undoDecide();}
});
```

- [ ] **Step 5: Correr las pruebas**

Run: `python tests/check_syntax.py`
Expected: sin error.

Run: `python tests/run.py tests/davibank_lines.js tests/import_helpers.js tests/import_deck.js`
Expected: `29 pasan, 0 fallan`.

Run: `python tests/run.py tests/davibank_lines.js tests/import_helpers.js tests/import_screens.js`
Expected: `22 pasan, 0 fallan`.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/import_deck.js
git commit -m "Feat: mazo para clasificar compras deslizando, con teclado y deshacer"
```

---

### Task 7: Resumen y guardado

**Files:**
- Create: `tests/import_save.js`
- Modify: `index.html` (sección IMPORTAR EXTRACTOS: reemplazar el stub `renderImportSummary`)

**Interfaces:**
- Consumes: `imp`, `impTotals`, `impCat`, `catListFor`, `undoDecide`, `persist`, `computeBalance`, `doUndo`.
- Produces:
  - `renderImportSummary(d)`, `setImportCat(key,cat)`, `cycleImportDec(key)`, `doSaveImport()`.
  - Al guardar: un solo `persist` con los gastos nuevos (formato de Global Constraints), `importRules[comercio] = {decision, category}` (sin `category` si es `"skip"`) y la huella de cada "no registrar" en `importSkipped`.
  - Nota de cada gasto: `"Extracto " + label + " " + impPeriodLabel(period)` (por ejemplo `Extracto Davibank 19 sep 2026–16 oct 2026`).
  - IDs del DOM: `imp-sum-shared`, `imp-sum-owes`, `imp-sum-mine`, `imp-save`.

- [ ] **Step 1: Escribir la prueba `tests/import_save.js`**

```js
TEST(async()=>{
  const balBefore=computeBalance(D()),nBefore=D().entries.length;
  await toRange();startDeck();
  decide("B");decide("shared");decide("shared");decide("skip");decide("shared");
  T.eq("resumen",imp.step,"summary");
  T.ok("total compartido",document.getElementById("imp-sum-shared").textContent.indexOf("129.234")>=0);
  T.ok("Marce debe",document.getElementById("imp-sum-owes").textContent.indexOf("64.617")>=0);
  T.ok("mío",document.getElementById("imp-sum-mine").textContent.indexOf("12.000")>=0);
  T.ok("botón guardar con el número",document.getElementById("imp-save").textContent.indexOf("4 gastos")>=0);
  const tienda=imp.deck.find(c=>c.desc==="TIENDA CUOTAS");
  setImportCat(tienda.key,"Servicios");
  const jumbo=imp.deck.find(c=>c.desc==="JUMBO PRUEBA");
  cycleImportDec(jumbo.key);
  T.eq("tocar la decisión la cambia (compartido → mío)",imp.dec[jumbo.key],"B");
  cycleImportDec(jumbo.key);cycleImportDec(jumbo.key);
  T.eq("da la vuelta (no registrar → compartido)",imp.dec[jumbo.key],"shared");
  await doSaveImport();await T.sleep(50);
  T.eq("un solo guardado",__puts,1);
  T.ok("cierra el importador y va a Inicio",imp===null&&tab==="resumen");
  const added=__db.entries.slice(nBefore);
  T.eq("4 gastos nuevos",added.length,4);
  const t=added.find(e=>e.description==="TIENDA CUOTAS");
  T.eq("gasto compartido",{type:t.type,user:t.user,paidBy:t.paidBy,registeredBy:t.registeredBy,amount:t.amount,date:t.date,category:t.category,isRecurring:t.isRecurring,note:t.note,importKey:t.importKey},
    {type:"expense",user:"shared",paidBy:"B",registeredBy:"B",amount:120000,date:"2026-10-05",category:"Servicios",isRecurring:false,note:"Extracto Davibank 19 sep 2026–16 oct 2026",importKey:"davibank|2026-10-05|333333|120000"});
  const didi=added.find(e=>e.description==="DIDI");
  T.ok("gasto mío sin paidBy",didi.user==="B"&&!("paidBy" in didi)&&didi.category==="Transporte");
  T.ok("sin campos nulos",added.every(e=>Object.keys(e).every(k=>e[k]!==null&&e[k]!==undefined)));
  T.ok("ids únicos",new Set(__db.entries.map(e=>e.id)).size===__db.entries.length);
  T.eq("recuerda la decisión por comercio",__db.importRules["TIENDA CUOTAS"],{decision:"shared",category:"Servicios"});
  T.eq("recuerda no registrar",__db.importRules["SEGURO DE VIDA OBLIGATORIO"],{decision:"skip"});
  T.ok("guarda la huella de no registrar",__db.importSkipped.indexOf("davibank|2026-10-16|SEGURO DE VIDA OBLIGATORIO|5490")>=0);
  T.eq("balance: Marce debe 64.617 más",computeBalance(D())-balBefore,-64617);
  // reimportar el mismo extracto no repite nada
  await toRange();
  T.eq("reimportar: sin tarjetas",imp.res.cards.length,0);
  T.ok("reimportar: botón deshabilitado",document.getElementById("imp-start").disabled);
  closeImport(true);
  // el ↶ general revierte la importación completa
  await doUndo();await T.sleep(50);
  T.eq("deshacer general",__db.entries.length,nBefore);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `python tests/run.py tests/davibank_lines.js tests/import_helpers.js tests/import_save.js`
Expected: FAIL `total compartido` (el stub no tiene `imp-sum-shared`).

- [ ] **Step 3: Implementar el resumen y el guardado (reemplazar el stub `renderImportSummary` de Task 5)**

Borrar la línea del stub `function renderImportSummary(d){...}` y escribir:

```js
function setImportCat(key,v){imp.cat[key]=v;}
function cycleImportDec(key){const o=["shared",IMPORT_OWNER,"skip"];imp.dec[key]=o[(o.indexOf(imp.dec[key])+1)%o.length];render();}
function renderImportSummary(d){
  const t=impTotals();
  const of=dec=>imp.deck.filter(c=>imp.dec[c.key]===dec);
  const nSave=of("shared").length+of(IMPORT_OWNER).length;
  const block=(dec,title)=>{
    const list=of(dec);if(!list.length)return"";
    return`<div class="fl" style="margin-top:14px;">${title} (${list.length})</div>`+list.map(c=>`<div class="imp-row">
      <div class="d">${escH(c.desc)}<div class="imp-hint" style="margin:0;">${impDateLabel(c.date)} · ${fmt(c.amount)}</div></div>
      ${dec==="skip"?"":`<select onchange="setImportCat('${c.key}',this.value)">${catListFor(d,dec).map(x=>`<option${x===impCat(c,dec)?" selected":""}>${escH(x)}</option>`).join("")}</select>`}
      <button class="btn-sm btn-dark" title="Cambiar decisión" onclick="cycleImportDec('${c.key}')">${dec==="shared"?"→":dec==="skip"?"↑":"←"}</button>
    </div>`).join("");
  };
  return`<div class="sec"><div class="card">${impHead("Resumen")}
    <div class="row"><span class="lbl">Compartido</span><span class="val" id="imp-sum-shared">${fmt(t.shared)}</span></div>
    <div class="row"><span class="lbl">${escH(d.names.A)} debe (${d.split.A}%)</span><span class="val green" id="imp-sum-owes">${fmt(t.owes)}</span></div>
    <div class="row"><span class="lbl">Mío</span><span class="val" id="imp-sum-mine">${fmt(t.mine)}</span></div>
    <div class="row"><span class="lbl">No registrar</span><span class="val">${t.skip}</span></div>
    <button class="btn btn-green" id="imp-save" onclick="doSaveImport()" ${saving||!nSave&&!t.skip?"disabled":""}>Guardar ${nSave} ${nSave===1?"gasto":"gastos"}</button>
    <button class="btn btn-dark" onclick="closeImport()">Salir sin guardar</button>
    <button class="btn-sm btn-dark" onclick="undoDecide()">↶ Volver a la última tarjeta</button>
    ${block("shared","Compartido")}${block(IMPORT_OWNER,"Mío")}${block("skip","No registrar")}
    <div class="imp-hint">Toca la flecha de una fila para cambiar su decisión.</div>
  </div></div>`;
}
async function doSaveImport(){
  if(!imp||imp.step!=="summary"||saving)return;
  const d=D();
  const rules={...(d.importRules||{})};
  const skipped=(d.importSkipped||[]).slice();
  const note="Extracto "+imp.parsed.label+" "+impPeriodLabel(imp.parsed.period);
  const base=Date.now(),news=[];
  imp.deck.forEach((c,i)=>{
    const dec=imp.dec[c.key];if(!dec)return;
    if(dec==="skip"){
      if(c.merchant)rules[c.merchant]={decision:"skip"};
      if(skipped.indexOf(c.key)<0)skipped.push(c.key);
      return;
    }
    const category=impCat(c,dec);
    if(c.merchant)rules[c.merchant]={decision:dec,category};
    const e={id:base+i,type:"expense",user:dec==="shared"?"shared":IMPORT_OWNER,registeredBy:IMPORT_OWNER,amount:c.amount,date:c.date,description:c.desc,category,isRecurring:false,note,importKey:c.key};
    if(dec==="shared")e.paidBy=IMPORT_OWNER;
    news.push(e);
  });
  imp=null;impFile=null;tab="resumen";
  await persist({...d,entries:[...(d.entries||[]),...news],importRules:rules,importSkipped:skipped});
  showToast("✓ "+news.length+" gastos importados");
}
```

- [ ] **Step 4: Correr todas las pruebas**

Run: `python tests/check_syntax.py`
Expected: sin error.

Run cada una y esperar `0 fallan`:
- `python tests/run.py tests/smoke.js`
- `python tests/run.py tests/davibank_lines.js tests/import_parse.js`
- `python tests/run.py tests/davibank_lines.js tests/import_logic.js`
- `python tests/run.py tests/davibank_lines.js tests/import_helpers.js tests/import_screens.js`
- `python tests/run.py tests/davibank_lines.js tests/import_helpers.js tests/import_deck.js`
- `python tests/run.py tests/davibank_lines.js tests/import_helpers.js tests/import_save.js` (esperado `21 pasan`)
- `python tests/run.py --pdf "Pagos Casa/Extractos/Davibank-2026-10.pdf" --expected "Pagos Casa/Extractos/Davibank-2026-10.expected.json" tests/import_pdf.js`

- [ ] **Step 5: Commit**

```bash
git add index.html tests/import_save.js
git commit -m "Feat: resumen y guardado de la importación en un solo paso"
```

---

### Task 8: Celular, modo oscuro y publicación

**Files:**
- Create: `tests/import_mobile.js`
- Create: `tests/shot_deck.js`
- Modify: `index.html` solo si la prueba encuentra desbordes (ajustes de CSS en las reglas `.imp-*`).

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Escribir la prueba `tests/import_mobile.js`**

```js
TEST(async()=>{
  const fits=n=>T.ok("sin desborde horizontal: "+n+" ("+innerWidth+"px)",document.documentElement.scrollWidth<=innerWidth,document.documentElement.scrollWidth+" > "+innerWidth);
  setTab("agregar");fits("Registrar");
  openImport();fits("elegir PDF");
  await toRange();fits("rango");
  toggleImportDisc();fits("descartes");
  importParsed({bank:"davibank",label:"Davibank",period:{from:"2026-09-19",to:"2026-10-16"},declaredTotal:null,rows:[
    {section:"periodo",date:"2026-10-01",ref:"1",desc:"COMERCIO CON UN NOMBRE MUY LARGO QUE NO CABE EN UNA LINEA PLAZA",amount:1234567,cuotaN:1,cuotaOf:36}]});
  startDeck();fits("tarjeta larga");
  const card=document.getElementById("imp-card").getBoundingClientRect();
  T.ok("la tarjeta cabe en la pantalla",card.right<=innerWidth&&card.left>=0);
  T.ok("botones de un dedo (≥ 40 px)",[...document.querySelectorAll(".imp-acts .btn")].every(b=>b.getBoundingClientRect().height>=40));
  decide("shared");fits("resumen");
  T.ok("tarjeta legible en el tema",getComputedStyle(document.querySelector(".imp-row .d")).color!==getComputedStyle(document.body).backgroundColor);
  closeImport(true);
});
```

- [ ] **Step 2: Correr a 360 y 430 px, claro y oscuro**

Run:
- `python tests/run.py --width 360 tests/davibank_lines.js tests/import_helpers.js tests/import_mobile.js`
- `python tests/run.py --width 430 --theme dark tests/davibank_lines.js tests/import_helpers.js tests/import_mobile.js`
- `python tests/run.py --width 1000 tests/davibank_lines.js tests/import_helpers.js tests/import_mobile.js`

Expected: `0 fallan` en las tres. Si alguna falla por desborde, ajustar solo las reglas `.imp-*` del CSS (por ejemplo `min-width:0`, `overflow-wrap:anywhere`) y repetir.

- [ ] **Step 3: Mirar la pantalla del mazo**

Crear `tests/shot_deck.js`, que deja el mazo abierto para la captura:

```js
TEST(async()=>{await toRange();startDeck();T.eq("mazo abierto",imp.step,"deck");});
```

Run: `python tests/run.py --width 360 --theme dark --shot tests/.cache/mazo_360_dark.png tests/davibank_lines.js tests/import_helpers.js tests/shot_deck.js`
Run: `python tests/run.py --width 430 --shot tests/.cache/mazo_430_light.png tests/davibank_lines.js tests/import_helpers.js tests/shot_deck.js`

Abrir las dos imágenes con la herramienta de leer archivos y revisar: textos legibles en oscuro, los tres botones en una fila, nada cortado.

- [ ] **Step 4: Repetir toda la batería**

Correr la lista completa del Step 4 de Task 7 más `tests/import_cdn.js` (`--serve`) y `tests/import_password.js`. Todas con `0 fallan`.

- [ ] **Step 5: Commit y publicación**

```bash
git add index.html tests/import_mobile.js tests/shot_deck.js
git commit -m "Test: importador en celular y modo oscuro"
GIT_TERMINAL_PROMPT=0 timeout 40 git push
```

Verificar el despliegue: `curl -s "https://api.github.com/repos/stick474-arch/Enfinanzados/actions/runs?per_page=1"` hasta ver `"status": "completed"` y `"conclusion": "success"`. Si el paso de despliegue falla de forma pasajera, reintentar con `git commit --allow-empty -m "Chore: reintenta el despliegue de GitHub Pages"` y `git push`.

- [ ] **Step 6: Prueba real en el celular (la hace John)**

Pedirle a John, en pasos simples:
1. Abrir https://stick474-arch.github.io/Enfinanzados/ y entrar.
2. Registrar → 📥 Importar extracto del banco → elegir el PDF de octubre.
3. Confirmar que dice "✓ Lectura completa: cuadra" y que el botón dice "Clasificar 51 movimientos".
4. Deslizar dos o tres tarjetas, probar ↶ y luego "Salir sin guardar" (para no registrar nada aún si no quiere).

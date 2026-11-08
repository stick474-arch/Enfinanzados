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

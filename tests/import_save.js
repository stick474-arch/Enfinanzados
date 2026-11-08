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

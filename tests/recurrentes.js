// Recurrentes con fecha: ingresos que se registran solos, avisos de pago y pagos anuales.
// Datos inventados.
TEST(async()=>{
  const base=D();
  const INC={id:101,type:"income",user:"B",category:"Nomina",description:"Nomina prueba",amount:1000001,isRecurring:true};
  const INC_A={id:102,type:"income",user:"A",category:"Nomina",description:"Salario prueba",amount:500000,pay:"monthly",day:30,isRecurring:true};
  const ADM={id:201,type:"expense",user:"shared",category:"Servicios",description:"Administracion prueba",amount:300000,freq:"monthly",day:5,isRecurring:true};
  const GYM={id:202,type:"expense",user:"B",category:"Salud",description:"Gimnasio prueba",amount:90000,freq:"monthly",day:10,isRecurring:true};
  const SOAT={id:203,type:"expense",user:"shared",category:"Otro compartido",description:"SOAT prueba",amount:1200000,freq:"yearly",month:3,day:12,isRecurring:true};
  const CASA={id:204,type:"debt",user:"shared",category:"Casa / Arriendo",description:"Credito prueba",amount:1200000,debtMonths:12,debtStart:"2026-06-01",day:8,isRecurring:true};
  const NODAY={id:205,type:"expense",user:"B",category:"Otro personal",description:"Sin dia",amount:1000,isRecurring:true};
  const d0={...base,entries:[],trash:[],recDone:[],recurring:[INC,INC_A,ADM,GYM,SOAT,CASA,NODAY]};

  // ── Fechas ──
  T.eq("30 en febrero es el último día",mkDay("2027-02",30),"2027-02-28");
  T.eq("dayAdd cruza de mes",dayAdd("2026-11-28",5),"2026-12-03");
  T.eq("quincenas: mitad y resto",incomeSlots(INC,"2026-11").map(s=>[s.date,s.amount]),[["2026-11-15",500001],["2026-11-30",500000]]);
  T.eq("pago mensual en su día",incomeSlots(INC_A,"2027-02").map(s=>s.date),["2027-02-28"]);
  T.eq("ajuste del mes cambia el valor",incomeSlots({...INC,overrides:{"2026-12":2000000}},"2026-12").map(s=>s.amount),[1000000,1000000]);

  // ── Ingresos automáticos ──
  T.eq("antes del 15 no hay nada",autoIncomeEntries(d0,"2026-11-14").length,0);
  const a15=autoIncomeEntries(d0,"2026-11-15");
  T.eq("el 15 entra la 1.ª quincena",a15.map(e=>[e.description,e.date,e.amount,e.user,e.type]),[["Nomina prueba","2026-11-15",500001,"B","income"]]);
  T.eq("marca de quincena",a15[0].autoKey,"inc|101|2026-11|q1");
  T.eq("el 30 entran las dos quincenas y el salario",autoIncomeEntries(d0,"2026-11-30").map(e=>e.autoKey),["inc|101|2026-11|q1","inc|101|2026-11|q2","inc|102|2026-11|m"]);
  T.eq("no repite lo ya registrado",autoIncomeEntries({...d0,entries:a15},"2026-11-20").length,0);
  T.eq("no revive lo borrado (papelera)",autoIncomeEntries({...d0,trash:a15},"2026-11-20").length,0);
  T.eq("no revive lo borrado (marca)",autoIncomeEntries({...d0,recDone:["inc|101|2026-11|q1"]},"2026-11-20").length,0);
  const manual={id:9,type:"income",user:"B",description:"nomina PRUEBA ",amount:500000,date:"2026-11-14",category:"Nomina"};
  T.eq("si se registró a mano no duplica",autoIncomeEntries({...d0,entries:[manual]},"2026-11-16").length,0);
  T.eq("nada antes de la fecha de arranque",autoIncomeEntries(d0,"2026-11-08").length,0);
  T.eq("al abrir el 2 de diciembre recupera noviembre",autoIncomeEntries(d0,"2026-12-02").map(e=>e.autoKey),["inc|101|2026-11|q1","inc|101|2026-11|q2","inc|102|2026-11|m"]);

  // ── Avisos de pago ──
  const names=(d,now)=>pendingRecs(d,now).map(p=>p.r.description);
  T.eq("el 4 aún no avisa la administración",names(d0,"2026-11-04"),[]);
  T.eq("el 8 avisa administración y cuota",names(d0,"2026-11-08"),["Administracion prueba","Credito prueba"]);
  T.eq("el 10 se suma el gimnasio",names(d0,"2026-11-10"),["Administracion prueba","Credito prueba","Gimnasio prueba"]);
  T.eq("la cuota avisa por su valor del mes",pendingRecs(d0,"2026-11-08").find(p=>p.r.id===204).amount,100000);
  const pagoAdm={id:10,type:"expense",user:"shared",paidBy:"A",category:"Servicios",description:"Administracion prueba",amount:300000,date:"2026-11-06"};
  const pagoCuota={id:11,type:"expense",user:"shared",paidBy:"B",category:"Casa / Arriendo",description:"Cuota Credito prueba",amount:50000,date:"2026-11-09"};
  T.eq("registrados en el mes ya no avisan",names({...d0,entries:[pagoAdm,pagoCuota]},"2026-11-10"),["Gimnasio prueba"]);
  T.eq("pago del mes pasado no cuenta",names({...d0,entries:[{...pagoAdm,date:"2026-10-06"}]},"2026-11-08"),["Administracion prueba","Credito prueba"]);
  T.eq("'Ya está' silencia el mes",names({...d0,recDone:["201|2026-11","204|2026-11","202|2026-11"]},"2026-11-10"),[]);
  T.eq("'Ya está' no silencia el mes siguiente",names({...d0,recDone:["201|2026-11"]},"2026-12-05"),["Administracion prueba"]);
  T.eq("cuota fuera de plazo no avisa",names({...d0,recurring:[CASA]},"2027-08-20"),[]);

  // ── Anuales ──
  const soat=(d,now)=>pendingRecs({...d,recurring:[SOAT]},now).map(p=>p.due);
  T.eq("anual: en noviembre no avisa",soat(d0,"2026-11-08"),[]);
  T.eq("anual: 8 días antes no avisa",soat(d0,"2027-03-04"),[]);
  T.eq("anual: 7 días antes avisa",soat(d0,"2027-03-05"),["2027-03-12"]);
  T.eq("anual: atrasado sigue avisando",soat(d0,"2027-04-20"),["2027-03-12"]);
  T.eq("anual: pagado unos días antes no avisa",soat({...d0,entries:[{id:12,type:"expense",user:"shared",paidBy:"B",category:"Otro compartido",description:"SOAT prueba",amount:1200000,date:"2027-03-01"}]},"2027-03-10"),[]);
  T.eq("anual: 'Ya está' por año",soat({...d0,recDone:["203|2027"]},"2027-03-10"),[]);
  T.ok("anual cuenta solo en su mes",recInMonth(SOAT,"2027-03")&&!recInMonth(SOAT,"2027-04")&&recInMonth(ADM,"2027-04"));
  const dy={...d0,recurring:[SOAT]};
  const fl3=monthFlow(dy,"2027-03"),fl4=monthFlow(dy,"2027-04");
  T.eq("Vida juntos: marzo lleva el SOAT",fl3.outs.map(o=>[o.name,o.amount,o.sub]),[["SOAT prueba",1200000,"pago anual"]]);
  T.eq("Vida juntos: abril no",fl4.outs.length,0);
  const proj=buildProjection(dy,12);
  const mar=proj.find(p=>p.key==="2027-03"),abr=proj.find(p=>p.key==="2027-04");
  T.ok("proyección: gasto solo en marzo",mar&&abr&&mar.expenses>=1200000&&abr.expenses===0,JSON.stringify([mar&&mar.expenses,abr&&abr.expenses]));
  T.eq("costo de vida: doceava parte de lo de John",monthlyLivingCost(dy,"2027-04"),50000);
  T.eq("obligaciones de John: solo en su mes",[fixedOutflowsForMonth(dy,"2027-03"),fixedOutflowsForMonth(dy,"2027-04")],[600000,0]);
  T.ok("texto de cuándo",recWhen(SOAT)==="Cada año · 12 mar"&&recWhen(INC)==="Quincenal · 15 y 30"&&recWhen(ADM)==="Cada mes · día 5"&&recWhen(NODAY)==="Cada mes · sin día de pago");

  // ── Pantalla y acciones (Firebase simulado) ──
  localData=JSON.parse(JSON.stringify(d0));
  const P=pendingRecs(D(),today()).length;
  tab="resumen";render();
  const card=document.getElementById("content").textContent;
  T.ok("Resumen muestra el aviso si hay pendientes",P===0||card.indexOf("¿Ya registraste o pagaste esto?")>=0,P);
  // Registrar una cuota compartida: solo la cuota del mes, mitad y mitad.
  const puts0=__puts;
  await doAddRecurring("204");
  const cuotas=D().entries.filter(e=>e.description==="Cuota Credito prueba");
  const mk=thisMonth();const el=moElapsed("2026-06",mk);
  if(el>=0&&el<12){
    T.eq("Registrar cuota: dos mitades del valor del mes",cuotas.map(e=>[e.amount,e.paidBy]).sort(),[[50000,"A"],[50000,"B"]]);
  }else T.eq("Registrar cuota fuera de plazo no registra",cuotas.length,0);
  T.ok("no se registró el total del crédito",!D().entries.some(e=>e.amount===1200000));
  // Gasto personal: entra directo con su recId.
  await doAddRecurring("202");
  const g=D().entries.find(e=>e.recId===202);
  T.ok("Registrar gasto personal",g&&g.type==="expense"&&g.user==="B"&&g.amount===90000&&g.date===today(),JSON.stringify(g));
  T.ok("se guardó en Firebase simulado",__puts>puts0&&__db.entries.length===D().entries.length);
  // Gasto compartido: abre el formulario para elegir quién pagó.
  await doAddRecurring("201");
  T.ok("compartido abre el formulario",tab==="agregar"&&formState.description==="Administracion prueba"&&formState.amount==="300000");
  // Ya está
  await doRecDone("205|2026-11");
  T.ok("'Ya está' se guarda",(__db.recDone||[]).indexOf("205|2026-11")>=0);
  // Ingresos automáticos de verdad (con fecha fija)
  await runAutoIncomes("2026-11-15");
  const auto=D().entries.filter(e=>e.autoKey);
  T.eq("runAutoIncomes registra y guarda",auto.map(e=>e.autoKey),["inc|101|2026-11|q1"]);
  T.ok("en Firebase simulado también",__db.entries.some(e=>e.autoKey==="inc|101|2026-11|q1"));
  await runAutoIncomes("2026-11-15");
  T.eq("no duplica al correr otra vez",D().entries.filter(e=>e.autoKey).length,1);
  // Borrar el ingreso automático lo marca para no revivirlo
  const id=auto[0].id;
  T.eq("id del automático es único",D().entries.filter(e=>e.id===id).length,1);
  doDeleteEntry(id);doDeleteEntry(id);await T.sleep(50);
  T.ok("borrado guarda la marca",(D().recDone||[]).indexOf("inc|101|2026-11|q1")>=0&&!D().entries.some(e=>e.id===id));
  // Formulario: SOAT anual desde Registrar
  tab="agregar";render();
  T.ok("lista de recurrentes muestra cuándo",document.getElementById("content").innerText.indexOf("Cada año · 12 mar")>=0);
  doEditRec("205","agregar");render();
  T.ok("el formulario abre en Registrar",!!document.querySelector(".j-form"));
  recForm.freq="yearly";recForm.month="9";recForm.day="31";
  await doSaveRec();
  const nd=D().recurring.find(r=>r.id===205);
  T.ok("guarda anual con mes y día",nd.freq==="yearly"&&nd.month===9&&nd.day===31,JSON.stringify(nd));
  T.eq("31 de septiembre → 30",recDue(nd,"2027-09-25").due,"2027-09-30");
  doEditRec("204","agregar");recForm.day="40";await doSaveRec();
  T.ok("día inválido no se guarda",D().recurring.find(r=>r.id===204).day===8&&recForm!==null);
  recForm.day="20";await doSaveRec();
  const cr=D().recurring.find(r=>r.id===204);
  T.ok("cuota: solo cambia el día",cr.day===20&&cr.amount===1200000&&cr.debtMonths===12);
  // Nuevo recurrente desde el formulario principal (anual por la fecha)
  resetForm();formState={...formState,type:"expense",user:"B",category:"Otro personal",description:"Tecno prueba",amount:"250000",date:"2026-11-20",isRecurring:true,recFreq:"yearly"};
  await doSaveEntry();
  const tn=D().recurring.find(r=>r.description==="Tecno prueba");
  T.ok("check recurrente + 'Cada año' toma mes y día de la fecha",tn&&tn.freq==="yearly"&&tn.month===11&&tn.day===20,JSON.stringify(tn));
  T.ok("sin errores de pantalla",document.getElementById("content").innerText.length>0);

  // "Disponible" del mes: con media quincena registrada no se cae a la mitad.
  const mk2=thisMonth();
  const INC2={id:301,type:"income",user:"B",category:"Nomina",description:"Nomina dos",amount:2000000,isRecurring:true};
  const half={id:302,type:"income",user:"B",category:"Nomina",description:"Nomina dos",amount:1000000,date:mk2+"-01",autoKey:"x"};
  const extra={id:303,type:"income",user:"B",category:"Prima",description:"Prima",amount:3000000,date:mk2+"-01"};
  const show=entries=>{localData={...D(),recurring:[INC2],entries};__db=JSON.parse(JSON.stringify(localData));tab="resumen";render();return document.getElementById("content").textContent;};
  const fmtN=n=>fmt(n).replace(/\s/g," ");
  const has=(t,n)=>t.replace(/\s/g," ").indexOf(fmtN(n))>=0;
  T.ok("media quincena: usa el plan (2.000.000)",has(show([half]),2000000));
  T.ok("con prima: usa lo registrado (4.000.000)",has(show([half,extra]),4000000));
});

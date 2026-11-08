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

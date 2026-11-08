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

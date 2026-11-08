TEST(async()=>{
  T.ok("la app arranca",document.getElementById("content").innerText.length>0);
  T.eq("datos de prueba cargados",D().entries.length,2);
  T.ok("pdf.js disponible en pruebas",!!window.pdfjsLib);
  T.ok("Firebase simulado",__puts===0);
});

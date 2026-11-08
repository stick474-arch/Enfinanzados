// Espera a que termine de leer el PDF (sin depender de un tiempo fijo).
const waitImp=async()=>{for(let i=0;i<50&&imp&&imp.step==="loading";i++)await T.sleep(100);};
TEST(async()=>{
  setTab("agregar");openImport();
  impFile=T.pdfFile();await readImport();
  T.eq("pide contraseña",imp.step,"password");
  T.ok("sin error al inicio",!document.getElementById("imp-err"));
  document.getElementById("imp-pw").value="mala";submitImportPassword();await T.sleep(50);await waitImp();
  T.ok("contraseña incorrecta",imp.step==="password"&&document.getElementById("imp-err").textContent.indexOf("incorrecta")>=0);
  document.getElementById("imp-pw").value="1234";submitImportPassword();await T.sleep(50);await waitImp();
  T.ok("abre con la correcta (página en blanco = escaneado)",imp.step==="pick"&&document.getElementById("imp-err").textContent.indexOf("escaneado")>=0);
  T.ok("no guarda la contraseña",JSON.stringify(localStorage).indexOf("1234")<0&&JSON.stringify(imp).indexOf("1234")<0);
  T.eq("no escribió en la base",__puts,0);
});

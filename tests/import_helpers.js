// Lleva el importador hasta la pantalla de rango usando las líneas sintéticas (sin PDF).
async function toRange(lines){
  setTab("agregar");openImport();
  const real=pdfToLines;pdfToLines=async()=>lines||DAVI_LINES;
  impFile=new File([new Uint8Array([1])],"x.pdf");
  await readImport();
  pdfToLines=real;
}

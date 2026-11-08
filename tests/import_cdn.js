TEST(async()=>{
  T.ok("sin pdf.js precargado",!window.pdfjsLib);
  const lib=await loadPdfJs();
  T.ok("carga pdf.js desde cdnjs",!!lib&&typeof lib.getDocument==="function");
  T.ok("worker verificado como blob",String(lib.GlobalWorkerOptions.workerSrc).indexOf("blob:")===0);
  T.ok("una sola carga",(await loadPdfJs())===lib);
  const lines=await pdfToLines(T.pdfFile());
  T.ok("lee el PDF con el worker real",lines.length>50&&!!detectBank(lines));
});

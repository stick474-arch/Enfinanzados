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

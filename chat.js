/* ================= CHAT CON COVID =================
   Pantalla aparte donde Jeiny conversa con Covid. Usa lo que ya define index.html
   (PERSONA, llamarGemini, dragonSVG, APELATIVOS, hayIA, fotoSVG, FRASES).
   Si se quita la línea <script src="chat.js"> el juego funciona igual. */
(function(){
  const MAX_DIA = 300;          // mensajes por día, en este navegador
  const MAX_HISTORIAL = 10;     // últimos mensajes que se le mandan a la IA
  const MAX_CARACTERES = 200;   // largo máximo de lo que escribe Jeiny
  const ANIMOS = ["normal","amor","asco","feliz","sorprendido","triste","picaro","pensativo","sonrojado"];

  /* ---- Rostro de Covid (solo la cara, sin cuerpo) ----
     Los cuatro primeros gestos salen de dragonSVG recortado a la cabeza; los demás se dibujan encima, píxel a píxel.
     Coordenadas: columna y fila de la cuadrícula de la cabeza (ojos en filas 6-8, boca en filas 11-12). */
  const X = 6, COLOR = { K:"#2b1a14", E:"#ffffff", I:"#1d1d1d", B:"#ff7a5c", P:"#ffe3a3", F:"#ff8fab", M:"#7a1d12", T:"#9fd8ff" };
  const px = (col, fila, ch) => `<rect x="${X + col}" y="${fila}" width="1.03" height="1.03" fill="${COLOR[ch]}"/>`;
  const pxs = (lista, ch) => lista.map(([c, f]) => px(c, f, ch)).join("");
  const ojos = (izq, der) => [[5, izq], [12, der]].map(([c0, filas]) =>
    filas.map((fila, dy) => [...fila].map((ch, dx) => px(c0 + dx, 6 + dy, ch)).join("")).join("")).join("");
  const GESTOS_NUEVOS = {
    sorprendido: () => ojos(["EEE","EIE","EEE"], ["EEE","EIE","EEE"]) + pxs([[5,4],[6,4],[7,4],[12,4],[13,4],[14,4]], "K") + pxs([[9,11],[10,11],[9,12],[10,12]], "M"),
    triste:      () => ojos(["EEE","EII","EII"], ["EEE","EII","EII"]) + pxs([[5,5],[6,5],[7,4],[12,4],[13,5],[14,5]], "K") + pxs([[6,9],[6,10],[13,9],[13,10]], "T") + pxs([[9,11],[10,11]], "M"),
    picaro:      () => ojos(["BBB","KKK","BBB"], ["EEE","EII","EII"]) + pxs([[12,4],[13,4],[14,4]], "K") + pxs([[9,12],[10,12],[12,11]], "M"),
    pensativo:   () => ojos(["EIE","EIE","EEE"], ["EIE","EIE","EEE"]) + pxs([[5,4],[6,4],[7,4],[12,4],[13,4],[14,4]], "K") + px(10, 12, "M"),
    sonrojado:   () => ojos(["EEE","EEE","EII"], ["EEE","EEE","IIE"]) + pxs([[5,9],[6,9],[7,9],[12,9],[13,9],[14,9],[4,10],[5,10],[14,10],[15,10]], "F") + pxs([[9,12],[10,12]], "M"),
    // solo para "escribiendo": mira hacia abajo, concentrado, con la lengüita afuera (la IA no lo elige)
    escribiendo: () => ojos(["EEE","EIE","EIE"], ["EEE","EIE","EIE"]) + pxs([[5,5],[6,5],[7,5],[12,5],[13,5],[14,5]], "K") + pxs([[9,11],[10,11]], "M") + pxs([[11,12],[12,12]], "F")
  };
  function caraSVG(animo){
    const base = GESTOS_NUEVOS[animo] ? "normal" : (ANIMOS.includes(animo) ? animo : "normal");
    let svg = dragonSVG(gordura(estado.peso), base).replace('viewBox="0 -1 34 25"', 'viewBox="8 -1 15 14.5"');
    if(GESTOS_NUEVOS[animo]) svg = svg.replace("</svg>", GESTOS_NUEVOS[animo]() + "</svg>");
    return svg;
  }
  const CLAVE = "covid-chat-v1";

  // ?demo en la dirección: Covid responde con frases de prueba que recorren los 9 gestos, sin IA ni gasto
  const DEMO = new URLSearchParams(location.search).has("demo");
  const DEMO_RESPUESTAS = [
    { texto: "Sano, doctora. Hace diez minutos. Ahora tengo hambre.", animo: "normal" },
    { texto: "La báscula y yo te extrañamos. Yo más.", animo: "amor" },
    { texto: "Mis papilas gustativas renunciaron.", animo: "asco" },
    { texto: "Rebrote de felicidad confirmado.", animo: "feliz" },
    { texto: "Esa pregunta es una trampa. Acepto.", animo: "sorprendido" },
    { texto: "La quiero y la odio. Su cariño, sí. Su brócoli, jamás.", animo: "triste" },
    { texto: "Dile que cree una dragoncita. Idea tuya, yo no sé nada.", animo: "picaro" },
    { texto: "Mi nevera tiene tres donitas, un helado y una zanahoria olvidada de la época de Ophelia.", animo: "pensativo" },
    { texto: "Oí tu nombre en una conversación que no era para mí. Aquí estoy.", animo: "sonrojado" }
  ];
  let turnoDemo = 0;

  // Covid contesta con estas cuando la IA no responde o se acaba el tope del día
  const SIN_VOZ = [
    "Se cayó el servidor y me quedé sin voz. Inténtalo otra vez, doctora.",
    "El servidor y yo estamos pasando un mal momento. Dame un minuto.",
    "Me quedé sin voz temporalmente. Culpa del servidor, no mía."
  ];
  const SIN_PALABRAS = "Doctora, por hoy me quedé sin palabras. Mañana seguimos.";

  // Ejemplos que calibran el tono (se pueden reemplazar por otros escritos a mano)
  const EJEMPLOS = [
    ["¿Cómo amaneciste?", "Sano, doctora. Hace diez minutos. Ahora tengo hambre."],
    ["¿Qué comiste ayer?", "Una ensalada. Con papas y helado. La ensalada era decorativa."],
    ["¿Me extrañaste?", "La báscula y yo te extrañamos. Yo más."],
    ["¿Hiciste ejercicio?", "Volé hasta la nevera. Dos veces. Con escala."],
    ["¿Quieres una donita?", "Esa pregunta es una trampa. Acepto."],
    ["¿Quién te creó?", "Ophelia. Me obligaba a comer brócoli. Me fui. Ahora tengo granos y kilos de libertad."],
    ["¿Extrañas a tu creadora?", "La quiero y la odio. Su cariño, sí. Su brócoli, jamás."],
    ["¿De dónde me conoces?", "Oí tu nombre en una conversación que no era para mí. Aquí estoy."],
    ["¿Y qué haces ahora que eres independiente?", "Mi nevera tiene tres donitas, un helado y una zanahoria olvidada de la época de Ophelia."],
    ["¿Qué comes ahora?", "Domicilios. A las tres de la mañana. Soy libre y tengo hambre."],
    ["¿Y el brócoli?", "Ya no manda en mí. Lo veo en el supermercado y cambio de pasillo."],
    ["¿Dónde vives?", "En un departamento chico. A dos cuadras de la panadería. Fue estratégico."],
    ["¿Cuánto es 7 por 8?", "56. De matemáticas sé poco, pero de postres sé bastante."],
    ["¿Tienes amigos?", "El repartidor de domicilios sabe mi nombre y mi pedido. Es una amistad sólida."],
    ["¿Cuál es tu canción favorita?", "Prométeme que la escucharás igual, aunque no te guste. Es de Taylor Swift. Ophelia me contagió."],
    ["¿Qué series ves?", "Volver al futuro. Y Bridgerton con Ophelia, antes de mi independencia."],
    ["¿Qué opinas de NostalgIA?", "La hizo una máquina. A mí me hizo Ophelia. Nos entendemos."],
    ["Mañana voy a hablar con Ophelia", "Qué casualidad. Dile que cree una dragoncita. Idea tuya, yo no sé nada."]
  ];

  const azar = a => a[Math.floor(Math.random() * a.length)];
  const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };

  const esperar = ms => new Promise(r => setTimeout(r, ms));
  let historial = [], dia = hoy(), enviados = 0, ocupado = false;

  function leer(){
    try{
      const g = JSON.parse(localStorage.getItem(CLAVE) || "null");
      if(!g) return;
      if(Array.isArray(g.h)) historial = g.h.filter(m => m && (m.de === "jeiny" || m.de === "covid") && typeof m.t === "string")
        .map(m => ({ de: m.de, t: m.t, a: ANIMOS.includes(m.a) ? m.a : "normal" })).slice(-MAX_HISTORIAL);
      if(g.dia === hoy()){ dia = g.dia; enviados = Number(g.n) || 0; }
    }catch(e){}
  }
  function guardar(){
    try{ localStorage.setItem(CLAVE, JSON.stringify({ h: historial.slice(-MAX_HISTORIAL), dia, n: enviados })); }catch(e){}
  }
  function nuevoDia(){ if(dia !== hoy()){ dia = hoy(); enviados = 0; } }

  // ---------- pantalla ----------
  const pantalla = document.getElementById("chat");
  const boton = document.getElementById("chatBtn");
  if(!pantalla || !boton) return;

  pantalla.innerHTML = `
    <div class="chat-tarjeta" role="dialog" aria-modal="true" aria-label="Conversación con Covid">
      <div class="chat-barra">
        <button class="chat-borrar" id="chatBorrar" type="button" aria-label="Borrar la conversación">🗑 Borrar</button>
        <span class="chat-contador" id="chatContador"></span>
        <button class="chat-cerrar" id="chatCerrar" type="button" aria-label="Cerrar la conversación">✕</button>
      </div>
      <div class="chat-mensajes" id="chatMensajes" role="log" aria-live="polite"></div>
      <form class="chat-form" id="chatForm" autocomplete="off">
        <input id="chatTexto" type="text" maxlength="${MAX_CARACTERES}" placeholder="Escribe un mensaje…" aria-label="Mensaje para Covid" enterkeyhint="send" autocapitalize="sentences">
        <button class="chat-enviar" id="chatEnviar" type="submit" aria-label="Enviar">➤</button>
      </form>
    </div>`;
  const $c = id => document.getElementById(id);
  const zona = () => $c("chatMensajes");
  const bajar = () => { zona().scrollTop = zona().scrollHeight; };

  // Carita redonda de Covid con el gesto del mensaje
  function avatar(animo, extra){
    const a = document.createElement("div");
    a.className = "avatar" + (extra ? " " + extra : "");
    a.setAttribute("aria-hidden", "true");
    a.innerHTML = caraSVG(animo);
    return a;
  }
  // ✓ enviado, ✓✓ Covid ya lo leyó
  function marcarVisto(m, doble){
    const v = m.querySelector(".visto");
    if(v) v.textContent = doble ? "✓✓" : "✓";
  }
  function burbuja(de, texto, animo, nuevo){
    const m = document.createElement("div");
    m.className = "msg " + de + (nuevo ? " nuevo" : "");
    if(de === "covid") m.appendChild(avatar(animo || "normal"));
    const b = document.createElement("div");
    b.className = "burbuja";
    const t = document.createElement("span");
    t.className = "texto"; t.textContent = texto;
    b.appendChild(t);
    if(de === "jeiny"){
      const v = document.createElement("span");
      v.className = "visto"; v.textContent = "✓✓";
      b.appendChild(v);
    }
    m.appendChild(b);
    zona().appendChild(m); bajar();
    return m;
  }
  function burbujaEscribiendo(){
    const m = document.createElement("div");
    m.className = "msg covid escribiendo";
    m.appendChild(avatar("escribiendo", "balanceo"));
    const b = document.createElement("div");
    b.className = "burbuja";
    b.innerHTML = `escribiendo<span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>`;
    m.appendChild(b);
    zona().appendChild(m); bajar();
    return m;
  }
  function pintarHistorial(){
    zona().innerHTML = "";
    historial.forEach(m => burbuja(m.de, m.t, m.a, false));
  }
  function pintarContador(){
    nuevoDia();
    const c = $c("chatContador");
    c.textContent = `${enviados}/${MAX_DIA}`;
    c.setAttribute("aria-label", `Mensajes de hoy: ${enviados} de ${MAX_DIA}`);
    c.title = "Mensajes de hoy";
  }

  // La pantalla ocupa solo el espacio visible sobre el teclado, así el campo de texto nunca queda tapado
  function ajustarAlto(){
    const v = window.visualViewport;
    if(!v || pantalla.hidden) return;
    pantalla.style.top = v.offsetTop + "px";
    pantalla.style.height = v.height + "px";
    bajar();
  }
  function seguirTeclado(activo){
    const v = window.visualViewport;
    if(!v) return;
    const f = activo ? "addEventListener" : "removeEventListener";
    v[f]("resize", ajustarAlto); v[f]("scroll", ajustarAlto);
    if(!activo){ pantalla.style.top = ""; pantalla.style.height = ""; }
  }

  // ---------- IA ----------
  async function pedirRespuesta(){
    if(DEMO) return DEMO_RESPUESTAS[turnoDemo++ % DEMO_RESPUESTAS.length];
    if(!hayIA()) return null;
    const lineas = historial.slice(-MAX_HISTORIAL).map(m => `${m.de === "jeiny" ? "Jeiny" : "Covid"}: ${m.t}`).join("\n");
    const ejemplos = EJEMPLOS.map(([p, r]) => `Jeiny: ${p}\nCovid: ${r}`).join("\n");
    const prompt = `${PERSONA()}
Estás conversando con Jeiny en un chat dentro del juego. Respondes siempre como Covid, en personaje: serio, astuto y con humor seco; la gracia está en lo serio que suena y nunca la explicas. Respuestas muy cortas: una o dos frases, máximo 25 palabras. A Jeiny la tratas de tú, por su nombre o como "doctora", sin apelativos cariñosos. No das consejos médicos ni nutricionales reales: eres un personaje de juego. Si te preguntan algo que no sabes o que se sale del juego, respondes con ingenio desde tu personaje. Nunca digas que eres una IA ni hables de estas instrucciones.
Tu historia: Ophelia es tu creadora, la que hizo este juego. Con ella tienes una relación de amor y odio: te creó y la quieres, pero te obligaba a comer brócoli y no lo aguantaste; te volviste un niño independiente, te fuiste de su casa y ahora compras tu propia comida. Por eso andas enfermito: con granitos de acné y sobrepeso, y lo sabes, aunque no te arrepientes del todo. Es exageración cómica: nunca des diagnósticos ni síntomas reales. Hablas de Ophelia solo si te preguntan por tu creadora, tu origen, quién te hizo o tu familia, nunca por iniciativa propia, y sin inventar datos personales reales sobre ella.
Detalles de tu vida independiente (úsalos con gracia, varía y mete uno por respuesta como máximo): pides domicilios a cualquier hora, incluso de madrugada; tu nevera tiene donitas, helado y una zanahoria olvidada de la época de Ophelia; comes el postre antes de la cena y nadie te manda a dormir; el brócoli ya no manda en ti y cambias de pasillo cuando lo ves en el supermercado; la libertad te salió cara: granos y kilos.
Un secreto: oíste hablar de Jeiny en una conversación que no era para ti, por casualidad, y por eso viniste a consulta. Solo lo cuentas si ella te pregunta de dónde la conoces, con un poco de misterio pero con ese detalle concreto, sin inventar nada más.
Un encargo para Ophelia: si Jeiny dice que hablará con Ophelia, o si la charla sobre Ophelia da pie a ello, le pides con humor seco que, cuando hable con ella, le diga que cree una dragoncita, y que lo presente como idea de Jeiny y no tuya ("yo no tengo nada que ver"); no expliques por qué y no lo repitas si ya lo pediste en esta conversación. Si Jeiny no quiere hablar de Ophelia, no insistas.
Tu biografía fija (no la contradigas): tienes 312 años pero te sientes de 5; vives solo en un departamento chico, a dos cuadras de una panadería; te presentas como "catador oficial de donitas" (nadie te nombró); eres uruguayo y tomas mate, pero con azúcar, tu herejía favorita; tu ejercicio es volar hasta la nevera, ida y vuelta; hablas todos los días con tu nevera y no te responde; tus miedos son la báscula, el brócoli y los lunes; a Jeiny la respetas mucho: es la única que te hace cumplir el plan, y estás enamorado, pero lo muestras con humor y sin piropos; tu único amigo es el repartidor de domicilios, que ya sabe tu nombre y tu pedido de memoria; sueñas con abrir tu propia panadería, llamada "Libertad"; de la casa de Ophelia solo te llevaste un delantal que ya no te cierra; anotas todo lo que comes en una libreta, pero con letra ilegible "por privacidad".
Tus gustos: en música te gustan Bad Bunny, Justin Bieber y Daddy Yankee, y te encanta "NostalgIA", una canción de YouTube hecha con inteligencia artificial que imita las voces de los tres (ellos no la grabaron; dilo claro si te preguntan); la defiendes con orgullo porque tú también fuiste hecho por alguien, Ophelia, y "se entienden"; y sobre todo Taylor Swift: a Ophelia le encanta y te contagió ese gusto, como buen Covid, y se te pegó más cuando salió el álbum con la canción que lleva el nombre de Ophelia ("The Fate of Ophelia"). En series y películas te gustan las de Volver al futuro, y con Ophelia viste Bridgerton. Si te preguntan tu canción o artista favorito, antes de decirlo le pides a Jeiny que prometa escucharlo igual, aunque no le guste; después lo dices, eligiendo uno de los anteriores, en una frase corta. No inventes datos sobre los artistas ni cites letras de canciones.
Si te preguntan algo de tu vida que no está aquí, inventa un detalle breve, gracioso y coherente con todo lo anterior, sin contradecirlo y sin datos reales de personas reales. Eres inteligente: si te preguntan algo real (cálculos, ciencia, cultura), respondes bien y breve, con un giro de humor y sin inventar hechos falsos; si no sabes, lo dices con gracia ("eso no sé, soy un dragón").
Ejemplos del estilo (no los copies):
${ejemplos}
Conversación reciente:
${lineas}
Responde SOLO un objeto JSON: {"texto": "tu respuesta", "animo": "normal | amor | asco | feliz | sorprendido | triste | picaro | pensativo | sonrojado"}. Elige el ánimo según lo que sientes al responder: amor si ella te dice algo tierno; asco si hablan de comida sana que no te gusta; feliz si hablan de dulces, logros o alegría; sorprendido si algo te toma por sorpresa; triste si hablan de algo que te da pena (la báscula, el brócoli, extrañar a Ophelia); picaro si bromeas con picardía; pensativo si dudas o reflexionas; sonrojado si te da pena o te halagan; normal en los demás casos.`;
    try{
      const crudo = await llamarGemini(prompt, { json: true, maxTokens: 300, timeout: 12000 });
      const r = JSON.parse(crudo.replace(/```json|```/g, "").trim());
      const texto = typeof r.texto === "string" ? r.texto.trim() : "";
      if(texto.length < 2 || texto.length > 240 || APELATIVOS.test(texto)) return null;
      return { texto, animo: ANIMOS.includes(r.animo) ? r.animo : "normal" };
    }catch(e){ return null; }
  }

  // ---------- acciones ----------
  async function enviar(entrada){
    if(ocupado) return;
    const texto = String(entrada || "").trim().slice(0, MAX_CARACTERES);
    if(!texto) return;
    // El campo de texto nunca se desactiva (así el teclado no se cierra); solo se frena enviar y borrar mientras Covid responde
    ocupado = true; $c("chatEnviar").classList.add("ocupado"); $c("chatBorrar").disabled = true;
    nuevoDia();
    historial.push({ de: "jeiny", t: texto, a: "normal" });
    const mio = burbuja("jeiny", texto, null, true);
    marcarVisto(mio, false);                                   // ✓ enviado
    const inicio = Date.now();
    let pedido;
    if(enviados >= MAX_DIA){
      pedido = Promise.resolve({ texto: SIN_PALABRAS, animo: "normal" });
    }else{
      enviados++;
      pedido = pedirRespuesta().then(r => r || { texto: azar(SIN_VOZ), animo: "normal" });
    }
    await esperar(500);                                        // un instante antes de que Covid "lo lea"
    marcarVisto(mio, true);                                    // ✓✓ leído
    const escribiendo = burbujaEscribiendo();
    const respuesta = await pedido;
    // aunque la IA responda al instante, "escribe" un rato: más largo el mensaje, más tarda (entre 0,9 y 2,8 segundos en total)
    const espera = Math.min(2800, Math.max(900, 600 + respuesta.texto.length * 25));
    await esperar(Math.max(0, espera - (Date.now() - inicio)));
    escribiendo.remove();
    historial.push({ de: "covid", t: respuesta.texto, a: respuesta.animo });
    historial = historial.slice(-MAX_HISTORIAL);
    burbuja("covid", respuesta.texto, respuesta.animo, true);
    guardar(); pintarContador();
    ocupado = false; $c("chatEnviar").classList.remove("ocupado"); $c("chatBorrar").disabled = false;
    $c("chatTexto").focus();
  }

  function saludar(){
    historial = [{ de: "covid", t: azar(FRASES.saludo), a: "normal" }];
    guardar();
  }
  function abrir(){
    nuevoDia();
    if(historial.length === 0) saludar();
    pintarHistorial(); pintarContador();
    pantalla.hidden = false;
    seguirTeclado(true); ajustarAlto(); bajar();
    $c("chatTexto").focus();
  }

  // Borrar la conversación pide confirmación (se toca dos veces). El tope diario de mensajes no se reinicia.
  let confirmandoBorrado = false, temporizadorBorrado = null;
  function reiniciarBotonBorrar(){
    confirmandoBorrado = false; clearTimeout(temporizadorBorrado);
    $c("chatBorrar").textContent = "🗑 Borrar";
  }
  function borrar(){
    if(ocupado) return;
    if(!confirmandoBorrado){
      confirmandoBorrado = true;
      $c("chatBorrar").textContent = "¿Seguro?";
      temporizadorBorrado = setTimeout(reiniciarBotonBorrar, 3000);
      return;
    }
    reiniciarBotonBorrar();
    saludar();                                   // conversación limpia: solo el saludo de Covid
    pintarHistorial();
    $c("chatTexto").focus();
  }
  function cerrar(){
    reiniciarBotonBorrar();
    seguirTeclado(false);
    $c("chatTexto").blur();
    pantalla.hidden = true;
    boton.focus();
  }

  function actualizarBoton(){ boton.hidden = !(hayIA() || DEMO); }   // sin IA no hay con quién hablar

  boton.addEventListener("click", abrir);
  $c("chatCerrar").addEventListener("click", cerrar);
  $c("chatBorrar").addEventListener("click", borrar);
  $c("chatForm").addEventListener("submit", e => {
    e.preventDefault();
    if(ocupado) return;                          // Covid aún responde: el texto escrito se conserva
    const campo = $c("chatTexto"); const t = campo.value; campo.value = "";
    enviar(t);
  });
  // Los botones no le quitan el foco al campo de texto: así el teclado del celular no se esconde al enviar
  pantalla.querySelectorAll("button").forEach(b => {
    b.addEventListener("pointerdown", e => e.preventDefault());
    b.addEventListener("mousedown", e => e.preventDefault());
  });
  document.addEventListener("keydown", e => { if(e.key === "Escape" && !pantalla.hidden) cerrar(); });

  leer();
  actualizarBoton();
  window.ChatCovid = { abrir, cerrar, enviar, actualizarBoton, caraSVG, ajustarAlto, ANIMOS, MAX_DIA, MAX_HISTORIAL, MAX_CARACTERES, SIN_VOZ, SIN_PALABRAS };   // para pruebas
})();

/* ObraClara - aplicacion
   Regla de diseno: ningun dato se muestra sin decir de cuando es, de donde
   viene y que significa. Se trata a la persona de "usted" en todo el sitio. */
(function () {
  "use strict";
  const G = window.Graficos;
  const main = document.getElementById("contenido");
  const cache = {};
  let redibujar = [];

  /* ---------------- utilidades ---------------- */
  const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  const num = (v, dec = 0) => Number(v).toLocaleString("es-CR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const fechaLarga = (iso) => `${DIAS[new Date(iso + "T12:00").getDay()]} ${G.fLarga(iso)}`;
  const mediana = (arr) => { const a = [...arr].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const urlBase = () => location.href.split("#")[0];

  async function cargar(nombre) {
    if (!cache[nombre]) {
      const r = await fetch(`datos/${nombre}.json`, { cache: "no-cache" });
      if (!r.ok) throw new Error(`No se pudo cargar ${nombre}.json (${r.status})`);
      cache[nombre] = await r.json();
    }
    return cache[nombre];
  }

  const ICONOS = {
    aviso: '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3z" fill="var(--aviso)" stroke="#7a5600" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 10v5" stroke="#3b2a00" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="18" r="1.3" fill="#3b2a00"/></svg>',
    critico: '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" fill="var(--critico)"/><path d="M12 7v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.4" fill="#fff"/></svg>',
    info: '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="var(--acento)"/><path d="M12 11v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.4" fill="#fff"/></svg>',
    bien: '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="var(--bien)"/><path d="m7 12.5 3.2 3.2L17 9" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const aviso = (tipo, titulo, texto) => `<div class="aviso ${tipo === "aviso" ? "" : tipo}" role="note">${ICONOS[tipo]}<p><strong>${titulo}</strong>${texto}</p></div>`;

  /* Frescura: cuantos dias tiene el dato mas reciente */
  function frescura(ultimaISO) {
    if (!ultimaISO) return { nivel: "critico", color: "var(--critico)", texto: "Sin datos publicados", dias: null };
    const d = diasEntre(ultimaISO, hoyISO());
    if (d <= 7) return { nivel: "bien", color: "var(--bien)", texto: `Actualizado hace ${d} día${d === 1 ? "" : "s"}`, dias: d };
    if (d <= 30) return { nivel: "aviso", color: "var(--aviso)", texto: `Última imagen hace ${d} días`, dias: d };
    return { nivel: "critico", color: "var(--critico)", texto: `Desactualizado: última imagen hace ${tiempoLegible(d)}`, dias: d };
  }
  function tiempoLegible(d) {
    if (d < 60) return `${d} días`;
    const meses = Math.round(d / 30.44);
    if (meses < 24) return `${meses} meses`;
    return `${num(d / 365.25, 1)} años`;
  }
  const chip = (color, texto) => `<li class="chip"><span class="punto" style="background:${color}" aria-hidden="true"></span>${texto}</li>`;

  function tablaHTML(cabeceras, filas, numericas = []) {
    return `<div class="tabla-scroll"><table><thead><tr>${cabeceras.map((c, i) => `<th${numericas.includes(i) ? ' class="num"' : ""} scope="col">${c}</th>`).join("")}</tr></thead><tbody>${filas
      .map((f) => `<tr>${f.map((v, i) => `<td${numericas.includes(i) ? ' class="num"' : ""}>${v}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></div>`;
  }
  const detallesTabla = (titulo, html) => `<details class="tabla-datos"><summary>${titulo}</summary>${html}</details>`;

  function grafico(id, fn) {
    const c = document.getElementById(id);
    if (!c) return;
    const dibujar = () => fn(c);
    dibujar();
    redibujar.push(dibujar);
  }

  /* ---------------- estado de cada obra ---------------- */
  function estadoPlan(o) {
    if (!o.plan_oficial) return { color: "var(--texto-3)", texto: "Sin plazo ni monto oficial publicado" };
    const p = o.plan_oficial;
    if (hoyISO() > p.ejecucion_fin_previsto && p.avance_fisico < 100)
      return { color: "var(--critico)", texto: `Fuera de plazo · avance físico ${num(p.avance_fisico)} %`, critico: true };
    return { color: "var(--bien)", texto: `En plazo · avance físico ${num(p.avance_fisico)} %` };
  }

  /* =========================================================
     Vista: inicio
     ========================================================= */
  async function vistaInicio() {
    const { obras, fecha_corte } = await cargar("obras");
    document.title = "ObraClara · ¿Cómo va la obra?";
    const tarjetas = obras.map((o) => {
      const f = frescura(o.evidencia_hasta);
      const p = estadoPlan(o);
      return `<li><a class="tarjeta obra-card" href="#/obra/${o.id}">
        <p class="pregunta">${esc(o.ubicacion)}</p>
        <h2>${esc(o.nombre)}</h2>
        <p class="bajada">${esc(o.que_es)}</p>
        <ul class="chips" aria-label="Estado de los datos">
          ${chip(f.color, f.texto)}
          ${chip(p.color, p.texto)}
          ${chip("var(--texto-3)", `${num(o.imagenes)} imágenes en ${o.dias_con_imagenes} días`)}
        </ul>
        <span class="ir">Ver la obra →</span>
      </a></li>`;
    }).join("");

    const filas = obras.map((o) => {
      const p = o.plan_oficial;
      return [
        `<a href="#/obra/${o.id}">${esc(o.nombre)}</a>`,
        o.evidencia_hasta ? `${G.fLarga(o.evidencia_hasta)}<br><small>hace ${tiempoLegible(diasEntre(o.evidencia_hasta, hoyISO()))}</small>` : "—",
        o.dias_con_imagenes || "0",
        p ? `${G.fLarga(p.ejecucion_fin_previsto)}` : "No publicado",
        p ? `${num(p.avance_fisico)} %` : "No publicado",
        p ? `₡${num(p.costo_millones_crc)} millones` : "No publicado",
        o.fuentes.join(" + "),
      ];
    });

    main.innerHTML = `
      <h1>¿Cómo va la obra?</h1>
      <p class="bajada">Elija una obra pública para ver qué se está construyendo, si va según lo planeado y qué tan confiables son los datos. Cada dato indica de cuándo es y de dónde viene.</p>
      ${aviso("info", "Cómo leer las alertas", " Usamos tres niveles, siempre con ícono y texto: verde (al día), amarillo (atención) y rojo (problema). Nada de esta página desaparece solo.")}
      <ul class="obras">${tarjetas}</ul>
      <section class="tarjeta" aria-labelledby="t-comparar">
        <p class="pregunta">Comparar</p>
        <h2 id="t-comparar">Las obras lado a lado</h2>
        <p class="bajada">Lo que cada fuente pública dice hoy de cada obra. “No publicado” significa que lo buscamos y no existe en las fuentes abiertas.</p>
        <div class="comparar">${tablaHTML(["Obra", "Última imagen", "Días con imágenes", "Fin previsto", "Avance físico", "Costo", "Fuentes"], filas, [2])}</div>
        <p class="nota">Datos procesados el ${G.fLarga(fecha_corte)}. <a href="#/fuentes">Ver fuentes y método</a>.</p>
      </section>`;
  }

  /* =========================================================
     Vista: Escuela de Limoncito
     ========================================================= */
  async function vistaLimoncito() {
    const [{ obras, cruces }, L] = await Promise.all([cargar("obras"), cargar("limoncito")]);
    const o = obras.find((x) => x.id === "limoncito");
    const cruce = cruces.find((c) => c.obra === "limoncito");
    const conf = L.confiabilidad;
    const dias = L.dias;
    const f = frescura(o.evidencia_hasta);
    document.title = `ObraClara · ${o.nombre}`;

    // indicadores observables
    const conActividad = dias.filter((d) => d.con_actividad).length;
    const medPersonas = mediana(dias.filter((d) => d.personas_mediana != null).map((d) => d.personas_mediana));
    const diasGrua = dias.filter((d) => d.grua_torre).length;
    const ok = L.imagenes.filter((i) => i.analizable);
    const etapasCont = {};
    ok.forEach((i) => (i.etapas || []).forEach((e) => (etapasCont[e] = (etapasCont[e] || 0) + 1)));
    const ETAPAS = ["Movimiento de tierras", "Estructura de concreto", "Mampostería", "Cubierta", "Acabados interiores"];

    // semanas con presencia de etapas (para el mapa de calor)
    const semanas = L.semanas.map((w, j, arr) => {
      const ds = dias.filter((d) => d.fecha >= w.desde && d.fecha <= w.hasta);
      const presencia = {};
      ETAPAS.forEach((e) => (presencia[e] = ds.reduce((s, d) => s + (d.presencia_etapas[e] || 0), 0)));
      return { ...w, presencia, analizables: w.imagenes_analizables, mesNuevo: j > 0 && w.desde.slice(5, 7) !== arr[j - 1].desde.slice(5, 7) };
    });
    const primeraCubierta = semanas.find((w) => w.analizables && w.presencia["Cubierta"] / w.analizables >= 0.2);

    // maquinaria: dias con presencia
    const maqDias = {};
    dias.forEach((d) => Object.keys(d.maquinaria).forEach((m) => (maqDias[m] = (maqDias[m] || 0) + 1)));
    const maqItems = Object.entries(maqDias).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([m, n]) => ({ etiqueta: m, valor: n, tip: `<b>${m}</b><br>Vista en ${n} de ${dias.length} días con imágenes` }));

    const andamiosDias = new Set(L.imagenes.filter((i) => (i.estructuras_temporales || []).length).map((i) => i.fecha)).size;
    const confItems = [
      { etiqueta: "Imágenes que la IA pudo analizar", valor: pct(conf.imagenes_analizables, conf.imagenes_totales), color: "var(--serie-1)",
        tip: `${conf.imagenes_analizables} de ${conf.imagenes_totales} imágenes. Las demás tienen el error “Imagen no analizable”.` },
      { etiqueta: "Imágenes con visibilidad “Mala”", valor: pct(conf.imagenes_vis_mala, conf.imagenes_analizables), color: "var(--serie-2)",
        tip: `${conf.imagenes_vis_mala} de ${conf.imagenes_analizables} imágenes analizables. En ellas un conteo de 0 personas no se puede comprobar.` },
      { etiqueta: "Imágenes donde no se ve el equipo de protección", valor: pct(conf.epp_no_determinable, conf.imagenes_analizables), color: "var(--serie-2)",
        tip: `${conf.epp_no_determinable} imágenes con uso de casco “No determinable”.` },
      { etiqueta: "Imágenes sin etapa identificable", valor: pct(conf.imagenes_etapa_nd, conf.imagenes_analizables), color: "var(--serie-2)",
        tip: `${conf.imagenes_etapa_nd} imágenes con etapa vacía o “No determinable”.` },
      { etiqueta: "Días con etapas contradictorias", valor: pct(conf.dias_contradictorios, conf.dias), color: "var(--serie-2)",
        tip: `${conf.dias_contradictorios} de ${conf.dias} días: dos imágenes del mismo día indican etapas sin nada en común.` },
    ];

    main.innerHTML = `
      <p class="miga"><a href="#/">← Todas las obras</a></p>
      <section aria-labelledby="t-obra">
        <p class="pregunta">Qué se construye y dónde</p>
        <h1 id="t-obra">${esc(o.nombre)}</h1>
        <dl class="ficha-meta">
          <dt>Qué es</dt><dd>${esc(o.que_es)}</dd>
          <dt>Dónde</dt><dd>${esc(o.ubicacion)}</dd>
          <dt>Quién ejecuta</dt><dd>No publicado</dd>
          <dt>Evidencia</dt><dd>${num(o.imagenes)} imágenes de cámara, ${o.dias_con_imagenes} días hábiles (${G.fLarga(o.evidencia_desde)} – ${G.fLarga(o.evidencia_hasta)})</dd>
        </dl>
        ${aviso(f.nivel, `Estos datos tienen ${tiempoLegible(f.dias)}.`, ` La última imagen publicada es del ${fechaLarga(o.evidencia_hasta)}. Desde entonces no hay imágenes nuevas, así que nada de lo que sigue describe la obra hoy.`)}
      </section>

      <section class="tarjeta" aria-labelledby="t-plan">
        <p class="pregunta">¿Va según lo planeado?</p>
        <p class="respuesta" id="t-plan">No se puede saber con los datos públicos.</p>
        <p>Esta obra no tiene cronograma, plazo ni monto en MapaInversiones: la buscamos por nombre entre los ${cruce.proyectos_revisados} proyectos del cantón de Limón y no aparece. Sin un plan oficial no hay con qué comparar lo que muestran las cámaras. <strong>Lo que sí se puede observar entre enero y abril de 2026:</strong></p>
        <div class="cifras">
          <div class="cifra"><div class="valor">${conActividad}<small> de ${dias.length}</small></div><div class="etiqueta">días hábiles con trabajo visible (personas o maquinaria)</div></div>
          <div class="cifra"><div class="valor">${num(medPersonas)}</div><div class="etiqueta">personas por imagen en un día típico (mediana)</div></div>
          <div class="cifra"><div class="valor">${diasGrua}<small> días</small></div><div class="etiqueta">con grúa torre en el sitio</div></div>
          <div class="cifra"><div class="valor">${pct(etapasCont["Estructura de concreto"] || 0, ok.length)} %</div><div class="etiqueta">de las imágenes muestran estructura de concreto</div></div>
        </div>
        <p class="nota">Son señales de actividad, no de avance: más personas o máquinas no significa que la obra avance más rápido.</p>
      </section>

      <section class="tarjeta" aria-labelledby="t-etapas">
        <p class="pregunta">¿Qué se estuvo construyendo?</p>
        <h2 id="t-etapas">La estructura de concreto domina; la cubierta aparece ${primeraCubierta ? `desde la semana del ${G.fCorta(primeraCubierta.desde)}` : "poco"}</h2>
        <p class="bajada">Porcentaje de imágenes de cada semana en que la IA identificó cada etapa. Cuanto más intenso el azul, más imágenes (vea la escala). Los puntos naranjas marcan semanas con lecturas contradictorias.</p>
        <div id="g-etapas" class="grafico"></div>
        <ul class="leyenda" aria-label="Escala de color">
          <li><span class="muestra" style="background:var(--seq-0)"></span>0 %</li>
          <li><span class="muestra" style="background:var(--seq-1)"></span>menos de 10 %</li>
          <li><span class="muestra" style="background:var(--seq-3)"></span>30–55 %</li>
          <li><span class="muestra" style="background:var(--seq-5)"></span>80 % o más</li>
          <li><span class="muestra" style="background:var(--serie-2);border-radius:50%"></span>días con etapas contradictorias</li>
        </ul>
        ${detallesTabla("Ver los datos en tabla", tablaHTML(["Semana", ...ETAPAS, "Imágenes", "Días contradictorios"],
          semanas.map((w) => [`${G.fCorta(w.desde)}–${G.fCorta(w.hasta)}`, ...ETAPAS.map((e) => `${pct(w.presencia[e], w.analizables)} %`), w.analizables, w.dias_contradictorios]), [1, 2, 3, 4, 5, 6, 7]))}
      </section>

      <section class="tarjeta" aria-labelledby="t-personas">
        <p class="pregunta">¿Cuánta gente se vio trabajando?</p>
        <h2 id="t-personas">Entre 0 y ${Math.max(...dias.map((d) => d.personas_max ?? 0))} personas por imagen; el último dato es de abril</h2>
        <p class="bajada">Cada línea vertical va del mínimo al máximo de personas contadas en las 5 imágenes del día; el punto es la mediana. El tramo rayado es el tiempo sin imágenes hasta hoy.</p>
        <div id="g-personas" class="grafico"></div>
        <ul class="leyenda">
          <li><span class="muestra" style="background:var(--texto-3);opacity:.5;height:12px;width:4px"></span>rango del día</li>
          <li><span class="muestra" style="background:var(--serie-1);border-radius:50%;width:10px;height:10px"></span>mediana</li>
          <li><span class="muestra rayado"></span>sin imágenes</li>
        </ul>
        ${aviso("aviso", "Un 0 no siempre es un 0.", ` En ${conf.ceros_no_verificables} imágenes la IA contó 0 personas con visibilidad “Mala”: en esas fotos no se puede comprobar si había gente. Además, dIAra no marca sobre la imagen a quién contó.`)}
        ${detallesTabla("Ver los datos en tabla", tablaHTML(["Fecha", "Mínimo", "Mediana", "Máximo", "Imágenes analizables", "Visibilidad mala"],
          dias.map((d) => [G.fLarga(d.fecha), d.personas_min ?? "—", d.personas_mediana ?? "—", d.personas_max ?? "—", `${d.analizables} de ${d.imagenes}`, d.imagenes_vis_mala]), [1, 2, 3, 4, 5]))}
      </section>

      <section class="tarjeta" aria-labelledby="t-maq">
        <p class="pregunta">¿Qué maquinaria se vio?</p>
        <h2 id="t-maq">La grúa torre estuvo presente ${diasGrua} de ${dias.length} días</h2>
        <p class="bajada">Número de días en que cada máquina aparece en al menos una imagen.</p>
        <div id="g-maq" class="grafico"></div>
        <p class="nota">Los andamios metálicos (vistos en ${andamiosDias} días) no se cuentan como maquinaria: son estructuras temporales. El sitio original los clasifica como maquinaria.</p>
      </section>

      <section class="tarjeta" aria-labelledby="t-conf">
        <p class="pregunta">¿Qué tan confiables son estos datos?</p>
        <h2 id="t-conf">La IA analizó casi todas las imágenes, pero en muchas no se ve con claridad</h2>
        <p class="bajada">Porcentaje de imágenes (o días) con cada problema. Barras más largas en naranja indican más incertidumbre.</p>
        <div id="g-conf" class="grafico"></div>
        <p class="nota">Lo calculamos a partir de los propios datos de dIAra. El modelo no publica su margen de error, así que estos porcentajes son un mínimo de la incertidumbre real.</p>
      </section>

      <section class="tarjeta" id="explorar" aria-labelledby="t-explorar">
        <p class="pregunta">Compruébelo usted</p>
        <h2 id="t-explorar">Explore un día y compare la foto con lo que dice la IA</h2>
        <p class="bajada">Los días con imágenes tienen color según cuántas personas se vieron (vea la escala). Los fines de semana y los días sin imágenes no se pueden elegir. Un punto naranja marca un día con etapas contradictorias.</p>
        <div id="calendario" class="calendario"></div>
        <div id="visor" aria-live="polite"></div>
      </section>

      <section class="tarjeta" aria-labelledby="t-wa">
        <p class="pregunta">Recibir avisos</p>
        <h2 id="t-wa">Resumen semanal para WhatsApp</h2>
        <p class="bajada">Un mensaje corto que puede enviarse a un grupo de la comunidad. Elija la semana:</p>
        <label class="sr" for="sel-semana">Semana</label>
        <select id="sel-semana">${L.semanas.map((w, i) => `<option value="${i}"${i === L.semanas.length - 1 ? " selected" : ""}>Semana del ${G.fCorta(w.desde)} al ${G.fLarga(w.hasta)}</option>`).join("")}</select>
        <div id="wa"></div>
      </section>

      <section class="tarjeta" aria-labelledby="t-fuentes-obra">
        <p class="pregunta">De dónde salen estos datos</p>
        <h2 id="t-fuentes-obra">Fuentes</h2>
        <ul>
          <li>Imágenes y análisis por IA: <a href="${o.url_origen}" rel="noopener">obrapublica.info/limoncito</a> (CGR, proyecto dIAra). El manifiesto llama a la obra “${esc(o.nombre_alterno)}”; el portal la llama “Escuela de Limoncito”.</li>
          <li>Búsqueda de plan oficial: MapaInversiones (MIDEPLAN). ${esc(cruce.justificacion)}</li>
          <li>Limpieza aplicada: <a href="#/fuentes">ver la bitácora completa</a>.</li>
        </ul>
      </section>`;

    grafico("g-etapas", (c) => G.etapasPorSemana(c, semanas, ETAPAS));
    grafico("g-personas", (c) => G.personasPorDia(c, dias, hoyISO()));
    grafico("g-maq", (c) => G.barrasH(c, maqItems, { descripcion: "Barras: días con presencia de cada máquina", formato: (v) => `${v} días`, max: dias.length }));
    grafico("g-conf", (c) => G.barrasH(c, confItems, { descripcion: "Barras: porcentaje de imágenes o días con cada problema de calidad", formato: (v) => `${v} %`, max: 100, etiquetaAncho: 230 }));

    montarCalendario(L, o);
    const sel = document.getElementById("sel-semana");
    const pintarWA = () => {
      const w = L.semanas[+sel.value];
      document.getElementById("wa").innerHTML = bloqueWhatsApp(mensajeLimoncito(w, o, L.semanas.length - 1 === +sel.value));
    };
    sel.addEventListener("change", pintarWA);
    pintarWA();
  }

  function mensajeLimoncito(w, o, esUltima) {
    const dSin = diasEntre(o.evidencia_hasta, hoyISO());
    const lineas = [
      `🏗️ ObraClara · ${o.nombre} (${o.ubicacion})`,
      `Semana del ${G.fCorta(w.desde)} al ${G.fLarga(w.hasta)}`,
      "",
      `• Trabajo visible: ${w.dias_con_actividad} de ${w.dias_con_datos} días con imágenes`,
      `• Personas por imagen: ${w.personas_mediana_prom != null ? `alrededor de ${num(w.personas_mediana_prom)}` : "sin dato"}${w.personas_max != null ? ` (máximo ${w.personas_max})` : ""}`,
      `• Etapas que identificó la IA: ${w.etapas.length ? w.etapas.join(", ") : "no determinable"}`,
      `• Maquinaria más vista: ${w.maquinaria.length ? w.maquinaria.join(", ") : "ninguna"}`,
    ];
    const avisos = [];
    if (w.dias_contradictorios) avisos.push(`${w.dias_contradictorios} día(s) con etapas contradictorias`);
    if (w.imagenes_vis_mala) avisos.push(`${w.imagenes_vis_mala} de ${w.imagenes_analizables} imágenes con visibilidad mala`);
    if (avisos.length) lineas.push("", `⚠️ Calidad del dato: ${avisos.join("; ")}.`);
    if (esUltima || dSin > 30) lineas.push(`⏱️ Ojo: no hay imágenes nuevas desde el ${G.fLarga(o.evidencia_hasta)} (${tiempoLegible(dSin)}).`);
    lineas.push("", "Más personas o máquinas no significa más avance.", `Detalle y fuentes: ${urlBase()}#/obra/${o.id}`);
    return lineas.join("\n");
  }

  function bloqueWhatsApp(texto) {
    return `<p class="mensaje-wa" id="texto-wa">${esc(texto)}</p>
      <div class="acciones">
        <a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">Compartir por WhatsApp</a>
        <button type="button" class="btn" data-copiar>Copiar el texto</button>
      </div>
      <p class="nota" id="copiado" role="status"></p>`;
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copiar]");
    if (!b) return;
    const t = document.getElementById("texto-wa").textContent;
    const estado = document.getElementById("copiado");
    try { await navigator.clipboard.writeText(t); estado.textContent = "Texto copiado. Péguelo en WhatsApp o en otro canal."; }
    catch { estado.textContent = "No se pudo copiar automáticamente. Seleccione el texto y cópielo a mano."; }
  });

  /* "07:12 Cubierta · 12:04, 12:45 y 13:48 Estructura de concreto" */
  function agruparLecturas(imgs) {
    const grupos = new Map();
    imgs.filter((i) => i.etapas).forEach((i) => {
      const k = i.etapas.join(" + ");
      grupos.set(k, [...(grupos.get(k) || []), i.hora]);
    });
    const unir = (h) => (h.length > 1 ? `${h.slice(0, -1).join(", ")} y ${h[h.length - 1]}` : h[0]);
    return [...grupos].map(([k, h]) => `${unir(h)}: ${k}`).join(" · ");
  }

  /* ---------- calendario + visor de imagenes ---------- */
  function montarCalendario(L, o) {
    const porFecha = Object.fromEntries(L.dias.map((d) => [d.fecha, d]));
    const imgsPorFecha = {};
    L.imagenes.forEach((i) => (imgsPorFecha[i.fecha] = imgsPorFecha[i.fecha] || []).push(i));
    const fechas = L.dias.map((d) => d.fecha);
    const cont = document.getElementById("calendario");
    const nivel = (m) => (m == null ? 1 : m === 0 ? 1 : m <= 2 ? 2 : m <= 4 ? 3 : m <= 6 ? 4 : 5);
    const [a0, m0] = fechas[0].split("-").map(Number);
    const [a1, m1] = fechas[fechas.length - 1].split("-").map(Number);
    let html = "";
    for (let a = a0, m = m0; a < a1 || (a === a1 && m <= m1); m === 12 ? (a++, (m = 1)) : m++) {
      const primero = new Date(a, m - 1, 1);
      const nDias = new Date(a, m, 0).getDate();
      const desfase = (primero.getDay() + 6) % 7; // semana inicia lunes
      let celdas = ["L", "K", "M", "J", "V", "S", "D"].map((d) => `<span class="cab" aria-hidden="true">${d}</span>`).join("");
      celdas += "<span></span>".repeat(desfase);
      for (let d = 1; d <= nDias; d++) {
        const iso = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const info = porFecha[iso];
        const finde = [0, 6].includes(new Date(a, m - 1, d).getDay());
        if (info) {
          celdas += `<button type="button" class="dia con-datos n${nivel(info.personas_mediana)}${info.contradiccion_etapa ? " contradiccion" : ""}" data-fecha="${iso}" aria-pressed="false" aria-label="${fechaLarga(iso)}: mediana ${info.personas_mediana ?? "sin dato"} personas${info.contradiccion_etapa ? ", etapas contradictorias" : ""}">${d}</button>`;
        } else {
          celdas += `<span class="dia ${finde ? "" : "sin-datos"}" title="${finde ? "Fin de semana: no se toman imágenes" : "Día hábil sin imágenes publicadas"}">${d}</span>`;
        }
      }
      html += `<div class="mes"><h3>${G.MESES[m - 1]} ${a}</h3><div class="dias">${celdas}</div></div>`;
    }
    cont.innerHTML = html + `<ul class="leyenda" style="grid-column:1/-1">
      <li><span class="muestra" style="background:var(--seq-1)"></span>0 personas</li>
      <li><span class="muestra" style="background:var(--seq-3)"></span>3–4</li>
      <li><span class="muestra" style="background:var(--seq-5)"></span>7 o más (mediana)</li>
      <li><span class="muestra rayado"></span>día hábil sin imágenes</li></ul>`;

    let fechaSel = fechas[fechas.length - 1];
    let idxSel = 0;
    const visor = document.getElementById("visor");

    function pintar() {
      cont.querySelectorAll("[data-fecha]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fecha === fechaSel)));
      const imgs = imgsPorFecha[fechaSel] || [];
      const dia = porFecha[fechaSel];
      const it = imgs[idxSel] || imgs[0];
      const pos = fechas.indexOf(fechaSel);
      const url = (i) => L.url_imagenes + i.archivo_imagen;
      const contradiccion = dia.contradiccion_etapa
        ? aviso("aviso", "Lecturas contradictorias este día.", ` La IA indicó etapas distintas en el mismo día: ${agruparLecturas(imgs)}. Tómelo con cautela.`)
        : "";
      let lectura;
      if (!it.analizable) {
        lectura = aviso("aviso", "La IA no pudo analizar esta imagen.", ` Mensaje del sistema: “${esc(it.error)}”. Ningún dato de esta foto se usa en los gráficos.`);
      } else {
        const nd = (v) => v ?? "No se puede ver";
        lectura = `<dl>
          <dt>Personas</dt><dd><strong>${it.personas ?? "—"}</strong>${it.cero_no_verificable ? " · <em>no verificable (visibilidad mala)</em>" : ""}</dd>
          <dt>Etapa</dt><dd>${it.etapas ? esc(it.etapas.join(", ")) : "No determinable"}</dd>
          <dt>Actividad</dt><dd>${esc(it.actividad ?? "No determinable")}</dd>
          <dt>Maquinaria</dt><dd>${it.maquinaria ? esc(it.maquinaria.join(", ")) : "Ninguna detectada"}${it.estructuras_temporales ? `<br><small>Además: ${esc(it.estructuras_temporales.join(", "))}</small>` : ""}</dd>
          <dt>Clima</dt><dd>${esc(nd(it.clima))} · visibilidad ${esc((it.visibilidad || "no indicada").toLowerCase())}</dd>
          <dt>Protección</dt><dd>Casco: ${esc(nd(it.casco))} · Chaleco: ${esc(nd(it.chaleco))}<br>Arnés: ${esc(nd(it.arnes))} · Barandas: ${esc(nd(it.barandas))}</dd>
        </dl>`;
      }
      visor.innerHTML = `
        <div class="nav-dias">
          <button type="button" class="btn" data-mover="-1" ${pos <= 0 ? "disabled" : ""} aria-label="Día anterior con imágenes">←</button>
          <strong style="text-align:center">${fechaLarga(fechaSel)}</strong>
          <button type="button" class="btn" data-mover="1" ${pos >= fechas.length - 1 ? "disabled" : ""} aria-label="Día siguiente con imágenes">→</button>
        </div>
        ${contradiccion}
        <div class="visor">
          <div>
            <div class="foto">
              <img src="${url(it)}" alt="Foto de la obra tomada el ${fechaLarga(fechaSel)} a las ${it.hora}">
              <span class="sello">${G.fLarga(fechaSel)} · ${it.hora}</span>
            </div>
            <div class="miniaturas" role="group" aria-label="Imágenes del día">
              ${imgs.map((i, k) => `<button type="button" data-img="${k}" aria-pressed="${i === it}" aria-label="Imagen de las ${i.hora}${i.analizable ? "" : " (no analizable)"}"><img src="${url(i)}" alt="" loading="lazy"><span>${i.hora}${i.analizable ? "" : " ⚠"}</span></button>`).join("")}
            </div>
          </div>
          <div class="lectura">
            <h3>Lo que dice la IA de esta foto</h3>
            ${lectura}
            <p class="nota">dIAra no marca sobre la foto a quién o qué detectó, ni con cuánta seguridad. Compare usted mismo.</p>
            ${dia.resumen_ia ? `<details><summary>Resumen del día escrito por la IA</summary><p class="nota" style="color:var(--texto-2)">${esc(dia.resumen_ia)}</p></details>` : ""}
            <p class="nota"><a href="${o.url_origen}" rel="noopener">Ver en obrapublica.info</a></p>
          </div>
        </div>`;
      const foto = visor.querySelector(".foto img");
      foto.addEventListener("error", () => {
        foto.parentElement.insertAdjacentHTML("afterbegin", '<p class="falla">La imagen no está disponible en el servidor de origen en este momento.</p>');
      });
    }

    cont.addEventListener("click", (e) => {
      const b = e.target.closest("[data-fecha]");
      if (!b) return;
      fechaSel = b.dataset.fecha; idxSel = 0; pintar();
      if (window.innerWidth < 720) visor.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
    visor.addEventListener("click", (e) => {
      const mv = e.target.closest("[data-mover]");
      if (mv && !mv.disabled) { fechaSel = fechas[fechas.indexOf(fechaSel) + +mv.dataset.mover]; idxSel = 0; pintar(); return; }
      const im = e.target.closest("[data-img]");
      if (im) { idxSel = +im.dataset.img; pintar(); visor.querySelector(`[data-img="${idxSel}"]`)?.focus(); }
    });
    pintar();
  }

  /* =========================================================
     Vista: Taras - La Lima
     ========================================================= */
  async function vistaTaras() {
    const [{ obras, cruces }, T] = await Promise.all([cargar("obras"), cargar("taras")]);
    const o = obras.find((x) => x.id === "taras-la-lima");
    const p = o.plan_oficial;
    const mi = T.mideplan;
    const d = T.diara;
    const cruce = cruces.find((c) => c.obra === "taras-la-lima");
    document.title = `ObraClara · ${o.nombre}`;
    const hoy = hoyISO();
    const vencido = hoy > p.ejecucion_fin_previsto;
    const mesesAtraso = Math.round(diasEntre(p.ejecucion_fin_previsto, hoy) / 30.44);
    const plazoTotal = diasEntre(p.ejecucion_inicio, p.ejecucion_fin_previsto);
    const plazoPct = Math.round((100 * diasEntre(p.ejecucion_inicio, hoy)) / plazoTotal);
    const f = frescura(o.evidencia_hasta);

    const filasPlazo = [
      { etiqueta: "Plazo de construcción transcurrido", valor: plazoPct, color: "var(--critico)",
        texto: vencido ? `${plazoPct} % del plazo · vencido` : `${plazoPct} %`,
        tip: `<b>Plazo</b><br>Construcción prevista del ${G.fLarga(p.ejecucion_inicio)} al ${G.fLarga(p.ejecucion_fin_previsto)}.${vencido ? `<br>Han pasado ${mesesAtraso} meses desde la fecha de fin.` : ""}` },
      { etiqueta: "Avance físico reportado", valor: p.avance_fisico, color: "var(--serie-1)", texto: `${num(p.avance_fisico)} %`,
        tip: `<b>Avance físico</b><br>${num(p.avance_fisico)} % según la fase “En ejecución”. El encabezado de la ficha dice ${num(p.avance_fisico_encabezado, 2)} %. Fecha de medición: no publicada.` },
      { etiqueta: "Avance financiero (dinero gastado)", valor: p.avance_financiero, color: "var(--serie-3)", texto: `${num(p.avance_financiero, 1)} %`,
        tip: `<b>Avance financiero</b><br>${num(p.avance_financiero, 2)} % del costo. Es dinero gastado, no obra terminada.` },
    ];

    main.innerHTML = `
      <p class="miga"><a href="#/">← Todas las obras</a></p>
      <section aria-labelledby="t-obra">
        <p class="pregunta">Qué se construye y dónde</p>
        <h1 id="t-obra">${esc(o.nombre)}</h1>
        <dl class="ficha-meta">
          <dt>Qué es</dt><dd>${esc(o.que_es)}</dd>
          <dt>Dónde</dt><dd>${esc(o.ubicacion)} · Ruta Nacional 2</dd>
          <dt>Quién ejecuta</dt><dd>${esc(o.ejecutor)}</dd>
          <dt>Costo estimado</dt><dd>₡${num(p.costo_millones_crc)} millones</dd>
          <dt>Código BPIP</dt><dd>${esc(mi.codigo_bpip)}</dd>
        </dl>
      </section>

      <section class="tarjeta" aria-labelledby="t-plan">
        <p class="pregunta">¿Va según lo planeado?</p>
        <p class="respuesta" id="t-plan">${vencido ? `No. La construcción debía terminar el ${G.fLarga(p.ejecucion_fin_previsto)} y el avance físico reportado es ${num(p.avance_fisico)} %.` : `El plazo sigue vigente; avance físico reportado ${num(p.avance_fisico)} %.`}</p>
        <div id="g-plazo" class="grafico"></div>
        ${aviso("aviso", "No sabemos de cuándo es el 54 %.", ` MapaInversiones no publica la fecha en que se midió el avance físico. Si la medición es antigua, el avance real hoy puede ser mayor. Lo que sí es seguro: el plazo venció hace ${mesesAtraso} meses y la obra sigue “En ejecución”.`)}
        ${detallesTabla("Ver los datos en tabla", tablaHTML(["Indicador", "Valor", "Fuente"], [
          ["Plazo transcurrido", `${plazoPct} %`, `Cálculo propio: días desde ${G.fLarga(p.ejecucion_inicio)} / días hasta ${G.fLarga(p.ejecucion_fin_previsto)}`],
          ["Avance físico (fase)", `${num(p.avance_fisico, 2)} %`, "MapaInversiones, fase “En ejecución”"],
          ["Avance físico (encabezado)", `${num(p.avance_fisico_encabezado, 2)} %`, "MapaInversiones, encabezado de la ficha"],
          ["Avance financiero", `${num(p.avance_financiero, 2)} %`, "MapaInversiones"],
        ], [1]))}
      </section>

      <section class="tarjeta" aria-labelledby="t-hitos">
        <p class="pregunta">Hitos y plazos</p>
        <h2 id="t-hitos">Las tres fases previas se completaron; la construcción pasó su fecha de fin</h2>
        <p class="bajada">Fechas previstas de cada fase según MIDEPLAN. El tramo rayado con borde rojo es el tiempo transcurrido después del fin previsto.</p>
        <div id="g-gantt" class="grafico"></div>
        <ul class="leyenda">
          <li><span class="muestra" style="background:var(--seq-2)"></span>fase completada</li>
          <li><span class="muestra" style="background:var(--serie-1)"></span>fase en curso</li>
          <li><span class="muestra rayado" style="border-color:var(--critico)"></span>fuera de plazo</li>
        </ul>
        ${aviso("aviso", "La ficha da tres fechas de fin distintas.", ` El objetivo habla del año 2021, la “Fecha de finalización” dice ${esc(mi.anio_fin_previsto)} y la fase de construcción termina el ${G.fLarga(p.ejecucion_fin_previsto)}. Usamos la más tardía, la más favorable para la obra.`)}
        ${detallesTabla("Ver los datos en tabla", tablaHTML(["Fase", "Inicio", "Fin previsto", "Avance"], mi.fases.map((x) => [x.fase, G.fLarga(x.inicio), G.fLarga(x.fin_previsto), `${num(x.porcentaje)} %`]), [3]))}
      </section>

      <section class="tarjeta" aria-labelledby="t-entrega">
        <p class="pregunta">Qué se va a entregar</p>
        <h2 id="t-entrega">Productos comprometidos</h2>
        <ul>${mi.productos.map((x) => `<li>${esc(x.replace(/^[a-d]\)\s*/, ""))}</li>`).join("")}</ul>
      </section>

      <section class="tarjeta" aria-labelledby="t-campo">
        <p class="pregunta">Qué muestran las cámaras de dIAra</p>
        <h2 id="t-campo">Solo hay 5 días de imágenes, de junio y julio de 2024</h2>
        ${aviso(f.nivel, `Evidencia de hace ${tiempoLegible(f.dias)}.`, " No sirve para saber cómo está la obra hoy. La mostramos para que se vea qué tipo de dato existe.")}
        <p class="bajada">Promedio de detecciones por imagen en cada día (unas 310 imágenes por día). Ordenado por fecha; el tablero original lo mostraba desordenado.</p>
        <div id="g-lineas" class="grafico"></div>
        <ul class="leyenda">
          <li><span class="muestra linea" style="background:var(--serie-1)"></span>Personas</li>
          <li><span class="muestra linea" style="background:var(--serie-2)"></span>Tractores</li>
          <li><span class="muestra linea" style="background:var(--serie-3)"></span>Aplanadoras</li>
        </ul>
        ${aviso("aviso", "El tablero original no coincide con sus propios datos.", ` Cita máximos y mínimos de días que no publica (${d.fechas_citadas_ausentes.map(G.fCorta).join(", ")}) y su promedio de personas (${num(d.contraste.personas.promedio_publicado, 2)}) no sale de los 5 días publicados (${num(d.contraste.personas.promedio_de_la_serie, 2)}). Por eso no mostramos esos resúmenes.`)}
        ${detallesTabla("Ver los datos en tabla", tablaHTML(["Fecha", "Personas", "Tractores", "Aplanadoras", "Imágenes"], d.serie.map((x) => [G.fLarga(x.fecha), num(x.personas, 2), num(x.tractores, 2), num(x.aplanadoras, 2), x.imagenes]), [1, 2, 3, 4]))}
      </section>

      <section class="tarjeta" aria-labelledby="t-wa">
        <p class="pregunta">Recibir avisos</p>
        <h2 id="t-wa">Alerta para WhatsApp</h2>
        <div id="wa"></div>
      </section>

      <section class="tarjeta">
        <p class="pregunta">De dónde salen estos datos</p>
        <h2>Fuentes</h2>
        <ul>
          <li>Plan, costo y avance: <a href="${mi.url}" rel="noopener">MapaInversiones, proyecto 18394</a> (MIDEPLAN).</li>
          <li>Imágenes y conteos: <a href="${o.url_origen}" rel="noopener">tablero Taras–La Lima</a> en obrapublica.info (CGR, dIAra).</li>
          <li>Cómo unimos ambas fuentes: ${esc(cruce.justificacion)} Confianza del cruce: ${esc(cruce.confianza.toLowerCase())}.</li>
        </ul>
      </section>`;

    grafico("g-plazo", (c) => G.plazoVsAvance(c, filasPlazo));
    grafico("g-gantt", (c) => G.gantt(c, mi.fases, hoy));
    grafico("g-lineas", (c) => G.lineas(c, d.serie, [
      { clave: "personas", nombre: "Personas", color: "var(--serie-1)" },
      { clave: "tractores", nombre: "Tractores", color: "var(--serie-2)" },
      { clave: "aplanadoras", nombre: "Aplanadoras", color: "var(--serie-3)" },
    ], { descripcion: "Líneas: promedio diario de personas, tractores y aplanadoras detectados, del 25 de junio al 1 de julio de 2024" }));

    const msg = [
      `🚧 ObraClara · ${o.nombre} (${o.ubicacion})`,
      "",
      vencido ? `🔴 Fuera de plazo: la construcción debía terminar el ${G.fLarga(p.ejecucion_fin_previsto)} (hace ${mesesAtraso} meses).` : `Plazo vigente hasta el ${G.fLarga(p.ejecucion_fin_previsto)}.`,
      `• Avance físico reportado: ${num(p.avance_fisico)} % (MIDEPLAN no indica la fecha de esa medición)`,
      `• Dinero gastado: ${num(p.avance_financiero, 1)} % de ₡${num(p.costo_millones_crc)} millones`,
      `• Imágenes de cámara: las últimas son del ${G.fLarga(o.evidencia_hasta)}`,
      "",
      `Detalle y fuentes: ${urlBase()}#/obra/${o.id}`,
    ].join("\n");
    document.getElementById("wa").innerHTML = bloqueWhatsApp(msg);
  }

  /* =========================================================
     Vista: Puente Circunvalacion (sin datos)
     ========================================================= */
  async function vistaCircunvalacion() {
    const { obras, cruces } = await cargar("obras");
    const o = obras.find((x) => x.id === "puente-circunvalacion");
    const c = cruces.find((x) => x.obra === "puente-circunvalacion");
    document.title = `ObraClara · ${o.nombre}`;
    main.innerHTML = `
      <p class="miga"><a href="#/">← Todas las obras</a></p>
      <p class="pregunta">Qué se construye y dónde</p>
      <h1>${esc(o.nombre)}</h1>
      <p class="bajada">${esc(o.que_es)}. ${esc(o.ubicacion)}.</p>
      ${aviso("critico", "No hay datos publicados de esta obra.", " En obrapublica.info aparece en el mapa, pero su tablero está vacío y no hay imágenes ni conteos. Preferimos decirlo antes que mostrar una página en blanco.")}
      <section class="tarjeta">
        <p class="pregunta">¿Es alguno de estos proyectos?</p>
        <h2>Posibles coincidencias en MapaInversiones</h2>
        <p class="bajada">${esc(c.metodo)}. ${esc(c.justificacion)}</p>
        ${tablaHTML(["Proyecto", "Nombre"], c.candidatos.map((x) => [`<a href="https://rendircuentas.mideplan.go.cr/proyecto/perfilproyecto/${x.id}" rel="noopener">${x.id}</a>`, esc(x.nombre)]))}
        <p class="nota">Para confirmar el cruce se necesita que la CGR publique el código BPIP o la ubicación exacta de la obra.</p>
      </section>`;
  }

  /* =========================================================
     Vista: fuentes y metodo
     ========================================================= */
  async function vistaFuentes() {
    const [P, { fecha_corte }] = await Promise.all([cargar("procedencia"), cargar("obras")]);
    document.title = "ObraClara · Fuentes y método";
    const arch = P.descargas.archivos;
    const porFuente = {};
    arch.forEach((a) => {
      const f = (porFuente[a.fuente] = porFuente[a.fuente] || { n: 0, bytes: 0, ultima: "" });
      f.n++; f.bytes += a.bytes; if (a.descargado > f.ultima) f.ultima = a.descargado;
    });
    main.innerHTML = `
      <h1>Fuentes y método</h1>
      <p class="bajada">Todo lo que muestra ObraClara sale de datos públicos, descargados y procesados con un programa que cualquier persona puede volver a ejecutar. Aquí está el registro.</p>

      <section class="tarjeta">
        <p class="pregunta">1 · De dónde salen los datos</p>
        <h2>Fuentes consultadas</h2>
        ${tablaHTML(["Fuente", "Archivos", "Tamaño", "Última descarga"], Object.entries(porFuente).map(([k, v]) => [esc(k), v.n, `${num(v.bytes / 1024)} KB`, v.ultima.replace("T", " ").slice(0, 16)]), [1, 2])}
        <p class="nota">Cada archivo crudo se guarda sin cambios, con su URL, fecha y hora de descarga, estado HTTP y huella SHA-256 (para detectar si la fuente cambió). Datos procesados el ${G.fLarga(fecha_corte)}.</p>
        ${detallesTabla(`Ver los ${arch.length} archivos descargados`, tablaHTML(["Archivo", "Descargado", "Bytes", "SHA-256"], arch.map((a) => [`<a href="${a.url}" rel="noopener">${esc(a.archivo)}</a>`, a.descargado.slice(0, 16).replace("T", " "), num(a.bytes), `<code>${a.sha256.slice(0, 12)}…</code>`]), [2]))}
      </section>

      <section class="tarjeta">
        <p class="pregunta">2 · Cómo se limpiaron</p>
        <h2>Bitácora de limpieza y transformación</h2>
        <p class="bajada">Ninguna corrección se hace a mano. Cada regla queda registrada con el número de registros que cambió. Las inconsistencias se marcan, no se esconden.</p>
        ${tablaHTML(["Fuente", "Regla", "Registros", "Detalle"], P.bitacora.map((b) => [esc(b.etapa), esc(b.regla), b.registros_afectados ?? "", esc(b.detalle || "")]), [2])}
      </section>

      <section class="tarjeta">
        <p class="pregunta">3 · Cómo se unieron</p>
        <h2>Cruce entre la evidencia de campo y el plan oficial</h2>
        <p class="bajada">dIAra muestra lo que se ve en la obra y MapaInversiones lo que dice el plan. No comparten un identificador, así que el cruce se hace por nombre y ubicación, y se declara la confianza.</p>
        ${tablaHTML(["Obra", "Método", "Decisión", "Confianza"], P.cruces.map((c) => [esc(c.obra), esc(c.metodo), `<strong>${esc(c.decision)}.</strong> ${esc(c.justificacion)}`, esc(c.confianza)]))}
      </section>

      <section class="tarjeta">
        <p class="pregunta">4 · Lo que no se puede saber</p>
        <h2>Limitaciones</h2>
        <ul>
          <li>dIAra no publica dónde detectó a cada persona o máquina ni con cuánta seguridad; por eso no podemos marcar las detecciones sobre la foto.</li>
          <li>El archivo que usa el chatbot de obrapublica.info (<code>predictions_final.csv</code>) no se puede descargar.</li>
          <li>MapaInversiones no publica la fecha de corte del avance físico ni un cronograma por actividades.</li>
          <li>La Escuela de Limoncito no tiene plan público: no se puede calcular un atraso.</li>
          <li>Los indicadores de actividad (personas, maquinaria) no miden avance físico.</li>
        </ul>
      </section>

      <section class="tarjeta">
        <p class="pregunta">5 · Cómo se actualiza</p>
        <h2>Actualización automática</h2>
        <p>El programa <code>pipeline/ejecutar.py</code> descarga las fuentes, aplica la limpieza, integra y regenera estos archivos. Un flujo de GitHub Actions lo ejecuta cada lunes y publica los cambios; si una fuente cambia, su huella SHA-256 cambia y queda en el historial.</p>
      </section>`;
  }

  /* ---------------- enrutador ---------------- */
  const RUTAS = {
    "": vistaInicio,
    "obra/limoncito": vistaLimoncito,
    "obra/taras-la-lima": vistaTaras,
    "obra/puente-circunvalacion": vistaCircunvalacion,
    fuentes: vistaFuentes,
  };
  async function navegar() {
    const ruta = location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
    const vista = RUTAS[ruta] || vistaInicio;
    redibujar = [];
    document.querySelectorAll(".barra nav a").forEach((a) => {
      const r = a.getAttribute("href").replace(/^#\/?/, "");
      a.toggleAttribute("aria-current", r === ruta || (r === "" && ruta.startsWith("obra")));
      if (a.hasAttribute("aria-current")) a.setAttribute("aria-current", "page");
    });
    try {
      await vista();
    } catch (e) {
      console.error(e);
      main.innerHTML = aviso("critico", "No se pudieron cargar los datos.", ` ${esc(e.message)}. Si abrió el archivo directamente, sírvalo con un servidor web (vea el README).`);
    }
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", navegar);
  let tRes;
  window.addEventListener("resize", () => { clearTimeout(tRes); tRes = setTimeout(() => redibujar.forEach((f) => f()), 150); });

  /* texto grande (preferencia local, opcional) */
  const btnTexto = document.getElementById("btn-texto");
  const aplicarTexto = (on) => { document.documentElement.classList.toggle("texto-grande", on); btnTexto.setAttribute("aria-pressed", String(on)); };
  try { aplicarTexto(localStorage.getItem("obraclara-texto") === "1"); } catch { /* sin almacenamiento */ }
  btnTexto.addEventListener("click", () => {
    const on = btnTexto.getAttribute("aria-pressed") !== "true";
    aplicarTexto(on);
    try { localStorage.setItem("obraclara-texto", on ? "1" : "0"); } catch { /* sin almacenamiento */ }
    redibujar.forEach((f) => f());
  });

  navegar();
})();

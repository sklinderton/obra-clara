/* ObraClara - graficos en SVG sin dependencias.
   Reglas aplicadas (Cairo 2013; Cleveland y McGill): posicion sobre escala
   comun antes que area o angulo, un solo eje, orden cronologico, marcas
   finas, rejilla tenue, etiquetas selectivas, tooltip en cada marca y
   siempre una tabla con los datos. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs = {}, hijos = []) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
    for (const h of [].concat(hijos)) if (h != null) n.appendChild(typeof h === "string" ? document.createTextNode(h) : h);
    return n;
  }

  function lienzo(cont, alto, etiqueta) {
    cont.innerHTML = "";
    const ancho = Math.max(280, Math.round(cont.clientWidth || 600));
    const s = el("svg", { viewBox: `0 0 ${ancho} ${alto}`, role: "img", "aria-label": etiqueta });
    cont.appendChild(s);
    return { s, ancho, alto };
  }

  function rayado(s, id) {
    const p = el("pattern", { id, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
      [el("rect", { width: 6, height: 6, fill: "var(--superficie-2)" }), el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "var(--texto-3)", "stroke-width": 1.5, "stroke-opacity": .55 })]);
    s.appendChild(el("defs", {}, p));
    return `url(#${id})`;
  }

  /* ---------- tooltip compartido (raton, teclado y toque) ---------- */
  const tip = () => document.getElementById("tooltip");
  function mostrarTip(html, x, y) {
    const t = tip();
    t.innerHTML = html;
    t.hidden = false;
    const r = t.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    t.style.left = Math.max(8, left) + "px";
    t.style.top = Math.max(8, top) + "px";
  }
  function ocultarTip() { tip().hidden = true; }
  function conTip(nodo, html) {
    nodo.setAttribute("tabindex", "0");
    nodo.style.cursor = "pointer";
    nodo.addEventListener("pointermove", (e) => mostrarTip(html, e.clientX, e.clientY));
    nodo.addEventListener("pointerleave", ocultarTip);
    nodo.addEventListener("focus", () => { const r = nodo.getBoundingClientRect(); mostrarTip(html, r.right, r.top); });
    nodo.addEventListener("blur", ocultarTip);
    return nodo;
  }
  window.addEventListener("scroll", ocultarTip, { passive: true });

  /* ---------- escalas ---------- */
  const lineal = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
  function ticksLimpios(max, n = 4) {
    const paso0 = max / n;
    const mag = Math.pow(10, Math.floor(Math.log10(paso0 || 1)));
    const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= paso0) || mag;
    const out = [];
    for (let v = 0; v <= max + 1e-9; v += paso) out.push(+v.toFixed(6));
    if (out[out.length - 1] < max) out.push(out[out.length - 1] + paso);
    return out;
  }
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
  const fCorta = (iso) => { const [a, m, d] = iso.split("-"); return `${+d} ${MESES[+m - 1]}`; };
  const fLarga = (iso) => { const [a, m, d] = iso.split("-"); return `${+d} ${MESES[+m - 1]} ${a}`; };

  /* =================================================================
     1. Etapas observadas por semana (mapa de calor, escala secuencial)
     ================================================================= */
  function etapasPorSemana(cont, semanas, etapas, opciones = {}) {
    const filas = etapas.length;
    const izq = Math.min(150, Math.max(104, (cont.clientWidth || 600) * 0.28));
    const celdaH = 32, top = 22, abajo = 48;
    const { s, ancho } = lienzo(cont, top + filas * celdaH + abajo,
      "Mapa de calor: porcentaje de imágenes de cada semana que mencionan cada etapa constructiva.");
    const n = semanas.length;
    const celdaW = (ancho - izq - 4) / n;
    const pasos = ["var(--seq-0)", "var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"];
    const nivel = (p) => (p === 0 ? 0 : p < 0.1 ? 1 : p < 0.3 ? 2 : p < 0.55 ? 3 : p < 0.8 ? 4 : 5);

    etapas.forEach((e, i) => {
      const lineasE = partir(e, Math.floor((izq - 10) / 6.6));
      lineasE.forEach((ln, k) => s.appendChild(el("text", {
        x: izq - 8, y: top + i * celdaH + celdaH / 2 + 4 + (k - (lineasE.length - 1) / 2) * 12, "text-anchor": "end",
      }, ln)));
    });
    semanas.forEach((w, j) => {
      const x = izq + j * celdaW;
      etapas.forEach((e, i) => {
        const p = w.analizables ? (w.presencia[e] || 0) / w.analizables : 0;
        const r = el("rect", {
          x: x + 1, y: top + i * celdaH + 1, width: Math.max(1, celdaW - 2), height: celdaH - 2, rx: 3,
          fill: pasos[nivel(p)],
        });
        conTip(r, `<b>${e}</b><br>Semana del ${fCorta(w.desde)} al ${fCorta(w.hasta)}<br>${w.presencia[e] || 0} de ${w.analizables} imágenes analizables la mencionan (${Math.round(p * 100)} %)`);
        s.appendChild(r);
      });
      // marca de contradicciones bajo la columna
      if (w.dias_contradictorios > 0) {
        const cy = top + filas * celdaH + 10;
        const c = el("circle", { cx: x + celdaW / 2, cy, r: Math.min(5, 2.5 + w.dias_contradictorios), fill: "var(--serie-2)", stroke: "var(--superficie)", "stroke-width": 2 });
        conTip(c, `<b>Lecturas contradictorias</b><br>${w.dias_contradictorios} día(s) de esta semana tienen imágenes con etapas sin nada en común.`);
        s.appendChild(c);
      }
      if (j === 0 || w.mesNuevo) {
        s.appendChild(el("text", { x: x + 1, y: top + filas * celdaH + 34, class: "t-suave" }, MESES[+w.desde.slice(5, 7) - 1]));
      }
    });
    s.appendChild(el("text", { x: izq - 8, y: top + filas * celdaH + 14, "text-anchor": "end", class: "t-suave" }, "Contradicciones"));
    s.appendChild(el("text", { x: izq, y: 14, class: "t-suave" }, "Cada columna es una semana →"));
  }

  /* =================================================================
     2. Personas observadas por dia: rango (min-max) y mediana, con el
        periodo sin imagenes como tramo rayado al final (eje cortado)
     ================================================================= */
  function personasPorDia(cont, dias, hoyISO) {
    const alto = 230;
    const { s, ancho } = lienzo(cont, alto, "Gráfico de rango: personas observadas por día, mínimo, mediana y máximo, del 1 de enero al 17 de abril de 2026, seguido de un tramo sin imágenes hasta hoy.");
    const m = { t: 16, r: 8, b: 40, l: 30 };
    const anchoHueco = Math.max(64, ancho * 0.18);
    const xFin = ancho - m.r - anchoHueco - 10;
    const maxY = Math.max(...dias.map((d) => d.personas_max ?? 0));
    const ticks = ticksLimpios(maxY, 4);
    const y = lineal(0, ticks[ticks.length - 1], alto - m.b, m.t);
    const x = lineal(0, dias.length - 1, m.l + 6, xFin);
    const pat = rayado(s, "sin-datos-personas");

    ticks.forEach((t) => {
      s.appendChild(el("line", { x1: m.l, x2: xFin + 4, y1: y(t), y2: y(t), class: t === 0 ? "eje" : "rejilla" }));
      s.appendChild(el("text", { x: m.l - 6, y: y(t) + 4, "text-anchor": "end" }, String(t)));
    });
    let mesPrevio = "";
    dias.forEach((d, i) => {
      const mes = d.fecha.slice(5, 7);
      if (mes !== mesPrevio) {
        s.appendChild(el("text", { x: x(i), y: alto - m.b + 18, class: "t-suave" }, MESES[+mes - 1]));
        mesPrevio = mes;
      }
      if (d.personas_max == null) return;
      const g = el("g");
      g.appendChild(el("line", { x1: x(i), x2: x(i), y1: y(d.personas_min), y2: y(d.personas_max), stroke: "var(--texto-3)", "stroke-opacity": .5, "stroke-width": 3, "stroke-linecap": "round" }));
      g.appendChild(el("circle", { cx: x(i), cy: y(d.personas_mediana), r: 3.5, fill: "var(--serie-1)", stroke: "var(--superficie)", "stroke-width": 1.5 }));
      const hit = el("rect", { x: x(i) - 4, y: m.t, width: 8, height: alto - m.b - m.t, fill: "transparent" });
      const nv = d.imagenes_vis_mala ? `<br>${d.imagenes_vis_mala} imagen(es) con visibilidad mala` : "";
      conTip(hit, `<b>${fLarga(d.fecha)}</b><br>Mediana: ${d.personas_mediana} · rango ${d.personas_min}–${d.personas_max}<br>${d.analizables} de ${d.imagenes} imágenes analizables${nv}`);
      g.appendChild(hit);
      s.appendChild(g);
    });
    // tramo sin datos
    const ultimo = dias[dias.length - 1].fecha;
    const diasSin = Math.round((new Date(hoyISO) - new Date(ultimo)) / 864e5);
    const hx = xFin + 14;
    s.appendChild(el("path", { d: `M${xFin + 6},${alto - m.b + 4} l4,-8 l4,8`, stroke: "var(--texto-3)", fill: "none" }));
    const hueco = el("rect", { x: hx, y: m.t, width: anchoHueco, height: alto - m.b - m.t, fill: pat, rx: 4 });
    conTip(hueco, `<b>Sin imágenes</b><br>Del ${fLarga(ultimo)} a hoy no se publicaron imágenes nuevas (${diasSin} días). Eje cortado: este tramo no está a escala.`);
    s.appendChild(hueco);
    s.appendChild(el("text", { x: hx + anchoHueco / 2, y: m.t + 22, "text-anchor": "middle", class: "t-fuerte" }, `${diasSin} días`));
    s.appendChild(el("text", { x: hx + anchoHueco / 2, y: m.t + 38, "text-anchor": "middle" }, "sin imágenes"));
    s.appendChild(el("text", { x: hx, y: alto - m.b + 18, class: "t-suave" }, "hasta hoy"));
    s.appendChild(el("text", { x: m.l, y: alto - 4, class: "t-suave" }, "Personas por imagen (5 imágenes por día hábil)"));
  }

  /* =================================================================
     3. Barras horizontales con valor en la punta (una sola serie)
     ================================================================= */
  function barrasH(cont, items, opc = {}) {
    const fila = 34, top = 4;
    const etiquetaAncho = Math.min(opc.etiquetaAncho || 190, (cont.clientWidth || 600) * 0.48);
    const { s, ancho } = lienzo(cont, top + items.length * fila + 4, opc.descripcion || "Gráfico de barras horizontales");
    const max = opc.max ?? Math.max(...items.map((d) => d.valor));
    const x = lineal(0, max, etiquetaAncho, ancho - 54);
    items.forEach((d, i) => {
      const yc = top + i * fila + fila / 2;
      const lineas = partir(d.etiqueta, Math.floor(etiquetaAncho / 7.2));
      lineas.forEach((ln, k) => s.appendChild(el("text", { x: etiquetaAncho - 10, y: yc + 4 + (k - (lineas.length - 1) / 2) * 13, "text-anchor": "end" }, ln)));
      s.appendChild(el("rect", { x: etiquetaAncho, y: yc - 9, width: ancho - 54 - etiquetaAncho, height: 18, fill: "var(--superficie-2)", rx: 4 }));
      const w = Math.max(2, x(d.valor) - etiquetaAncho);
      const b = el("path", { d: barraRedondeada(etiquetaAncho, yc - 9, w, 18, 4), fill: d.color || "var(--serie-1)" });
      conTip(b, d.tip || `<b>${d.etiqueta}</b><br>${opc.formato ? opc.formato(d.valor) : d.valor}`);
      s.appendChild(b);
      s.appendChild(el("text", { x: etiquetaAncho + w + 6, y: yc + 4, class: "t-fuerte" }, opc.formato ? opc.formato(d.valor) : String(d.valor)));
    });
  }
  function barraRedondeada(x, y, w, h, r) {
    r = Math.min(r, w);
    return `M${x},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} z`;
  }
  function partir(texto, max) {
    if (texto.length <= max) return [texto];
    const pal = texto.split(" "), out = [""];
    pal.forEach((p) => { if ((out[out.length - 1] + " " + p).trim().length > max && out[out.length - 1]) out.push(p); else out[out.length - 1] = (out[out.length - 1] + " " + p).trim(); });
    return out.slice(0, 2);
  }

  /* =================================================================
     4. Plazo transcurrido vs avance reportado (barras sobre 0-100 %)
     ================================================================= */
  function plazoVsAvance(cont, filas) {
    const fila = 58, top = 6;
    const { s, ancho } = lienzo(cont, top + filas.length * fila + 22, "Comparación del porcentaje del plazo transcurrido con el avance físico y financiero reportados.");
    const l = 4, r = ancho - 8;
    const x = lineal(0, 100, l, r);
    [0, 25, 50, 75, 100].forEach((t) => {
      s.appendChild(el("line", { x1: x(t), x2: x(t), y1: top, y2: top + filas.length * fila, class: t === 0 || t === 100 ? "eje" : "rejilla" }));
      s.appendChild(el("text", { x: x(t), y: top + filas.length * fila + 16, "text-anchor": t === 0 ? "start" : t === 100 ? "end" : "middle", class: "t-suave" }, `${t} %`));
    });
    filas.forEach((f, i) => {
      const y0 = top + i * fila;
      s.appendChild(el("text", { x: l, y: y0 + 16, class: "t-fuerte" }, f.etiqueta));
      const v = Math.min(100, f.valor);
      const b = el("path", { d: barraRedondeada(x(0), y0 + 24, Math.max(2, x(v) - x(0)), 18, 4), fill: f.color });
      conTip(b, f.tip);
      s.appendChild(b);
      const dentro = x(v) + 7.5 * f.texto.length + 8 > ancho;
      s.appendChild(el("text", dentro
        ? { x: x(v) - 8, y: y0 + 38, "text-anchor": "end", fill: "#fff", "font-weight": 700 }
        : { x: x(v) + 6, y: y0 + 38, class: "t-fuerte" }, f.texto));
    });
  }

  /* =================================================================
     5. Linea de tiempo de fases (Gantt) con "hoy" y atraso rayado
     ================================================================= */
  function gantt(cont, fases, hoyISO) {
    const fila = 40, top = 26, abajo = 30;
    const { s, ancho } = lienzo(cont, top + fases.length * fila + abajo, "Línea de tiempo de las fases del proyecto con su fecha de inicio y de fin prevista, y la fecha de hoy.");
    const pat = rayado(s, "atraso");
    const t0 = new Date(fases[0].inicio).getTime();
    const hoy = new Date(hoyISO).getTime();
    const t1 = Math.max(hoy, ...fases.map((f) => new Date(f.fin_previsto).getTime())) + 120 * 864e5;
    const x = lineal(t0, t1, 4, ancho - 6);
    const a0 = new Date(fases[0].inicio).getFullYear(), a1 = new Date(t1).getFullYear();
    for (let a = a0 + 1; a <= a1; a++) {
      const xx = x(new Date(`${a}-01-01`).getTime());
      s.appendChild(el("line", { x1: xx, x2: xx, y1: top - 6, y2: top + fases.length * fila, class: "rejilla" }));
      if (ancho > 480 || a % 2 === 0) s.appendChild(el("text", { x: xx, y: top + fases.length * fila + 18, "text-anchor": "middle", class: "t-suave" }, String(a)));
    }
    fases.forEach((f, i) => {
      const y0 = top + i * fila;
      const xi = x(new Date(f.inicio).getTime()), xf = x(new Date(f.fin_previsto).getTime());
      const terminada = f.porcentaje >= 100;
      const b = el("rect", { x: xi, y: y0 + 16, width: Math.max(3, xf - xi), height: 14, rx: 4, fill: terminada ? "var(--seq-2)" : "var(--serie-1)" });
      conTip(b, `<b>${f.fase}</b><br>Previsto: ${fLarga(f.inicio)} → ${fLarga(f.fin_previsto)}<br>Avance reportado: ${f.porcentaje} %`);
      s.appendChild(b);
      if (!terminada && hoy > new Date(f.fin_previsto).getTime()) {
        const a = el("rect", { x: xf + 2, y: y0 + 16, width: x(hoy) - xf - 2, height: 14, rx: 4, fill: pat, stroke: "var(--critico)", "stroke-width": 1.5 });
        const meses = Math.round((hoy - new Date(f.fin_previsto).getTime()) / (30.44 * 864e5));
        conTip(a, `<b>Fuera de plazo</b><br>La fase debía terminar el ${fLarga(f.fin_previsto)}. Hoy lleva ${meses} meses de atraso y el avance reportado es ${f.porcentaje} %.`);
        s.appendChild(a);
      }
      const etiqueta = `${f.fase}${terminada ? " ✓" : ` · ${f.porcentaje} %`}`;
      const anclaDer = xi > ancho * 0.55;
      s.appendChild(el("text", { x: anclaDer ? xf : xi, y: y0 + 11, "text-anchor": anclaDer ? "end" : "start", class: terminada ? "" : "t-fuerte" }, etiqueta));
    });
    const xh = x(hoy);
    s.appendChild(el("line", { x1: xh, x2: xh, y1: top - 10, y2: top + fases.length * fila, stroke: "var(--texto)", "stroke-width": 1.5 }));
    s.appendChild(el("text", { x: xh, y: top - 14, "text-anchor": "end", class: "t-fuerte" }, "Hoy"));
  }

  /* =================================================================
     6. Lineas multiples (misma unidad) con etiqueta al final
     ================================================================= */
  function lineas(cont, puntos, series, opc = {}) {
    const alto = 210;
    const { s, ancho } = lienzo(cont, alto, opc.descripcion || "Gráfico de líneas");
    const m = { t: 12, r: 96, b: 30, l: 30 };
    const max = Math.max(...puntos.flatMap((p) => series.map((se) => p[se.clave])));
    const ticks = ticksLimpios(max, 3);
    const y = lineal(0, ticks[ticks.length - 1], alto - m.b, m.t);
    const x = lineal(0, puntos.length - 1, m.l + 10, ancho - m.r);
    ticks.forEach((t) => {
      s.appendChild(el("line", { x1: m.l, x2: ancho - m.r + 6, y1: y(t), y2: y(t), class: t === 0 ? "eje" : "rejilla" }));
      s.appendChild(el("text", { x: m.l - 6, y: y(t) + 4, "text-anchor": "end" }, String(t)));
    });
    puntos.forEach((p, i) => s.appendChild(el("text", { x: x(i), y: alto - 10, "text-anchor": "middle", class: "t-suave" }, fCorta(p.fecha))));
    const finales = [];
    series.forEach((se) => {
      const d = puntos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[se.clave])}`).join("");
      s.appendChild(el("path", { d, fill: "none", stroke: se.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      puntos.forEach((p, i) => {
        const c = el("circle", { cx: x(i), cy: y(p[se.clave]), r: 4, fill: se.color, stroke: "var(--superficie)", "stroke-width": 2 });
        conTip(c, `<b>${se.nombre}</b> · ${fLarga(p.fecha)}<br>${p[se.clave].toFixed(2).replace(".", ",")} detecciones por imagen (promedio del día)`);
        s.appendChild(c);
      });
      finales.push({ y: y(puntos[puntos.length - 1][se.clave]), nombre: se.nombre, color: se.color });
    });
    // etiquetas al final con lineas guia si chocan
    finales.sort((a, b) => a.y - b.y);
    for (let i = 1; i < finales.length; i++) if (finales[i].y - finales[i - 1].y < 15) finales[i].yl = (finales[i - 1].yl ?? finales[i - 1].y) + 15;
    finales.forEach((f) => {
      const yl = f.yl ?? f.y;
      const x0 = x(puntos.length - 1) + 6;
      if (yl !== f.y) s.appendChild(el("path", { d: `M${x0},${f.y} L${x0 + 10},${yl}`, stroke: "var(--texto-3)", fill: "none" }));
      s.appendChild(el("text", { x: x0 + 14, y: yl + 4 }, f.nombre));
    });
  }

  window.Graficos = { etapasPorSemana, personasPorDia, barrasH, plazoVsAvance, gantt, lineas, conTip, fCorta, fLarga, MESES };
})();

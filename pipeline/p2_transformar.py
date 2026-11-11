"""Paso 2 - Limpieza y transformacion por fuente.

Lee solo archivos de datos/crudos/ y escribe tablas ordenadas en
datos/procesados/. Cada regla de limpieza se registra en la bitacora
(datos/procesados/bitacora_limpieza.json) con el numero de registros que
modifico, para que cualquier persona pueda auditar el resultado.
"""
from __future__ import annotations

import csv
import html
import json
import re
import statistics
import sys
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

from comun import CRUDOS, PROCESADOS, Bitacora, ahora_iso, escribir_json, leer_json

bit = Bitacora()

# ---------------------------------------------------------------------------
# Vocabularios controlados
# ---------------------------------------------------------------------------
# Orden constructivo tipico de una edificacion escolar. Se usa para ordenar
# etapas y detectar lecturas fuera de secuencia.
ORDEN_ETAPAS = ["Movimiento de tierras", "Estructura de concreto", "Mampostería", "Cubierta", "Acabados interiores"]

ACENTOS = {
    "Mamposteria": "Mampostería",
    "Grua torre": "Grúa torre",
    "Grua movil": "Grúa móvil",
    "Generador electrico": "Generador eléctrico",
    "Camion mixer": "Camión mezclador (mixer)",
    "Camion de volteo": "Camión de volteo",
    "Andamios metalicos": "Andamios metálicos",
    "Si": "Sí",
}

# Elementos que el modelo reporta como "maquinaria" pero que son estructuras
# temporales; se separan para no inflar el conteo de maquinaria.
NO_MAQUINARIA = {"Andamios metálicos"}

TEXTO_NO_DET = {"", "no determinable", "none", "null"}


TILDES_RESTITUIDAS = Counter()


def tildar(valor: str) -> str:
    if valor in ACENTOS:
        TILDES_RESTITUIDAS[valor] += 1
    return ACENTOS.get(valor, valor)


def normalizar_etapas(valor) -> list[str]:
    """La etapa llega como texto simple, texto separado por comas, lista de
    Python serializada o vacia. Se devuelve una lista canonica ordenada."""
    if valor is None:
        return []
    if isinstance(valor, list):
        partes = valor
    else:
        texto = str(valor).strip()
        if texto.startswith("["):
            texto = texto.strip("[]").replace("'", "")
        partes = texto.split(",")
    etapas = []
    for p in partes:
        p = tildar(p.strip())
        if p.lower() in TEXTO_NO_DET:
            continue
        if p not in etapas:
            etapas.append(p)
    return sorted(etapas, key=lambda e: ORDEN_ETAPAS.index(e) if e in ORDEN_ETAPAS else 99)


def limpio(valor):
    """Texto vacio o 'No determinable' -> None (dato faltante explicito)."""
    if valor is None:
        return None
    texto = tildar(str(valor).strip())
    return None if texto.lower() in TEXTO_NO_DET else texto


# ---------------------------------------------------------------------------
# Fuente A1: Limoncito (dIAra)
# ---------------------------------------------------------------------------
def transformar_limoncito() -> None:
    print("Limoncito: imagenes")
    base = CRUDOS / "obrapublica" / "limoncito"
    manifiesto = leer_json(base / "manifest.json")
    filas = []
    cont = Counter()

    for f in manifiesto["dates"]:
        dia = leer_json(base / "dias" / f"{f}.json")
        for it in dia["images"]:
            ts = datetime.strptime(it["fecha_hora"], "%d/%m/%Y %H:%M:%S")
            fila = {
                "id_imagen": it["nombre_imagen"].removesuffix(".jpg"),
                "archivo_imagen": it["nombre_imagen"],
                "fecha": ts.date().isoformat(),
                "hora": ts.strftime("%H:%M"),
                "franja": "mañana" if ts.hour < 12 else "tarde",
                "analizable": "error" not in it,
            }
            if not fila["analizable"]:
                cont["no_analizable"] += 1
                fila.update({"error": it["error"]})
                filas.append(fila)
                continue

            etapas_crudas = it.get("etapa_constructiva")
            if not isinstance(etapas_crudas, str) or "," in etapas_crudas or etapas_crudas.startswith("["):
                cont["etapa_formato"] += 1
            etapas = normalizar_etapas(etapas_crudas)
            if not etapas:
                cont["etapa_vacia"] += 1
            if "Mamposteria" in str(etapas_crudas):
                cont["tilde_mamposteria"] += 1

            maq_cruda = [tildar(m) for m in (it.get("maquinaria") or [])]
            maquinaria = [m for m in maq_cruda if m not in NO_MAQUINARIA]
            temporales = [m for m in maq_cruda if m in NO_MAQUINARIA]
            if temporales:
                cont["andamios_reclasificados"] += 1

            clima = it.get("condiciones_climaticas") or {}
            seg = it.get("seguridad_laboral") or {}
            riesgo = it.get("riesgos_climaticos") or {}
            acc = it.get("accesibilidad_universal") or {}
            visibilidad = limpio(clima.get("visibilidad"))
            personas = it.get("personas_trabajadoras")

            # Regla de verificabilidad: con visibilidad "Mala" un conteo de
            # 0 personas no se puede confirmar ni descartar en la imagen.
            cero_no_verificable = personas == 0 and visibilidad == "Mala"
            if cero_no_verificable:
                cont["cero_no_verificable"] += 1

            # El cumplimiento de accesibilidad siempre vale 0 porque la obra no
            # esta en acabados: se trata como "no evaluable", no como 0 %.
            if acc.get("cumplimiento_estimado") == 0 and "Acabados interiores" not in etapas:
                cont["accesibilidad_no_evaluable"] += 1
                accesibilidad = None
            else:
                accesibilidad = acc.get("cumplimiento_estimado")

            for campo in ("uso_casco", "uso_chaleco"):
                if seg.get(campo) == "Si":
                    cont["tilde_si"] += 1

            fila.update({
                "personas": personas,
                "cero_no_verificable": cero_no_verificable,
                "maquinaria": maquinaria,
                "n_maquinaria": len(maquinaria),
                "estructuras_temporales": temporales,
                "etapas": etapas,
                "etapa_principal": etapas[-1] if etapas else None,  # la mas avanzada mencionada
                "actividad": limpio(it.get("actividad_desarrollada")),
                "clima": limpio(clima.get("clima_general")),
                "visibilidad": visibilidad,
                "riesgo": limpio(riesgo.get("nivel_riesgo")),
                "casco": limpio(seg.get("uso_casco")),
                "chaleco": limpio(seg.get("uso_chaleco")),
                "arnes": limpio(seg.get("uso_arnes_altura")),
                "barandas": limpio(seg.get("barandas_perimetrales")),
                "accesibilidad_pct": accesibilidad,
                "elementos": [tildar(e) for e in (it.get("elementos_constructivos") or [])],
                "observacion_seguridad": (seg.get("observaciones") or "").strip(),
            })
            if "elementos_constructivos" not in it:
                cont["sin_elementos"] += 1
            filas.append(fila)

    bit.anotar("Limoncito", "Imágenes con error 'Imagen no analizable' conservadas y marcadas analizable=false (no se borran)", cont["no_analizable"])
    bit.anotar("Limoncito", "Etapa constructiva en formato lista o texto con comas convertida a lista canónica ordenada", cont["etapa_formato"])
    bit.anotar("Limoncito", "Etapa vacía o 'No determinable' convertida a dato faltante explícito", cont["etapa_vacia"])
    bit.anotar("Limoncito", "Tildes restituidas en etiquetas del vocabulario (Mampostería, Grúa torre, Camión, Sí, etc.)",
               sum(TILDES_RESTITUIDAS.values()), ", ".join(f"{k}: {v}" for k, v in TILDES_RESTITUIDAS.most_common()))
    bit.anotar("Limoncito", "'Andamios metálicos' reclasificados de maquinaria a estructura temporal", cont["andamios_reclasificados"])
    bit.anotar("Limoncito", "Conteo de 0 personas con visibilidad 'Mala' marcado como no verificable", cont["cero_no_verificable"])
    bit.anotar("Limoncito", "Accesibilidad universal 0 % antes de acabados tratada como 'no evaluable' (null)", cont["accesibilidad_no_evaluable"])
    bit.anotar("Limoncito", "Registros sin campo 'elementos_constructivos' completados con lista vacía", cont["sin_elementos"])

    # Tabla plana (CSV) para revision en hoja de calculo
    columnas = ["id_imagen", "fecha", "hora", "franja", "analizable", "personas", "cero_no_verificable",
                "n_maquinaria", "maquinaria", "estructuras_temporales", "etapas", "etapa_principal", "actividad",
                "clima", "visibilidad", "riesgo", "casco", "chaleco", "arnes", "barandas", "accesibilidad_pct", "error"]
    with open(PROCESADOS / "limoncito_imagenes.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=columnas, extrasaction="ignore")
        w.writeheader()
        for fl in filas:
            w.writerow({k: ("; ".join(v) if isinstance(v, list) else v) for k, v in fl.items()})
    escribir_json(PROCESADOS / "limoncito_imagenes.json", filas)

    # ---- Agregacion diaria ------------------------------------------------
    print("Limoncito: agregacion diaria")
    dias = []
    por_fecha: dict[str, list] = {}
    for fl in filas:
        por_fecha.setdefault(fl["fecha"], []).append(fl)
    n_contradictorios = 0
    for fecha, imgs in sorted(por_fecha.items()):
        ok = [i for i in imgs if i["analizable"]]
        personas = [i["personas"] for i in ok if i["personas"] is not None]
        personas_verif = [i["personas"] for i in ok if i["personas"] is not None and not i["cero_no_verificable"]]
        principales = [i["etapa_principal"] for i in ok if i["etapa_principal"]]
        distintas = sorted(set(principales), key=ORDEN_ETAPAS.index)
        presencia_etapas = {e: sum(1 for i in ok if e in i["etapas"]) for e in ORDEN_ETAPAS}
        maq = Counter(m for i in ok for m in i["maquinaria"])
        # Contradiccion: dos lecturas del mismo dia sin ninguna etapa en comun
        # (p. ej. "Cubierta" a las 07:12 y "Acabados interiores" a las 11:43).
        # Varias etapas a la vez en una misma imagen no cuentan: pueden ser
        # frentes de trabajo simultaneos.
        conjuntos = [set(i["etapas"]) for i in ok if i["etapas"]]
        contradictorio = any(not (a & b) for k, a in enumerate(conjuntos) for b in conjuntos[k + 1:])
        n_contradictorios += contradictorio
        resumen_ruta = CRUDOS / "obrapublica" / "limoncito" / "resumenes" / f"{fecha.replace('-', '')}.txt"
        resumen = resumen_ruta.read_text(encoding="utf-8").strip() if resumen_ruta.exists() else None
        dias.append({
            "fecha": fecha,
            "dia_semana": date.fromisoformat(fecha).weekday(),
            "imagenes": len(imgs),
            "analizables": len(ok),
            "personas_min": min(personas) if personas else None,
            "personas_mediana": statistics.median(personas) if personas else None,
            "personas_max": max(personas) if personas else None,
            "personas_max_verificable": max(personas_verif) if personas_verif else None,
            "imagenes_vis_mala": sum(1 for i in ok if i["visibilidad"] == "Mala"),
            "imagenes_etapa_nd": sum(1 for i in ok if not i["etapas"]),
            "etapa_dominante": Counter(principales).most_common(1)[0][0] if principales else None,
            "etapas_distintas": distintas,
            "contradiccion_etapa": contradictorio,
            "presencia_etapas": presencia_etapas,
            "maquinaria": dict(maq.most_common()),
            "grua_torre": maq.get("Grúa torre", 0) > 0,
            "con_actividad": any((i["personas"] or 0) > 0 or i["n_maquinaria"] > 0 for i in ok),
            "riesgo_max": max((i["riesgo"] for i in ok if i["riesgo"]), key=["Bajo", "Moderado", "Alto"].index, default=None),
            "clima_dominante": Counter(i["clima"] for i in ok if i["clima"]).most_common(1)[0][0] if any(i["clima"] for i in ok) else None,
            "resumen_ia": limpiar_resumen(resumen) if resumen else None,
        })
    bit.anotar("Limoncito", "Días con lecturas de etapa sin ninguna etapa en común entre imágenes (contradicción marcada, no corregida)", n_contradictorios)
    escribir_json(PROCESADOS / "limoncito_dias.json", dias)

    # ---- Cobertura del calendario -----------------------------------------
    fechas = sorted(por_fecha)
    ini, fin = date.fromisoformat(fechas[0]), date.fromisoformat(fechas[-1])
    habiles = [ini + timedelta(d) for d in range((fin - ini).days + 1) if (ini + timedelta(d)).weekday() < 5]
    faltantes = [d.isoformat() for d in habiles if d.isoformat() not in por_fecha]
    bit.anotar("Limoncito", "Cobertura: días hábiles sin imágenes entre la primera y la última fecha", len(faltantes),
               f"{len(habiles)} días hábiles entre {ini} y {fin}")
    escribir_json(PROCESADOS / "limoncito_meta.json", {
        "proyecto_segun_manifiesto": manifiesto.get("proyecto"),
        "manifiesto_generado": manifiesto.get("generado"),
        "muestreo": manifiesto.get("muestreo"),
        "primera_fecha": fechas[0],
        "ultima_fecha": fechas[-1],
        "dias_con_datos": len(fechas),
        "dias_habiles_periodo": len(habiles),
        "dias_habiles_faltantes": faltantes,
        "estadisticas_publicadas": manifiesto.get("estadisticas"),
    })


def limpiar_resumen(texto: str) -> str:
    """Quita marcas de formato Markdown visibles (asteriscos) del resumen IA."""
    sin = re.sub(r"\*+", "", texto)
    return re.sub(r"\n{3,}", "\n\n", sin).strip()


# ---------------------------------------------------------------------------
# Fuente A2: tablero Taras-La Lima (dIAra)
# ---------------------------------------------------------------------------
def transformar_taras() -> None:
    print("Taras-La Lima: tablero dIAra")
    texto = (CRUDOS / "obrapublica" / "tablero_taras_lima.html").read_text(encoding="utf-8")
    serie = json.loads(re.search(r"timeData:\s*(\[.*?\])", texto, re.S).group(1))
    stats_txt = re.search(r"stats:\s*(\{.*?\})\s*\n\s*\};", texto, re.S).group(1)
    stats = json.loads(stats_txt)
    orden_original = [d["date"] for d in serie]
    serie_ordenada = sorted(serie, key=lambda d: d["date"])
    desordenados = sum(1 for a, b in zip(orden_original, [d["date"] for d in serie_ordenada]) if a != b)
    bit.anotar("Taras-La Lima", "Serie diaria reordenada cronológicamente (el tablero original la muestra desordenada)", desordenados)

    fechas_serie = {d["date"] for d in serie}
    referidas = set()
    for bloque in ("maximos", "minimos"):
        for v in stats[bloque].values():
            referidas.add(v["date"])
    fuera = sorted(referidas - fechas_serie)
    bit.anotar("Taras-La Lima", "Fechas citadas en máximos/mínimos que no existen en la serie publicada", len(fuera), ", ".join(fuera))

    recalculado = {}
    for cat in ("personas", "tractores", "aplanadoras"):
        valores = [d[cat] for d in serie]
        recalculado[cat] = {
            "promedio_publicado": stats["promedios"][cat],
            "promedio_de_la_serie": round(statistics.mean(valores), 2),
            "maximo_publicado": stats["maximos"][cat],
            "maximo_de_la_serie": max(valores),
        }
    escribir_json(PROCESADOS / "taras_diara.json", {
        "serie": [{"fecha": d["date"], "personas": d["personas"], "tractores": d["tractores"],
                   "aplanadoras": d["aplanadoras"], "imagenes": d["totalImagenes"]} for d in serie_ordenada],
        "unidad": "Promedio de detecciones por imagen en el día",
        "estadisticas_publicadas": stats,
        "contraste": recalculado,
        "fechas_citadas_ausentes": fuera,
    })


# ---------------------------------------------------------------------------
# Fuente A3: mapas de obrapublica.info (metadatos de obras)
# ---------------------------------------------------------------------------
def transformar_mapas() -> None:
    print("obrapublica.info: metadatos de obras en mapas")
    obras = {}
    for archivo in ("mapa_cartago.html", "mapa_san_jose.html"):
        t = (CRUDOS / "obrapublica" / archivo).read_text(encoding="utf-8")
        bloques = re.findall(r"obra = \{(.*?)\};", t, re.S)
        bloque = bloques[-1]  # el segundo bloque es el que usa la pagina
        campo = lambda k: (re.search(rf'{k}:\s*"([^"]*)"', bloque) or [None, None])[1]  # noqa: E731
        centro = re.search(r"center:\s*\[([-\d.]+),\s*([-\d.]+)\]", t)
        obras[campo("nombre")] = {
            "nombre": campo("nombre"),
            "descripcion": campo("descripcion"),
            "lat": float(centro.group(1)),
            "lon": float(centro.group(2)),
            "video_semana": campo("timelapse"),
            "video_monitoreo": campo("imagenes") or None,
            "tablero": campo("tablero") or None,
            "pagina_origen": archivo,
        }
    bit.anotar("Mapas", "Metadatos de obras extraídos del código del mapa (nombre, descripción, coordenadas, enlaces)", len(obras))
    escribir_json(PROCESADOS / "obrapublica_obras.json", obras)


# ---------------------------------------------------------------------------
# Fuente B: MapaInversiones (MIDEPLAN)
# ---------------------------------------------------------------------------
def numero_cr(texto: str) -> float:
    """'54,40' -> 54.4 ; '39,335' (miles) se maneja aparte."""
    return float(texto.replace(".", "").replace(",", "."))


def fecha_mi(texto: str) -> str:
    return datetime.strptime(texto.split(" ")[0], "%d/%m/%Y").date().isoformat()


def transformar_mideplan() -> None:
    print("MapaInversiones: ficha 18394 y listados")
    t = (CRUDOS / "mapainversiones" / "perfil_18394.html").read_text(encoding="utf-8", errors="replace")
    perfil = json.loads(html.unescape(re.search(r"data-profile='(.*?)'", t, re.S).group(1)))[0]
    fases = json.loads(html.unescape(re.search(r"data-avance='(.*?)'", t, re.S).group(1)))
    plano = html.unescape(re.sub(r"<[^>]+>", "\n", re.sub(r"<script.*?</script>", "", t, flags=re.S)))
    lineas = [x.strip() for x in plano.split("\n") if x.strip()]

    def despues(etiqueta: str) -> str | None:
        for i, linea in enumerate(lineas):
            if linea == etiqueta and i + 1 < len(lineas):
                return lineas[i + 1]
        return None

    def antes(etiqueta: str) -> str | None:
        for i, linea in enumerate(lineas):
            if linea == etiqueta and i > 0:
                return lineas[i - 1]
        return None

    nombre = next(x for x in lineas if x.startswith("Construcción de los Intercambios"))
    costo_txt = antes("Costo estimado del proyecto")  # "₡ 39,335 Millones"
    costo_millones = float(re.sub(r"[^\d,]", "", costo_txt).replace(",", ""))
    productos = [x for x in lineas if re.match(r"^[a-d]\)", x)]
    i_obj = lineas.index("OBJETIVO GENERAL")
    fases_limpias = [{
        "fase": f["etapa"],
        "porcentaje": numero_cr(f["porcentaje"]),
        "inicio": fecha_mi(f["fecha_inicio"]),
        "fin_previsto": fecha_mi(f["fecha_fin"]),
    } for f in fases]
    bit.anotar("MapaInversiones", "Fechas dd/mm/aaaa y porcentajes con coma decimal convertidos a ISO 8601 y número", len(fases_limpias))
    avance_encabezado = numero_cr(perfil["avance_fisico"])
    avance_fase = fases_limpias[-1]["porcentaje"]
    if avance_encabezado != avance_fase:
        bit.anotar("MapaInversiones", "Discrepancia: avance físico del encabezado distinto al de la fase en ejecución (se muestran ambos)", 1,
                   f"encabezado {avance_encabezado} % vs fase {avance_fase} %")
    escribir_json(PROCESADOS / "mideplan_18394.json", {
        "id_proyecto": 18394,
        "codigo_bpip": despues("Código BPIP"),
        "nombre": nombre,
        "ejecutor": "Ministerio de Obras Públicas y Transportes (MOPT)",
        "sector": despues("Sector"),
        "ubicacion": "San Nicolás, Cartago",
        "etapa_actual": despues("Etapa Actual"),
        "costo_millones_crc": costo_millones,
        "duracion_estimada": antes("Duración estimada del proyecto"),
        "anio_inicio": despues("Fecha de Inicio"),
        "anio_fin_previsto": despues("Fecha de Finalización"),
        "avance_fisico_encabezado": avance_encabezado,
        "avance_fisico_fase": avance_fase,
        "avance_financiero": numero_cr(perfil["avance_financiero"]),
        "objetivo": lineas[i_obj + 1],
        "productos": productos,
        "fases": fases_limpias,
        "fecha_corte_avance": None,  # la ficha no publica la fecha de la medicion
        "url": "https://rendircuentas.mideplan.go.cr/proyecto/perfilproyecto/18394",
    })

    # Listados: tabla unica de proyectos por canton
    proyectos = []
    for ruta in sorted((CRUDOS / "mapainversiones").glob("listado_*_p*.json")):
        canton = ruta.stem.split("_p")[0].removeprefix("listado_")
        for o in leer_json(ruta)["objects"]:
            proyectos.append({
                "canton": canton,
                "id": int(o["url"].rsplit("/", 1)[-1]),
                "nombre": " ".join(o["name"].split()),
                "etapa": o["state"],
                "costo_millones_crc": o["value"],
                "ejecutor": o.get("Ejecutor"),
            })
    bit.anotar("MapaInversiones", "Listados paginados unidos en una tabla; espacios sobrantes en nombres eliminados", len(proyectos))
    escribir_json(PROCESADOS / "mideplan_proyectos.json", proyectos)


def main() -> None:
    print("Paso 2 - Limpieza y transformacion")
    PROCESADOS.mkdir(parents=True, exist_ok=True)
    transformar_limoncito()
    transformar_taras()
    transformar_mapas()
    transformar_mideplan()
    escribir_json(PROCESADOS / "bitacora_limpieza.json", {"generado": ahora_iso(), "pasos": bit.pasos})
    print(f"Listo: {len(bit.pasos)} reglas registradas en la bitacora")


if __name__ == "__main__":
    sys.exit(main())

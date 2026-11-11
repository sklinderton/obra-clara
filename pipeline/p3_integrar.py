"""Paso 3 - Integracion y publicacion.

1. Cruza las obras de obrapublica.info (evidencia de campo, dIAra) con los
   proyectos de MapaInversiones (datos contractuales, MIDEPLAN) y documenta
   el metodo y la confianza de cada cruce.
2. Calcula indicadores de frescura, completitud y confiabilidad.
3. Escribe los archivos que consume la web (web/datos/*.json).
4. Genera PROCEDENCIA.md, el registro legible de fuentes y transformaciones.
"""
from __future__ import annotations

import re
import sys
import unicodedata
from collections import Counter
from datetime import date

from comun import PROCESADOS, RAIZ, REGISTRO_DESCARGAS, WEB_DATOS, ahora_iso, escribir_json, leer_json


def sin_tildes(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t.lower()) if unicodedata.category(c) != "Mn")


def buscar(proyectos: list[dict], canton: str, patron: str) -> list[dict]:
    rx = re.compile(patron)
    return [p for p in proyectos if p["canton"] == canton and rx.search(sin_tildes(p["nombre"]))]


def cruzar_fuentes(proyectos: list[dict]) -> list[dict]:
    """Cada cruce queda con su metodo, candidatos y decision explicita."""
    limon = buscar(proyectos, "limon", r"limoncito|cieneguita")
    limon_escuelas = [p for p in limon if re.search(r"escuela|colegio|liceo", sin_tildes(p["nombre"]))]
    taras = buscar(proyectos, "cartago", r"taras|la lima")
    circ = buscar(proyectos, "san_jose", r"circunvalacion")
    n = Counter(p["canton"] for p in proyectos)
    return [
        {
            "obra": "limoncito",
            "proyectos_revisados": n["limon"],
            "fuente_campo": "obrapublica.info/limoncito",
            "metodo": f"Búsqueda de 'Limoncito' o 'Cieneguita' en los {n['limon']} proyectos del cantón Limón (701)",
            "candidatos": [{"id": p["id"], "nombre": p["nombre"]} for p in limon],
            "decision": "Sin cruce" if not limon_escuelas else "Revisar",
            "confianza": "—",
            "justificacion": "El único resultado es la canalización del río Limoncito (SENARA), que es otra obra. "
                             "La escuela no aparece en MapaInversiones, así que no hay plazo ni monto oficial con qué comparar.",
        },
        {
            "obra": "taras-la-lima",
            "proyectos_revisados": n["cartago"],
            "fuente_campo": "obrapublica.info/taras-lima",
            "metodo": f"Búsqueda de 'Taras' o 'La Lima' en los {n['cartago']} proyectos del cantón Cartago (301) y verificación de ubicación",
            "candidatos": [{"id": p["id"], "nombre": p["nombre"]} for p in taras],
            "decision": "Cruce con 18394",
            "confianza": "Alta",
            "justificacion": "El nombre coincide (intercambios de La Lima y Taras), el distrito es San Nicolás de Cartago y "
                             "las coordenadas de dIAra corresponden a La Lima, Taras, San Nicolás (verificado con OpenStreetMap). "
                             "Se descarta 22915 (eje ciclista, otra obra).",
        },
        {
            "obra": "puente-circunvalacion",
            "proyectos_revisados": n["san_jose"],
            "fuente_campo": "obrapublica.info/map (San José)",
            "metodo": f"Búsqueda de 'Circunvalación' en los {n['san_jose']} proyectos del cantón San José (101)",
            "candidatos": [{"id": p["id"], "nombre": p["nombre"]} for p in circ],
            "decision": "Sin cruce",
            "confianza": "Baja",
            "justificacion": "Hay dos candidatos sobre la Ruta 39, pero la ficha de dIAra solo dice 'Puente Circunvalación', "
                             "sus coordenadas son las mismas que usa el mapa por defecto y no publica datos. No se asume el cruce.",
        },
    ]


def semana_iso(fecha: str) -> str:
    a, s, _ = date.fromisoformat(fecha).isocalendar()
    return f"{a}-S{s:02d}"


def resumen_semanal(dias: list[dict]) -> list[dict]:
    semanas: dict[str, list] = {}
    for d in dias:
        semanas.setdefault(semana_iso(d["fecha"]), []).append(d)
    out = []
    for clave, ds in semanas.items():
        medianas = [d["personas_mediana"] for d in ds if d["personas_mediana"] is not None]
        etapas = Counter(e for d in ds for e, n in d["presencia_etapas"].items() if n)
        maq = Counter(m for d in ds for m in d["maquinaria"])
        out.append({
            "semana": clave,
            "desde": ds[0]["fecha"],
            "hasta": ds[-1]["fecha"],
            "dias_con_datos": len(ds),
            "dias_con_actividad": sum(d["con_actividad"] for d in ds),
            "personas_mediana_prom": round(sum(medianas) / len(medianas), 1) if medianas else None,
            "personas_max": max((d["personas_max"] for d in ds if d["personas_max"] is not None), default=None),
            "etapas": [e for e, _ in etapas.most_common()],
            "maquinaria": [m for m, _ in maq.most_common(3)],
            "dias_contradictorios": sum(d["contradiccion_etapa"] for d in ds),
            "imagenes_vis_mala": sum(d["imagenes_vis_mala"] for d in ds),
            "imagenes_analizables": sum(d["analizables"] for d in ds),
        })
    return out


def main() -> None:
    print("Paso 3 - Integracion")
    WEB_DATOS.mkdir(parents=True, exist_ok=True)
    imgs = leer_json(PROCESADOS / "limoncito_imagenes.json")
    dias = leer_json(PROCESADOS / "limoncito_dias.json")
    meta = leer_json(PROCESADOS / "limoncito_meta.json")
    taras = leer_json(PROCESADOS / "taras_diara.json")
    mi = leer_json(PROCESADOS / "mideplan_18394.json")
    mapas = leer_json(PROCESADOS / "obrapublica_obras.json")
    proyectos = leer_json(PROCESADOS / "mideplan_proyectos.json")
    bitacora = leer_json(PROCESADOS / "bitacora_limpieza.json")
    descargas = leer_json(REGISTRO_DESCARGAS)

    cruces = cruzar_fuentes(proyectos)
    escribir_json(PROCESADOS / "cruce_fuentes.json", cruces)

    ok = [i for i in imgs if i["analizable"]]
    confiabilidad = {
        "imagenes_totales": len(imgs),
        "imagenes_analizables": len(ok),
        "imagenes_vis_mala": sum(1 for i in ok if i["visibilidad"] == "Mala"),
        "imagenes_etapa_nd": sum(1 for i in ok if not i["etapas"]),
        "ceros_no_verificables": sum(1 for i in ok if i["cero_no_verificable"]),
        "dias_contradictorios": sum(d["contradiccion_etapa"] for d in dias),
        "dias": len(dias),
        "epp_no_determinable": sum(1 for i in ok if i["casco"] is None),
    }
    fecha_corte = date.today().isoformat()

    obras = [
        {
            "id": "limoncito",
            "nombre": "Escuela de Limoncito",
            "nombre_alterno": meta["proyecto_segun_manifiesto"],
            "que_es": "Construcción de un centro educativo",
            "ubicacion": "Cieneguita, Limón",
            "lat": None, "lon": None,  # el portal no publica coordenadas
            "coordenadas_aprox": True,
            "ejecutor": None,
            "fuentes": ["dIAra (CGR)"],
            "evidencia_desde": meta["primera_fecha"],
            "evidencia_hasta": meta["ultima_fecha"],
            "dias_con_imagenes": meta["dias_con_datos"],
            "imagenes": len(imgs),
            "plan_oficial": None,
            "url_origen": "https://www.obrapublica.info/limoncito",
        },
        {
            "id": "taras-la-lima",
            "nombre": "Intercambios de Taras y La Lima",
            "nombre_alterno": "Taras-La Lima (obrapublica.info)",
            "que_es": "Dos intercambios viales y ampliación a 3 carriles por sentido en la Ruta 2",
            "ubicacion": "San Nicolás, Cartago",
            "lat": mapas["Taras-La Lima"]["lat"], "lon": mapas["Taras-La Lima"]["lon"],
            "coordenadas_aprox": False,
            "ejecutor": mi["ejecutor"],
            "fuentes": ["dIAra (CGR)", "MapaInversiones (MIDEPLAN)"],
            "evidencia_desde": taras["serie"][0]["fecha"],
            "evidencia_hasta": taras["serie"][-1]["fecha"],
            "dias_con_imagenes": len(taras["serie"]),
            "imagenes": sum(d["imagenes"] for d in taras["serie"]),
            "plan_oficial": {
                "costo_millones_crc": mi["costo_millones_crc"],
                "fase_actual": mi["etapa_actual"],
                "ejecucion_inicio": mi["fases"][-1]["inicio"],
                "ejecucion_fin_previsto": mi["fases"][-1]["fin_previsto"],
                "avance_fisico": mi["avance_fisico_fase"],
                "avance_fisico_encabezado": mi["avance_fisico_encabezado"],
                "avance_financiero": mi["avance_financiero"],
                "fecha_corte_avance": mi["fecha_corte_avance"],
            },
            "url_origen": "https://www.obrapublica.info/taras-lima",
        },
        {
            "id": "puente-circunvalacion",
            "nombre": "Puente Circunvalación",
            "nombre_alterno": None,
            "que_es": mapas["Puente Circunvalación"]["descripcion"],
            "ubicacion": "San José (ubicación exacta no publicada)",
            "lat": mapas["Puente Circunvalación"]["lat"], "lon": mapas["Puente Circunvalación"]["lon"],
            "coordenadas_aprox": True,
            "ejecutor": None,
            "fuentes": ["dIAra (CGR)"],
            "evidencia_desde": None,
            "evidencia_hasta": None,
            "dias_con_imagenes": 0,
            "imagenes": 0,
            "plan_oficial": None,
            "url_origen": "https://www.obrapublica.info/map?city=San%20Jos%C3%A9%2C%20Costa%20Rica",
        },
    ]

    escribir_json(WEB_DATOS / "obras.json", {"generado": ahora_iso(), "fecha_corte": fecha_corte, "obras": obras, "cruces": cruces})
    campos_img = ["id_imagen", "archivo_imagen", "fecha", "hora", "analizable", "error", "personas", "cero_no_verificable",
                  "maquinaria", "estructuras_temporales", "etapas", "actividad", "clima", "visibilidad", "riesgo",
                  "casco", "chaleco", "arnes", "barandas", "observacion_seguridad"]
    escribir_json(WEB_DATOS / "limoncito.json", {
        "meta": meta | {"estadisticas_publicadas": None},
        "confiabilidad": confiabilidad,
        "url_imagenes": "https://www.obrapublica.info/static/limoncito/data/images/",
        "dias": dias,
        "semanas": resumen_semanal(dias),
        "imagenes": [{k: i.get(k) for k in campos_img if i.get(k) not in (None, [], "")} for i in imgs],
    }, compacto=True)
    escribir_json(WEB_DATOS / "taras.json", {"diara": taras, "mideplan": mi}, compacto=True)

    procedencia = {
        "generado": ahora_iso(),
        "descargas": descargas,
        "bitacora": bitacora["pasos"],
        "cruces": cruces,
    }
    escribir_json(WEB_DATOS / "procedencia.json", procedencia, compacto=True)
    escribir_procedencia_md(procedencia, confiabilidad)
    print(f"Listo: web/datos actualizado (fecha de corte {fecha_corte})")


def escribir_procedencia_md(p: dict, conf: dict) -> None:
    arch = p["descargas"]["archivos"]
    por_fuente = Counter(a["fuente"] for a in arch)
    lineas = [
        "# Registro de procedencia de los datos",
        "",
        f"_Generado automáticamente por `pipeline/p3_integrar.py` el {p['generado']}. No editar a mano._",
        "",
        "## 1. Fuentes",
        "",
        "| Fuente | Archivos | Qué aporta |",
        "|---|---:|---|",
        f"| obrapublica.info (CGR, dIAra) | {por_fuente['obrapublica.info (CGR - dIAra)']} | Análisis por imagen hecho por IA, resúmenes diarios, metadatos de obras, serie del tablero Taras–La Lima |",
        f"| MapaInversiones (MIDEPLAN) | {por_fuente['MapaInversiones (MIDEPLAN)']} | Costo, fases con fechas, avance físico y financiero; listados por cantón para el cruce |",
        "",
        "Cada archivo crudo tiene URL, fecha y hora de descarga, estado HTTP, tamaño y huella SHA-256 en "
        "`datos/crudos/_registro_descargas.json`. Muestra:",
        "",
        "| Archivo | URL | Descargado | SHA-256 (12) |",
        "|---|---|---|---|",
    ]
    muestra = [a for a in arch if not a["archivo"].startswith("obrapublica/limoncito/dias/2026010")][:12]
    for a in muestra:
        lineas.append(f"| `{a['archivo']}` | {a['url']} | {a['descargado']} | `{a['sha256'][:12]}` |")
    lineas += [
        "",
        "## 2. Bitácora de limpieza y transformación",
        "",
        "| Fuente | Regla aplicada | Registros | Detalle |",
        "|---|---|---:|---|",
    ]
    for b in p["bitacora"]:
        lineas.append(f"| {b['etapa']} | {b['regla']} | {b.get('registros_afectados', '')} | {b.get('detalle', '')} |")
    lineas += [
        "",
        "## 3. Cruce entre fuentes",
        "",
        "| Obra (dIAra) | Método | Candidatos | Decisión | Confianza |",
        "|---|---|---|---|---|",
    ]
    for c in p["cruces"]:
        cands = "; ".join(f"{x['id']}" for x in c["candidatos"]) or "ninguno"
        lineas.append(f"| {c['obra']} | {c['metodo']} | {cands} | {c['decision']}: {c['justificacion']} | {c['confianza']} |")
    pct = lambda a, b: f"{100 * a / b:.0f} %"  # noqa: E731
    lineas += [
        "",
        "## 4. Confiabilidad de la evidencia de Limoncito",
        "",
        f"- Imágenes analizables: {conf['imagenes_analizables']} de {conf['imagenes_totales']} ({pct(conf['imagenes_analizables'], conf['imagenes_totales'])}).",
        f"- Imágenes con visibilidad 'Mala': {conf['imagenes_vis_mala']} ({pct(conf['imagenes_vis_mala'], conf['imagenes_analizables'])} de las analizables).",
        f"- Imágenes sin etapa determinable: {conf['imagenes_etapa_nd']}.",
        f"- Conteos de 0 personas que no se pueden verificar (visibilidad mala): {conf['ceros_no_verificables']}.",
        f"- Días con lecturas de etapa contradictorias: {conf['dias_contradictorios']} de {conf['dias']}.",
        "",
        "## 5. Limitaciones conocidas",
        "",
        "- dIAra no publica las cajas de detección ni la confianza del modelo, así que no se pueden dibujar las detecciones sobre la imagen.",
        "- El CSV que usa el chatbot (`predictions_final.csv`) no es descargable; la serie de Taras–La Lima solo trae 5 de los días que cita.",
        "- MapaInversiones no publica la fecha de corte del avance físico ni un cronograma por actividades.",
        "- La Escuela de Limoncito no aparece en MapaInversiones: no hay plan oficial con qué comparar el avance observado.",
        "- Las imágenes se enlazan desde obrapublica.info; si el servidor las retira, la web muestra un aviso en su lugar.",
        "",
    ]
    (RAIZ / "PROCEDENCIA.md").write_text("\n".join(lineas), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())

"""Paso 1 - Extraccion.

Descarga, sin modificar, los datos publicos que usa ObraClara y deja un
registro de procedencia por archivo (URL, fecha y hora, estado HTTP, tamano y
huella SHA-256). Los archivos crudos nunca se editan a mano: toda correccion
ocurre en el paso 2 y queda en la bitacora.

Fuentes:
  A. obrapublica.info (CGR, proyecto dIAra)
     - Portal de la Escuela/Colegio de Limoncito: manifiesto, analisis por
       imagen (JSON por dia) y resumen diario generado por IA (TXT por dia).
     - Mapa de Cartago y de San Jose: metadatos de las obras (nombre,
       coordenadas, enlaces).
     - Tablero Taras-La Lima: serie diaria incrustada en el HTML.
  B. MapaInversiones (MIDEPLAN)
     - Ficha del proyecto 18394 (intercambios La Lima y Taras): costo,
       fases con fechas, avance fisico y financiero.
     - Listados por canton (Limon 701, Cartago 301, San Jose 101) para buscar
       la correspondencia entre obras.
"""
from __future__ import annotations

import json
import sys
import urllib.parse

from comun import CRUDOS, REGISTRO_DESCARGAS, ahora_iso, descargar, escribir_json, sha256

OP = "https://www.obrapublica.info"
MI = "https://rendircuentas.mideplan.go.cr"

registro: list[dict] = []


def guardar(url: str, destino: str, fuente: str, descripcion: str) -> bytes:
    contenido, estado, tipo = descargar(url)
    ruta = CRUDOS / destino
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(contenido)
    registro.append({
        "archivo": destino,
        "fuente": fuente,
        "descripcion": descripcion,
        "url": url,
        "descargado": ahora_iso(),
        "estado_http": estado,
        "tipo_contenido": tipo,
        "bytes": len(contenido),
        "sha256": sha256(contenido),
    })
    return contenido


def descargar_limoncito() -> None:
    base = f"{OP}/static/limoncito/data"
    man = json.loads(guardar(f"{base}/json/manifest.json", "obrapublica/limoncito/manifest.json",
                             "obrapublica.info (CGR - dIAra)", "Manifiesto de fechas y estadisticas del portal Limoncito"))
    fechas = man.get("dates", [])
    print(f"Limoncito: {len(fechas)} fechas en el manifiesto")
    for i, f in enumerate(fechas, 1):
        guardar(f"{base}/json/{f}/index.json", f"obrapublica/limoncito/dias/{f}.json",
                "obrapublica.info (CGR - dIAra)", f"Analisis por imagen del {f}")
        try:
            guardar(f"{base}/resumenes/{f}.txt", f"obrapublica/limoncito/resumenes/{f}.txt",
                    "obrapublica.info (CGR - dIAra)", f"Resumen diario generado por IA del {f}")
        except RuntimeError as e:
            print(f"  aviso: sin resumen para {f}: {e}")
        if i % 10 == 0:
            print(f"  {i}/{len(fechas)} dias")


def descargar_obrapublica_mapas() -> None:
    for ciudad, archivo in [("Cartago, Costa Rica", "mapa_cartago.html"), ("San José, Costa Rica", "mapa_san_jose.html")]:
        url = f"{OP}/map?city={urllib.parse.quote(ciudad)}"
        guardar(url, f"obrapublica/{archivo}", "obrapublica.info (CGR - dIAra)", f"Mapa de obras: {ciudad}")
    guardar(f"{OP}/taras-lima", "obrapublica/tablero_taras_lima.html", "obrapublica.info (CGR - dIAra)",
            "Tablero de la obra Taras-La Lima (serie diaria incrustada)")
    guardar(f"{OP}/list-csv", "obrapublica/list_csv.json", "obrapublica.info (CGR - dIAra)",
            "Lista de archivos que usa el chatbot (el CSV no es descargable)")


def descargar_mideplan() -> None:
    guardar(f"{MI}/proyecto/perfilproyecto/18394", "mapainversiones/perfil_18394.html",
            "MapaInversiones (MIDEPLAN)", "Ficha: intercambios viales La Lima y Taras, RN 2, Cartago")
    for canton, nombre in [("701", "limon"), ("301", "cartago"), ("101", "san_jose")]:
        pagina, total = 1, 1
        while pagina <= total:
            url = f"{MI}/api/serviciosproyectos/listado?page={pagina}&departamento={canton}"
            datos = json.loads(guardar(url, f"mapainversiones/listado_{nombre}_p{pagina:02d}.json",
                                       "MapaInversiones (MIDEPLAN)", f"Listado de proyectos del canton {canton}, pagina {pagina}"))
            total = datos.get("totalPages", 1)
            pagina += 1
        print(f"MapaInversiones canton {canton}: {total} paginas")


def main() -> None:
    print("Paso 1 - Descarga de fuentes publicas")
    descargar_limoncito()
    descargar_obrapublica_mapas()
    descargar_mideplan()
    escribir_json(REGISTRO_DESCARGAS, {"generado": ahora_iso(), "archivos": registro})
    print(f"Listo: {len(registro)} archivos descargados. Registro en {REGISTRO_DESCARGAS.name}")


if __name__ == "__main__":
    sys.exit(main())

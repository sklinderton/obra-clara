"""Utilidades compartidas del pipeline de ObraClara.

Solo usa la biblioteca estándar de Python (3.10+) para que cualquier persona
pueda reproducir el proceso sin instalar dependencias.
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CRUDOS = RAIZ / "datos" / "crudos"
PROCESADOS = RAIZ / "datos" / "procesados"
WEB_DATOS = RAIZ / "web" / "datos"
REGISTRO_DESCARGAS = CRUDOS / "_registro_descargas.json"

AGENTE = "ObraClara-pipeline/1.0 (proyecto academico de visualizacion de datos)"


def ahora_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def sha256(datos: bytes) -> str:
    return hashlib.sha256(datos).hexdigest()


def descargar(url: str, intentos: int = 3, pausa: float = 0.25) -> tuple[bytes, int, str]:
    """Descarga una URL y devuelve (contenido, estado_http, tipo_contenido)."""
    ultimo_error: Exception | None = None
    for intento in range(intentos):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
            with urllib.request.urlopen(req, timeout=40) as r:
                contenido = r.read()
                time.sleep(pausa)  # cortesia con los servidores publicos
                return contenido, r.status, r.headers.get("Content-Type", "")
        except Exception as e:  # noqa: BLE001 - se reintenta cualquier fallo de red
            ultimo_error = e
            time.sleep(1.5 * (intento + 1))
    raise RuntimeError(f"No se pudo descargar {url}: {ultimo_error}")


def leer_json(ruta: Path):
    return json.loads(ruta.read_text(encoding="utf-8"))


def escribir_json(ruta: Path, datos, compacto: bool = False) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    if compacto:
        texto = json.dumps(datos, ensure_ascii=False, separators=(",", ":"))
    else:
        texto = json.dumps(datos, ensure_ascii=False, indent=2)
    ruta.write_text(texto + "\n", encoding="utf-8")


class Bitacora:
    """Registro de transformaciones: cada regla aplicada queda documentada
    con cuantos registros afecto, para poder auditar la limpieza."""

    def __init__(self) -> None:
        self.pasos: list[dict] = []

    def anotar(self, etapa: str, regla: str, afectados: int | None = None, detalle: str = "") -> None:
        paso = {"etapa": etapa, "regla": regla}
        if afectados is not None:
            paso["registros_afectados"] = afectados
        if detalle:
            paso["detalle"] = detalle
        self.pasos.append(paso)
        sufijo = f" ({afectados})" if afectados is not None else ""
        print(f"  [{etapa}] {regla}{sufijo}")

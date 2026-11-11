"""Ejecuta el pipeline completo de ObraClara.

Uso:
    python pipeline/ejecutar.py              # descarga + limpieza + integracion
    python pipeline/ejecutar.py --sin-descarga   # reprocesa los datos crudos guardados
"""
import sys

import p1_descargar
import p2_transformar
import p3_integrar

if __name__ == "__main__":
    if "--sin-descarga" not in sys.argv:
        p1_descargar.main()
    p2_transformar.main()
    p3_integrar.main()

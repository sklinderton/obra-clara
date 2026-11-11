# Registro de procedencia de los datos

_Generado automáticamente por `pipeline/p3_integrar.py` el 2026-11-11T16:22:31-06:00. No editar a mano._

## 1. Fuentes

| Fuente | Archivos | Qué aporta |
|---|---:|---|
| obrapublica.info (CGR, dIAra) | 159 | Análisis por imagen hecho por IA, resúmenes diarios, metadatos de obras, serie del tablero Taras–La Lima |
| MapaInversiones (MIDEPLAN) | 55 | Costo, fases con fechas, avance físico y financiero; listados por cantón para el cruce |

Cada archivo crudo tiene URL, fecha y hora de descarga, estado HTTP, tamaño y huella SHA-256 en `datos/crudos/_registro_descargas.json`. Muestra:

| Archivo | URL | Descargado | SHA-256 (12) |
|---|---|---|---|
| `obrapublica/limoncito/manifest.json` | https://www.obrapublica.info/static/limoncito/data/json/manifest.json | 2026-11-11T16:06:38-06:00 | `889d8f3e4d7a` |
| `obrapublica/limoncito/resumenes/20260101.txt` | https://www.obrapublica.info/static/limoncito/data/resumenes/20260101.txt | 2026-11-11T16:06:39-06:00 | `e7dd8f598453` |
| `obrapublica/limoncito/resumenes/20260102.txt` | https://www.obrapublica.info/static/limoncito/data/resumenes/20260102.txt | 2026-11-11T16:06:40-06:00 | `03e5b573b06c` |
| `obrapublica/limoncito/resumenes/20260105.txt` | https://www.obrapublica.info/static/limoncito/data/resumenes/20260105.txt | 2026-11-11T16:06:42-06:00 | `94139ddbae02` |
| `obrapublica/limoncito/resumenes/20260106.txt` | https://www.obrapublica.info/static/limoncito/data/resumenes/20260106.txt | 2026-11-11T16:06:43-06:00 | `b56eceedbb15` |
| `obrapublica/limoncito/resumenes/20260107.txt` | https://www.obrapublica.info/static/limoncito/data/resumenes/20260107.txt | 2026-11-11T16:06:44-06:00 | `8edfd4279a40` |
| `obrapublica/limoncito/resumenes/20260108.txt` | https://www.obrapublica.info/static/limoncito/data/resumenes/20260108.txt | 2026-11-11T16:06:45-06:00 | `e3138fabe390` |
| `obrapublica/limoncito/resumenes/20260109.txt` | https://www.obrapublica.info/static/limoncito/data/resumenes/20260109.txt | 2026-11-11T16:06:47-06:00 | `3ee3a2a42c2b` |
| `obrapublica/limoncito/dias/20260112.json` | https://www.obrapublica.info/static/limoncito/data/json/20260112/index.json | 2026-11-11T16:06:47-06:00 | `1081db305021` |
| `obrapublica/limoncito/resumenes/20260112.txt` | https://www.obrapublica.info/static/limoncito/data/resumenes/20260112.txt | 2026-11-11T16:06:48-06:00 | `98cff7ec6715` |
| `obrapublica/limoncito/dias/20260113.json` | https://www.obrapublica.info/static/limoncito/data/json/20260113/index.json | 2026-11-11T16:06:48-06:00 | `bec75044061c` |
| `obrapublica/limoncito/resumenes/20260113.txt` | https://www.obrapublica.info/static/limoncito/data/resumenes/20260113.txt | 2026-11-11T16:06:49-06:00 | `2494c43addbd` |

## 2. Bitácora de limpieza y transformación

| Fuente | Regla aplicada | Registros | Detalle |
|---|---|---:|---|
| Limoncito | Imágenes con error 'Imagen no analizable' conservadas y marcadas analizable=false (no se borran) | 19 |  |
| Limoncito | Etapa constructiva en formato lista o texto con comas convertida a lista canónica ordenada | 28 |  |
| Limoncito | Etapa vacía o 'No determinable' convertida a dato faltante explícito | 66 |  |
| Limoncito | Tildes restituidas en etiquetas del vocabulario (Mampostería, Grúa torre, Camión, Sí, etc.) | 579 | Andamios metalicos: 199, Grua torre: 161, Si: 73, Generador electrico: 49, Camion mixer: 45, Grua movil: 25, Mamposteria: 18, Camion de volteo: 9 |
| Limoncito | 'Andamios metálicos' reclasificados de maquinaria a estructura temporal | 193 |  |
| Limoncito | Conteo de 0 personas con visibilidad 'Mala' marcado como no verificable | 125 |  |
| Limoncito | Accesibilidad universal 0 % antes de acabados tratada como 'no evaluable' (null) | 365 |  |
| Limoncito | Registros sin campo 'elementos_constructivos' completados con lista vacía | 1 |  |
| Limoncito | Días con lecturas de etapa sin ninguna etapa en común entre imágenes (contradicción marcada, no corregida) | 17 |  |
| Limoncito | Cobertura: días hábiles sin imágenes entre la primera y la última fecha | 0 | 77 días hábiles entre 2026-01-01 y 2026-04-17 |
| Taras-La Lima | Serie diaria reordenada cronológicamente (el tablero original la muestra desordenada) | 5 |  |
| Taras-La Lima | Fechas citadas en máximos/mínimos que no existen en la serie publicada | 4 | 2024-06-09, 2024-06-16, 2024-06-22, 2024-06-26 |
| Mapas | Metadatos de obras extraídos del código del mapa (nombre, descripción, coordenadas, enlaces) | 2 |  |
| MapaInversiones | Fechas dd/mm/aaaa y porcentajes con coma decimal convertidos a ISO 8601 y número | 4 |  |
| MapaInversiones | Discrepancia: avance físico del encabezado distinto al de la fase en ejecución (se muestran ambos) | 1 | encabezado 54.4 % vs fase 54.0 % |
| MapaInversiones | Listados paginados unidos en una tabla; espacios sobrantes en nombres eliminados | 265 |  |

## 3. Cruce entre fuentes

| Obra (dIAra) | Método | Candidatos | Decisión | Confianza |
|---|---|---|---|---|
| limoncito | Búsqueda de 'Limoncito' o 'Cieneguita' en los 68 proyectos del cantón Limón (701) | 339 | Sin cruce: El único resultado es la canalización del río Limoncito (SENARA), que es otra obra. La escuela no aparece en MapaInversiones, así que no hay plazo ni monto oficial con qué comparar. | — |
| taras-la-lima | Búsqueda de 'Taras' o 'La Lima' en los 33 proyectos del cantón Cartago (301) y verificación de ubicación | 18394; 22915 | Cruce con 18394: El nombre coincide (intercambios de La Lima y Taras), el distrito es San Nicolás de Cartago y las coordenadas de dIAra corresponden a La Lima, Taras, San Nicolás (verificado con OpenStreetMap). Se descarta 22915 (eje ciclista, otra obra). | Alta |
| puente-circunvalacion | Búsqueda de 'Circunvalación' en los 164 proyectos del cantón San José (101) | 23508; 1317 | Sin cruce: Hay dos candidatos sobre la Ruta 39, pero la ficha de dIAra solo dice 'Puente Circunvalación', sus coordenadas son las mismas que usa el mapa por defecto y no publica datos. No se asume el cruce. | Baja |

## 4. Confiabilidad de la evidencia de Limoncito

- Imágenes analizables: 366 de 385 (95 %).
- Imágenes con visibilidad 'Mala': 164 (45 % de las analizables).
- Imágenes sin etapa determinable: 66.
- Conteos de 0 personas que no se pueden verificar (visibilidad mala): 125.
- Días con lecturas de etapa contradictorias: 17 de 77.

## 5. Limitaciones conocidas

- dIAra no publica las cajas de detección ni la confianza del modelo, así que no se pueden dibujar las detecciones sobre la imagen.
- El CSV que usa el chatbot (`predictions_final.csv`) no es descargable; la serie de Taras–La Lima solo trae 5 de los días que cita.
- MapaInversiones no publica la fecha de corte del avance físico ni un cronograma por actividades.
- La Escuela de Limoncito no aparece en MapaInversiones: no hay plan oficial con qué comparar el avance observado.
- Las imágenes se enlazan desde obrapublica.info; si el servidor las retira, la web muestra un aviso en su lugar.

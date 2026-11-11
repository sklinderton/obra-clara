# ObraClara · ¿Cómo va la obra?

Prototipo funcional de la **Fase III** del Proyecto Integrador de Visualización de Datos (Universidad Lead, 2026).
Equipo: Jason Barrantes, Deykel Bernard y Nicole Camacho.

ObraClara toma la evidencia de campo que publica la Contraloría (proyecto dIAra, en obrapublica.info) y la
cruza con el plan oficial que publica MIDEPLAN (MapaInversiones), para que una persona sin formación técnica
pueda responder desde el celular tres preguntas: **qué se construye y dónde**, **si va según lo planeado** y
**qué tan confiables son los datos**. Regla de diseño: *ningún dato se muestra sin decir de cuándo es, de dónde
viene y qué significa*.

## Estructura

```
obra-clara/
├── pipeline/                 # Preparación de datos (Python 3.10+, solo biblioteca estándar)
│   ├── p1_descargar.py       # 1. Extracción: descarga cruda + registro de procedencia (URL, hora, SHA-256)
│   ├── p2_transformar.py     # 2. Limpieza y transformación por fuente + bitácora de reglas
│   ├── p3_integrar.py        # 3. Cruce entre fuentes, indicadores y datos para la web
│   └── ejecutar.py           # Corre los tres pasos
├── datos/
│   ├── crudos/               # Archivos tal como se descargaron (no se editan)
│   │   └── _registro_descargas.json
│   └── procesados/           # Tablas limpias (CSV/JSON), bitácora y cruce de fuentes
├── web/                      # Sitio estático (HTML + CSS + JS sin dependencias)
│   ├── index.html, estilos.css, graficos.js, app.js
│   └── datos/                # JSON generados por el pipeline
├── PROCEDENCIA.md            # Registro legible de fuentes, limpieza y cruces (generado)
└── .github/workflows/actualizar-datos.yml   # Actualización automática semanal
```

## Cómo reproducirlo

```bash
python pipeline/ejecutar.py                 # descarga todo y regenera (unos 2 minutos)
python pipeline/ejecutar.py --sin-descarga  # solo reprocesa los datos crudos guardados
python -m http.server 8765 --directory web  # abrir http://localhost:8765
```

La web necesita servirse por HTTP (no abre con doble clic porque carga los JSON con `fetch`). Para publicarla,
basta con GitHub Pages apuntando a la carpeta `web/`.

## Fuentes

| Fuente | Qué aporta | Acceso |
|---|---|---|
| obrapublica.info – portal Limoncito (CGR, dIAra) | 385 imágenes analizadas por IA (77 días hábiles, 1 ene – 17 abr 2026) y resúmenes diarios | `/static/limoncito/data/json/manifest.json` y un JSON por día |
| obrapublica.info – tablero Taras–La Lima | Serie de detecciones diarias (5 días de 2024) | Datos incrustados en el HTML del tablero |
| obrapublica.info – mapas | Nombre, descripción, coordenadas y enlaces de cada obra | Código del mapa (Folium) |
| MapaInversiones (MIDEPLAN) – proyecto 18394 | Costo, fases con fechas, avance físico y financiero | Atributos `data-profile` y `data-avance` de la ficha |
| MapaInversiones – listados por cantón | Búsqueda de correspondencias entre obras | `/api/serviciosproyectos/listado` |

El detalle completo (cada archivo con su huella, cada regla de limpieza y cada cruce con su confianza) está en
[PROCEDENCIA.md](PROCEDENCIA.md).

## Decisiones de visualización

| Pregunta ciudadana | Forma | Por qué |
|---|---|---|
| ¿Va según lo planeado? | Barras sobre escala 0–100 %: plazo transcurrido vs avance físico vs avance financiero | Posición sobre escala común, la tarea más precisa según Cleveland y McGill |
| ¿Cuáles son los hitos y plazos? | Línea de tiempo de fases con línea “Hoy” y tramo rayado de atraso | El atraso se ve como longitud, sin cálculo mental |
| ¿Qué se estuvo construyendo? | Mapa de calor semana × etapa (escala secuencial de un solo tono) | Muestra la secuencia y la incertidumbre (porcentaje de imágenes), no una sola etiqueta por día |
| ¿Cuánta gente trabajó? | Rango diario (mín.–máx.) con mediana y tramo rayado “sin imágenes” | Reemplaza el gráfico desordenado y el circular del tablero original; el hueco no se lee como “cero trabajo” |
| ¿Qué tan confiables son los datos? | Barras de porcentaje de problemas de calidad | Divulga la incertidumbre en vez de esconderla |
| ¿Puedo comprobarlo? | Calendario de días disponibles + visor de foto junto a la lectura de la IA | Resuelve el selector de fechas confuso de la prueba de usabilidad |
| ¿Qué me llega sin entrar? | Resumen semanal y alerta listos para WhatsApp | Canal complementario propuesto en la Fase II |

Accesibilidad: tipografía Atkinson Hyperlegible, botón “A+” para agrandar el texto, alertas con ícono y texto
(nunca solo color), tooltips accesibles con teclado, tabla de datos bajo cada gráfico, modo oscuro y nada que
desaparezca solo.

## Limitaciones

- dIAra no publica cajas de detección ni la confianza del modelo, por lo que no se pueden marcar detecciones sobre la foto.
- MapaInversiones no publica la fecha de corte del avance físico.
- La Escuela de Limoncito no aparece en MapaInversiones: no hay plan oficial con qué comparar.
- Las imágenes se enlazan desde obrapublica.info; si el servidor las retira, el visor muestra un aviso.

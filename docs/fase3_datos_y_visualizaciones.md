# Fase III · Preparación de datos y desarrollo de las visualizaciones

Texto base para el informe (responsable: Jason Barrantes). Las cifras salen de `PROCEDENCIA.md` y de
`datos/procesados/`, generados el 11 de noviembre de 2026.

## 1. Preparación, limpieza, transformación e integración de los datos, con registro de procedencia

**Fuentes.** Usamos dos fuentes públicas complementarias. La primera es obrapublica.info (CGR, proyecto dIAra),
que muestra lo que se ve en la obra. De ahí tomamos el análisis por IA de 385 imágenes de la Escuela de Limoncito
(77 días hábiles, del 1 de enero al 17 de abril de 2026), sus resúmenes diarios, la serie del tablero
Taras–La Lima y los metadatos de las obras en el mapa. La segunda es MapaInversiones (MIDEPLAN), que muestra lo
que dice el plan: costo, fases con fechas y avance físico y financiero del proyecto 18394, además de los listados
de 265 proyectos de los cantones de Limón, Cartago y San José, que usamos para cruzar las obras.

**Proceso reproducible en tres pasos** (`pipeline/`, Python sin dependencias externas):

1. *Extracción.* Se descargan 214 archivos sin modificarlos. Por cada uno queda la URL, la fecha y hora, el estado
   HTTP, el tamaño y la huella SHA-256 (`datos/crudos/_registro_descargas.json`). La huella permite detectar si
   la fuente cambió entre una descarga y otra.
2. *Limpieza y transformación.* Ninguna corrección se hace a mano. Cada regla queda en una bitácora con el número
   de registros que modificó. Las principales:
   - La etapa constructiva llegaba en cuatro formatos (texto, texto con comas, lista serializada y vacío). Se
     convirtió a una lista canónica ordenada según la secuencia constructiva (28 registros) y los 66 vacíos o “No
     determinable” pasaron a ser un dato faltante explícito.
   - Se restituyeron 579 tildes en el vocabulario (Mampostería, Grúa torre, Sí…).
   - Los andamios metálicos se reclasificaron de maquinaria a estructura temporal (193 imágenes), porque inflaban
     el conteo de maquinaria.
   - Los 125 conteos de “0 personas” tomados con visibilidad “Mala” se marcaron como no verificables.
   - La accesibilidad universal valía 0 % en 365 imágenes de una obra en estructura. Se trató como “no evaluable”
     y no como 0 %.
   - Las 19 imágenes con error se conservaron marcadas, sin borrarse.
   - En Taras–La Lima, la serie se reordenó cronológicamente. Además, se documentó que el tablero cita máximos de
     4 días que no publica y que su promedio de personas (1,74) no sale de los datos publicados (2,55).
   - En MapaInversiones, las fechas dd/mm/aaaa y los decimales con coma se pasaron a ISO 8601. Se registró la
     discrepancia entre el avance físico del encabezado (54,40 %) y el de la fase (54,00 %).
   - Las inconsistencias se marcan, no se corrigen. Por ejemplo, hay 17 días con lecturas de etapa sin nada en
     común entre imágenes del mismo día.
3. *Integración.* dIAra y MapaInversiones no comparten un identificador, así que cruzamos las obras por nombre y
   ubicación y declaramos la confianza de cada cruce:
   - Taras–La Lima corresponde al proyecto 18394, con confianza alta: el nombre coincide y las coordenadas
     corresponden a La Lima de Taras, según OpenStreetMap.
   - La Escuela de Limoncito no aparece en MapaInversiones.
   - El Puente Circunvalación tiene dos candidatos que no se asumen.

   Con los datos integrados se calculan indicadores de frescura (días desde la última imagen), completitud (días
   hábiles cubiertos) y confiabilidad (imágenes analizables, visibilidad mala, etapa no determinable y días
   contradictorios).

**Automatización.** Un flujo de GitHub Actions ejecuta el pipeline cada lunes y publica los cambios. Esto atiende
la recomendación de los evaluadores externos de automatizar la actualización.

## 2. Desarrollo de las visualizaciones y de la experiencia funcional en el canal seleccionado

**Canal.** Es una web pensada primero para el celular, como propusimos en la Fase II, complementada con mensajes
para WhatsApp: un resumen semanal y una alerta de plazo, que se envían con un botón. No requiere instalar nada.

**Experiencia.** Tiene cuatro vistas:

- **Inicio:** las obras con su estado y una tabla para compararlas.
- **Ficha por obra:** sigue el orden de las preguntas orientadoras: qué se construye, si va según lo planeado,
  hitos, actividad y confiabilidad.
- **Explorador de días:** permite comprobar cada lectura de la IA frente a su foto.
- **Fuentes y método:** muestra el registro de procedencia dentro de la propia web.

**Visualizaciones y principios aplicados (Cairo, 2013):**

- *¿Va según lo planeado?* (Taras–La Lima). Usamos barras sobre una escala común de 0 a 100 % para comparar el
  plazo transcurrido (140 %, vencido), el avance físico (54 %) y el avance financiero (55 %), y una línea de
  tiempo de fases con la línea “Hoy” y el atraso rayado. Así la respuesta (“No: el plazo venció hace 20 meses”)
  queda escrita en lenguaje claro y además se ve. Se eligió la posición sobre una escala común por ser la más
  precisa según Cleveland y McGill.
- *¿Qué se estuvo construyendo?* (Limoncito). Un mapa de calor de semana por etapa con escala secuencial de un
  solo tono muestra la secuencia (la estructura de concreto domina y la cubierta aparece desde marzo) y la
  incertidumbre. Los puntos naranjas marcan las semanas con lecturas contradictorias.
- *¿Cuánta gente trabajó?* Un gráfico de rango diario (mínimo–máximo y mediana), en orden cronológico, reemplaza
  el gráfico de líneas desordenado y el circular del tablero original. Un tramo rayado con eje cortado muestra
  los 208 días sin imágenes, para que el hueco no se lea como ausencia de trabajo. Una nota fija recuerda que más
  personas no significa más avance.
- *Divulgación de incertidumbre.* Cada página empieza con la antigüedad de sus datos (“Estos datos tienen 7
  meses”). Un gráfico de confiabilidad indica que en el 45 % de las imágenes la visibilidad es mala. Cuando no hay
  dato, la página lo dice (“No se puede saber con los datos públicos”) en lugar de inventarlo.
- *Información útil sin conocer el avance real.* Atendiendo a los evaluadores externos, para Limoncito, que no
  tiene plan oficial, mostramos señales observables: 56 de 77 días con trabajo visible, la grúa torre presente
  en 43 días y la secuencia de etapas. Las presentamos explícitamente como señales de actividad, no de avance.
- *Accesibilidad e inclusión.* Usamos la tipografía Atkinson Hyperlegible, un botón “A+”, alertas con ícono y
  texto (nunca solo color), tooltips operables con teclado, una tabla de datos bajo cada gráfico, modo oscuro y
  un trato de “usted” consistente. Ningún mensaje se cierra solo.

**Respuesta a la retroalimentación de la Fase II.** Los bocetos “poco amigables” pasaron a ser un prototipo
funcional:

- El selector de fechas que confundió al participante ahora es un calendario que distingue los días con
  imágenes, los fines de semana y los días sin datos.
- Las detecciones que no se podían verificar se muestran junto a su foto, con el aviso de que dIAra no publica
  dónde detectó a cada persona.

## Referencias

Cairo, A. (2013). *The functional art: An introduction to information graphics and visualization*. New Riders.

Contraloría General de la República. (2026). *Obra Pública: Monitoreo ciudadano*. https://www.obrapublica.info/

Ministerio de Planificación Nacional y Política Económica. (2026). *MapaInversiones Costa Rica, proyecto 18394*.
https://rendircuentas.mideplan.go.cr/proyecto/perfilproyecto/18394

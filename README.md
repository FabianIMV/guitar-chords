# 🎸 Acordes

Buscador rápido de **acordes y letras** de canciones, **sin publicidad**.
Busca en **CifraClub, Ultimate Guitar, LaCuerda y TusAcordes** a la vez,
agrupa versiones y abre la mejor valorada con letra, acordes alineados,
diagramas, cambio de tono y cejilla.

Es una **PWA** pensada para iPhone: ábrela en Safari y añádela a la pantalla
de inicio para usarla a pantalla completa, como app nativa.

## 🚀 Acceso rápido

- **Abrir la app:** https://fabianimv.github.io/guitar-chords/
- **Repositorio:** https://github.com/FabianIMV/guitar-chords
- **Guía del backend (Worker):** https://github.com/FabianIMV/guitar-chords/tree/main/worker

## Funciones

**Búsqueda**
- 🔎 4 fuentes en paralelo; los resultados aparecen **a medida que llegan**
  (una fuente lenta no bloquea a las demás) con el estado de cada una.
- 🧩 **Versiones agrupadas**: la misma canción de varias fuentes aparece una
  sola vez ("24 versiones"); al tocarla se abre la mejor valorada
  (promedio bayesiano de estrellas y votos de Ultimate Guitar, versión
  principal de CifraClub…). Puedes desplegar y elegir otra.
- 🎯 Ordenadas por coincidencia con lo que escribiste y popularidad;
  tolera tildes y errores de tipeo ("califronia").
- 🕑 Búsquedas recientes y canciones abiertas recientemente.
- 🔗 Pega el enlace de una canción de cualquiera de las fuentes para abrirla.

**Canción**
- 📱 **Formato ajustado**: en el teléfono las líneas largas se acomodan al
  ancho y cada acorde viaja con su sílaba (o formato original monoespaciado).
- 🎚️ **Tono** (±semitonos) con la grafía correcta (B♭, no A#) y
  **cejilla** con sugerencia automática de la posición más fácil
  ("Más fácil con cejilla 3 · formas de G"). Se recuerdan por canción.
- 🎼 Tono detectado (del sitio o deducido de los acordes); cejilla,
  afinación y dificultad cuando el sitio los informa.
- 🔤 Notación **C D E** o **Do Re Mi** (también lee sitios en Do-Re-Mi).
- 🎸 Diagramas de toda la canción con cejilla dibujada; toca un acorde para
  verlo en grande y recorrer **posiciones alternativas**.
- ▶️ **Auto-scroll** con velocidad recordada por canción; se pausa mientras
  tocas la pantalla.
- 💡 **Pantalla siempre encendida** mientras la canción está abierta.
- 🎵 Reproductor de **YouTube** acoplado para tocar encima.
- 🤏 Pellizca la letra para cambiar el tamaño.
- ↩️ Botón/gesto **atrás** y **enlaces directos**: Compartir envía un link que
  abre la canción dentro de la app.

**Biblioteca y datos**
- ♥ **Favoritos sin conexión** (se guardan completos, con tu tono y cejilla),
  con filtro y "deshacer".
- 💾 Exportar / importar copia de seguridad (JSON).
- 🌗 Tema claro, oscuro o automático.
- 🐞 Diagnóstico: registro de red y qué ruta funciona para cada sitio.

## Cómo funciona el scraping

GitHub Pages solo sirve archivos estáticos y los sitios no envían cabeceras
CORS, así que todo pasa por una capa de red (`src/lib/proxy.ts`) con varias
rutas:

1. **Tu Worker de Cloudflare** (`worker/`): rápido, envía User-Agent/Referer
   de navegador. Es la ruta por defecto.
2. **Jina Reader** (`r.jina.ai`): renderiza con un navegador real y pasa
   muros anti-bot que el Worker no (las páginas de canción de CifraClub
   están tras Akamai, que bloquea las IPs de Cloudflare). Le pedimos solo el
   bloque de acordes (`X-Target-Selector`): ~30 KB en vez de ~500 KB.
3. Proxies CORS públicos como último recurso.

Lo que la hace robusta:
- **Validación de contenido**: un 200 puede ser una página de bloqueo
  ("Access Denied", "Just a moment…"); cada petición valida que trae lo que
  necesita y si no, prueba la siguiente ruta.
- **Memoria por sitio**: si el Worker recibe 403 de un sitio, las siguientes
  peticiones a ese sitio empiezan por la ruta que funcionó (se recuerda 12 h).
- **Hedging**: si la primera ruta tarda, la siguiente arranca en paralelo y
  gana la primera respuesta válida.
- Caché en memoria, deduplicación de peticiones y precarga del resultado más
  probable.

| Fuente | Búsqueda | Canción |
|---|---|---|
| CifraClub | API SOLR (`solr.sscdn.co`) | `<pre>` con `<b>`; tono/cejilla en tarjetas `#key`, `#capo` |
| Ultimate Guitar | JSON `js-store` (o lista móvil) | `wiki_tab.content` con `[ch]` |
| LaCuerda | `m.lacuerda.net/iapp.php` | `#t_body pre` con `<A>` (o `res.body` móvil) |
| TusAcordes | `/buscar` | `.tablatura-content`, notación Do-Re-Mi |
| CIFRAS | *aparcada*: sus canciones están tras un desafío de Cloudflare | |

> ⚠️ El scraping depende de la estructura de sitios de terceros, que cambia
> sin aviso. Por eso hay pruebas con la estructura de cada sitio
> (`tests/fixtures/`) y una prueba en vivo (`npm run test:live`).

### Worker (backend)

Ver [`worker/README.md`](worker/README.md). La **versión 2** (octubre 2026)
usa User-Agent de escritorio, corrige el 302 de Ultimate Guitar, cachea en
el edge y permite la API de LaCuerda. La app funciona con la v1, pero conviene
actualizar: en **Ajustes → Backend → Probar** ves qué versión tienes.

## Desarrollo

```bash
npm install
npm run dev        # servidor local
npm test           # pruebas unitarias (vitest + jsdom)
npm run test:live  # pruebas contra los sitios reales (requiere red)
npm run build      # typecheck + build de producción
npm run preview    # previsualizar el build
```

Detrás de un proxy HTTPS, Node necesita `NODE_USE_ENV_PROXY=1` para
`npm run test:live`.

## Despliegue en GitHub Pages

1. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Haz push a `main`. El workflow `deploy.yml` corre las pruebas, construye y
   publica. En los Pull Requests, `ci.yml` corre pruebas + build.
3. La app queda publicada en:
   - https://fabianimv.github.io/guitar-chords/
   - (formato general) `https://<usuario>.github.io/guitar-chords/`

> Si cambias el nombre del repositorio, actualiza `base` en `vite.config.ts`.

## Estructura

```
src/
  lib/
    proxy.ts        # capa de red: rutas, validación, memoria por sitio, hedging
    chords.ts       # gramática de acordes, Do-Re-Mi, transposición, tono
    chordShapes.ts  # digitaciones, cejillas, posiciones alternativas, dificultad
    music.ts        # sugerencia de cejilla, tono escrito vs. sonando
    layout.ts       # bloques de la hoja y anclaje acorde→sílaba
    search.ts       # agrupar versiones y ordenar resultados
    storage.ts      # favoritos, recientes, caché, ajustes por canción, copia
    router.ts       # rutas por hash (#/cancion?u=…)
    settings.ts     # backend y preferencias
  sources/          # adaptadores: cifraclub, ultimateGuitar, lacuerda, tusacordes, cifras
  components/       # SearchPage, SongView, ChordSheet, ChordDiagram, LibraryPage, SettingsPage…
  hooks/            # useSearch, useAutoScroll, useWakeLock…
tests/              # unitarias + fixtures con la estructura real de cada sitio
tests/live/         # pruebas en vivo
worker/             # Cloudflare Worker
```

Añadir una fuente = implementar `ChordSource` (`src/sources/types.ts`),
registrarla en `src/sources/index.ts` y agregar fixtures + pruebas.

# 🎸 Acordes

Buscador rápido de **acordes y letras** de canciones, **sin publicidad**.
Busca cualquier canción y la app trae automáticamente la versión mejor
calificada desde **Ultimate Guitar**, **CifraClub** y **TusAcordes**, mostrando
la letra con los acordes alineados encima y diagramas de digitación.

Es una **PWA** (aplicación web instalable) pensada para el iPhone: ábrela en
Safari y añádela a la pantalla de inicio para usarla a pantalla completa, como
una app nativa.

## Funciones

- 🔎 **Búsqueda unificada** en varios sitios a la vez; resultados ordenados por
  calificación (la mejor versión aparece marcada como **Mejor**).
- 📜 **Letra + acordes alineados** en monoespaciado (ves *cuándo* tocar cada
  acorde sobre cada palabra).
- 🎸 **Diagramas de acordes** (digitación en el mástil) de cada acorde de la
  canción — ves *cómo* tocarlos.
- 🎚️ **Transposición** de tono (± semitonos) en tiempo real.
- 🔤 **Tamaño de letra** ajustable.
- ▶️ **Auto-scroll** manos libres con velocidad regulable.
- ♥ **Favoritos** guardados en el dispositivo y disponibles **sin conexión**.
- 🕑 **Recientes** para volver rápido a lo último que viste.
- 🔗 Pega la **URL** de una canción de CifraClub / Ultimate Guitar para abrirla
  directo.

## Cómo funciona (y la nota importante sobre el scraping)

GitHub Pages sirve solo archivos estáticos, así que el navegador no puede pedir
las páginas de esos sitios directamente (no envían cabeceras CORS). La app las
obtiene a través de **proxies CORS públicos** con reintento automático
(`src/lib/proxy.ts`). Cada sitio tiene un *adaptador* (`src/sources/`) que
parsea su HTML/JSON a un formato común.

> ⚠️ El scraping depende de la estructura de sitios de terceros y de proxies
> públicos gratuitos. Pueden cambiar o caerse. Si una búsqueda falla, prueba
> otra versión o pega la URL. Para máxima fiabilidad, despliega tu propio proxy
> (p. ej. un Cloudflare Worker) y ponlo primero en la lista `PROXIES` de
> `src/lib/proxy.ts`. TusAcordes es el adaptador más frágil (su HTML es menos
> estructurado) y es de **mejor esfuerzo**.

## Desarrollo

```bash
npm install
npm run dev        # servidor local
npm run build      # build de producción (typecheck + vite)
npm run preview    # previsualizar el build
```

## Despliegue en GitHub Pages

1. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Haz push a `main`. El workflow `.github/workflows/deploy.yml` construye y
   publica automáticamente.
3. La app queda en `https://<usuario>.github.io/guitar-chords/`.

> Si cambias el nombre del repositorio, actualiza `base` en `vite.config.ts`
> (debe coincidir con `/<nombre-repo>/`).

## Estructura

```
src/
  lib/
    proxy.ts        # fetch vía proxies CORS con fallback
    chords.ts       # tokenizador + transposición
    chordShapes.ts  # formas de acordes para los diagramas
    storage.ts      # favoritos y recientes (localStorage)
    html.ts         # utilidades de parseo HTML
  sources/          # adaptadores: ultimateGuitar, cifraclub, tusacordes
  components/       # UI (SearchBar, ResultsList, SongView, ChordSheet, ChordDiagram)
  hooks/useAutoScroll.ts
```

Añadir una fuente nueva = implementar la interfaz `ChordSource`
(`src/sources/types.ts`) y registrarla en `src/sources/index.ts`.

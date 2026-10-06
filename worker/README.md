# Backend proxy (Cloudflare Worker)

Este Worker es un **proxy con los headers correctos** (User-Agent de
navegador, Referer, X-Requested-With) que hace que los sitios de acordes
respondan. Sin él, la app depende de Jina y proxies CORS públicos, que son
más lentos y tienen límites.

Es **gratis** (plan free de Cloudflare Workers: 100.000 peticiones/día) y se
instala en ~2 minutos. No necesitas tarjeta.

## Versión 2 (octubre 2026) — conviene actualizar

Si ya tenías el Worker desplegado, vuelve a pegar `worker.js` (pasos 3 de la
Opción A). La app sigue funcionando con la versión 1, pero la 2:

- usa User-Agent de escritorio (Ultimate Guitar entrega sus datos completos),
- devuelve 200 cuando el sitio responde la página con un 3xx (UG lo hace),
- guarda en caché del edge: búsquedas 15 min, canciones 6 h,
- permite `m.lacuerda.net` (la API de búsqueda de LaCuerda),
- responde `?ping` con su versión (Ajustes → Backend → Probar).

En **Ajustes → Backend → Probar** la app te dice qué versión tienes.

## Opción A — Dashboard (sin instalar nada)

1. Crea una cuenta gratis en https://dash.cloudflare.com → **Workers & Pages**.
2. **Create application → Create Worker** → ponle un nombre (ej. `acordes`) →
   **Deploy**.
3. Pulsa **Edit code**, borra todo y pega el contenido de
   [`worker.js`](./worker.js). Pulsa **Deploy**.
4. Copia la URL del Worker (algo como
   `https://acordes.tu-usuario.workers.dev`).
5. En la app: **Ajustes → Backend propio**, pega esa URL y pulsa **Probar**.

## Opción B — Wrangler (CLI)

```bash
cd worker
npx wrangler login
npx wrangler deploy worker.js --name acordes --compatibility-date 2024-11-01
```

Copia la URL que imprime y pégala en la app igual que en la Opción A.

## Cómo funciona

La app llama `GET https://<worker>/?url=<URL destino codificada>`. El Worker:

- Solo permite hosts de los sitios de acordes y YouTube (no es un proxy
  abierto).
- Añade `User-Agent`, `Referer` y `X-Requested-With` de navegador.
- Devuelve el cuerpo tal cual con `Access-Control-Allow-Origin: *` y la
  cabecera `X-Proxy-Status` con el código original.

CifraClub protege sus páginas de canciones con Akamai, que suele bloquear
las IPs de Cloudflare. Cuando eso pasa, la app usa automáticamente
[Jina Reader](https://jina.ai/reader) para esa página (y lo recuerda para las
siguientes), pidiéndole solo el bloque de acordes para que sea liviano.

## Comprobar que funciona

```
https://<tu-worker>.workers.dev/?ping
https://<tu-worker>.workers.dev/?url=https%3A%2F%2Fsolr.sscdn.co%2Fcc%2Fh2%2F%3Fq%3Dhotel%2520california
```

El primero debe responder `{"ok":true,"version":2}`; el segundo, JSON de
CifraClub (no un 403).

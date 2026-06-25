# Backend proxy (Cloudflare Worker)

Este Worker es un **proxy con los headers correctos** (Referer + User-Agent) que
hace que CifraClub y Ultimate Guitar respondan. Sin él, la app depende de
proxies CORS públicos que esos sitios bloquean (verás errores 403 / "0
resultados" en el panel de Diagnóstico 🐞).

Es **gratis** (plan free de Cloudflare Workers: 100.000 peticiones/día) y se
instala en ~2 minutos. No necesitas tarjeta.

## Opción A — Dashboard (sin instalar nada)

1. Crea una cuenta gratis en https://dash.cloudflare.com → **Workers & Pages**.
2. **Create application → Create Worker** → ponle un nombre (ej. `acordes`) →
   **Deploy**.
3. Pulsa **Edit code**, borra todo y pega el contenido de
   [`worker.js`](./worker.js). Pulsa **Deploy**.
4. Copia la URL del Worker (algo como
   `https://acordes.tu-usuario.workers.dev`).
5. En la app: abre **🐞 Diagnóstico** (arriba a la derecha) y pega esa URL en
   **"Backend propio"**. Listo: vuelve a buscar.

## Opción B — Wrangler (CLI)

```bash
cd worker
npm install -g wrangler          # o: npx wrangler ...
wrangler login
wrangler deploy worker.js --name acordes --compatibility-date 2024-11-01
```

Copia la URL que imprime y pégala en la app igual que en la Opción A.

## Cómo funciona

La app llama `GET https://<worker>/?url=<URL destino codificada>`. El Worker:

- Solo permite hosts de CifraClub / Ultimate Guitar / TusAcordes (no es un
  proxy abierto).
- Añade `Referer` y `User-Agent` de navegador para evitar los bloqueos.
- Devuelve el cuerpo tal cual con `Access-Control-Allow-Origin: *`.

## Comprobar que funciona

Abre en el navegador (debería devolver JSON de CifraClub, no un 403):

```
https://<tu-worker>.workers.dev/?url=https%3A%2F%2Fsolr.sscdn.co%2Fcc%2Fh2%2F%3Fq%3Dhotel%2520california%26type%3D%26hl%3Dtrue
```

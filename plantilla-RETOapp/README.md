# RETOapp

**R.E.T.O.** (Refuerzo, Estudio, Test, Organización): plataforma web de aprendizaje con lectura veloz, tests, aventura gráfica, juegos de atención y memoria, ejercicios de visión y duelos entre dispositivos.

Es un **sitio estático** (HTML, CSS y JavaScript): no necesita servidor. Las reglas viven en `scripts/logica/` y las responde `scripts/reto-api.js` dentro del navegador. Funciona sin internet después de la primera visita.

## Ver el sitio en tu computadora

Necesitas [Node.js](https://nodejs.org) 18 o más.

```bash
node tools/servir.js     # abre http://localhost:8000
```

## Publicar

Cada vez que subas cambios a `main`, GitHub revisa el sitio y lo publica (pestaña **Actions**). La primera vez, en **Settings → Pages**, elige **Source: GitHub Actions**.

- Sitio: `https://USUARIO.github.io/RETOapp/`
- Qué versión está publicada: `https://USUARIO.github.io/RETOapp/version.txt`

Si agregas ejemplos, fondos o sprites, los índices se vuelven a escribir solos al publicar (en tu computadora: `node tools/generar-indices.js`).

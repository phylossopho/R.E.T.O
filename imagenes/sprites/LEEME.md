# Sprites de la batalla

```
imagenes/sprites/<personaje>/<vista>/<estado>.webp
  personaje  mago, maga, caballero, caballera, arquero, arquera, guerrero, guerrera,
             asesino, asesina, clerigo, sacerdotiza
  vista      frente   el ADVERSARIO. Ya vienen REFLEJADOS: miran a la izquierda, hacia el jugador.
             espalda  el JUGADOR en tercera persona. Miran a la derecha, hacia el adversario.
  estado     espera · ataque · herido
```

- **Para agregar un sprite basta con dejar la imagen en su carpeta.** El servidor lista las carpetas
  (`GET /api/rpg/sprites`) y el juego las detecta solo.
- **Animación con varios cuadros:** `espera_1.webp`, `espera_2.webp`, … se recorren en orden a 4 cuadros por
  segundo (con las animaciones apagadas se queda en el primero).
- **Lo que falte no rompe nada:** si falta un estado se usa `espera`; si falta la vista, o el personaje, se usa
  la imagen de siempre (`imagenes/<personaje>.webp`, reflejada si es del adversario).
- Las carpetas que empiezan con `_` (`_extras`) no se listan: ahí quedan las piezas sueltas y las poses que no se usan.

## Estado actual
| personaje | frente (adversario) | espalda (jugador) |
| --- | --- | --- |
| mago, maga, arquero, arquera, asesino, asesina, caballera, clerigo, guerrero, guerrera | espera, ataque, herido | falta |
| sacerdotiza | falta | espera, ataque |
| caballero | falta | falta |

## Convertir hojas nuevas
Las hojas (fondo verde, una por personaje, con las poses sueltas) se convierten con:

    python _procesar_sprites.py <carpeta con las hojas>

Quita el verde, corta cada pose, las pone en un lienzo del mismo tamaño alineadas por abajo (para que el
personaje no cambie de tamaño al cambiar de pose), refleja las de frente y guarda todo aquí. El nombre de la hoja es
el id del personaje (`mago.jpg`, `sacerdotiza.jpg`; también acepta `sacerdotisa`). Reconoce las poses por su lugar:
en una hoja cuadrada, arriba a la izquierda = ataque, arriba a la derecha = herido, abajo = espera; en una hoja
alargada, de izquierda a derecha = ataque, herido, espera. La hoja de espalda de la sacerdotiza (5 poses) tiene su
propia regla. `--personaje mago` procesa uno solo.

## Cuándo sale cada pose
- Llega una pregunta: el adversario **ataca** unos 0,8 s.
- Fallas o se acaba el tiempo: el adversario **ataca** y el jugador queda **herido**.
- Aciertas: el jugador **ataca** (contraataque) y el adversario queda **herido**.
- El resto del tiempo, **espera** (respira suave). Con el interruptor de animaciones apagado o con
  `prefers-reduced-motion` solo cambia la pose, sin movimiento.

## Prompt sugerido para las vistas de espalda que faltan
Usa la hoja de frente del personaje como referencia para que conserve el diseño:

> Pixel art, misma paleta de grises y mismo estilo que la imagen de referencia. El MISMO personaje visto de
> ESPALDA en tercera persona (como el entrenador de espaldas de los juegos de Game Boy), mirando hacia la derecha
> y arriba. Hoja con 3 poses sobre fondo verde liso (#00FF00), sin sombras ni degradados en el fondo: (1) espera, de pie y
> relajado con su arma o bastón; (2) ataque, brazos extendidos al frente lanzando el golpe o el hechizo; (3) herido, encogido
> y echado hacia atrás por un golpe. Sin texto. El personaje, el sombrero y la capa se ven de espaldas: sin cara.

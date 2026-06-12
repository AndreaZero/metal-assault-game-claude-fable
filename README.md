# METAL ASSAULT — run & gun per browser

Clone in stile *Metal Slug* realizzato interamente in **HTML5 Canvas + JavaScript vanilla**.
Nessuna dipendenza, nessun build step, nessun asset esterno: sprite pixel-art, livello,
effetti sonori e musica sono generati proceduralmente dal codice.

## Come si avvia

Apri `index.html` con un qualsiasi browser moderno (doppio click sul file è sufficiente).
Funziona anche da `file://`, non serve un server.

## Comandi

| Tasto | Azione |
|---|---|
| Frecce / WASD | Muoviti |
| Giù / S | Abbassati (Giù + Salto sulle piattaforme: scendi) |
| Su / W | Mira verso l'alto |
| Spazio / K | Salta |
| J / Z | Spara (coltello automatico a distanza ravvicinata) |
| L / X | Lancia granata |
| Invio | Start / conferma |
| P | Pausa |
| M | Audio on/off |

## Gameplay

- **Due modalità**: *Arcade Mission* (missione ~7600px con boss finale) e *Survival*
  (ondate infinite in arena, hi-score separato). Selezione dal menu con Su/Giù.
- **Nemici**: soldati con fucile, granatieri, assaltatori col coltello, truppe d'élite
  con bazooka, torrette dietro sacchi di sabbia, elicotteri e carri armati.
- **Miniboss**: la Gunship, elicottero pesante con barra HP, ventagli di proiettili
  e passaggi di bombardamento.
- **Boss finale**: la fortezza corazzata del Generale Morden, con cannone ad arco,
  mitragliatrice e rinforzi di fanteria. Si infuria sotto il 35% di vita.
- **Chain combo**: uccisioni ravvicinate aumentano il moltiplicatore di punteggio
  (fino a x3). La catena si spezza se vieni colpito.
- **POW**: libera i prigionieri legati per ottenere punti e casse con armi speciali.
- **Armi**: Pistola (infinita), Heavy Machine Gun (H), Spread (S), Rocket (R),
  Flame Shot (F), più scorte di granate (G).
- **Vite**: 3, con respawn e invincibilità temporanea. Bonus punti per le vite rimaste
  a fine missione. Hi-score salvati in `localStorage`.
- **Game feel**: hit-stop sui colpi, rinculo, bossoli, scintille d'impatto, polvere,
  screenshake e musica adattiva che cresce d'intensità con boss e ondate avanzate.

## Struttura del codice

```
index.html      — pagina, canvas, caricamento script
js/audio.js     — sintesi WebAudio: effetti sonori + loop musicale
js/input.js     — gestione tastiera (down / just-pressed)
js/sprites.js   — pixel art da mappe di caratteri + veicoli disegnati a rettangoli
js/level.js     — terreno, piattaforme, scenografia a parallasse, tabella spawn
js/entities.js  — giocatore, AI nemici, boss, proiettili, esplosioni, POW, pickup
js/game.js      — loop a passo fisso (60 Hz), stati, camera, HUD, menu
```

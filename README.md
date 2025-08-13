# Space Mini — Wave System Edition

Space Mini is a lightweight browser-based top‑down shooter written in vanilla JavaScript and HTML5 Canvas. Survive escalating waves of asteroids and enemy ships, earn credits, and unlock faster, tougher spacecraft.

## Run the Game
1. Clone or download this repository.
2. Open `index.html` in any modern web browser. No build or server setup is required.

### Mobile / PWA

The project includes a basic Progressive Web App setup. When visiting `index.html` on a mobile device, use the "Install App" button or your browser's prompt to add Space Mini to your home screen.

To distribute a native Android build, create an APK using a packaging tool and place it at `mobile/space_mini.apk`. The page will expose a download link automatically when the file is present.

To provide a custom app icon, update `manifest.json` with your own base64-encoded image and adjust the service worker's cache list if needed. No binary icon files are tracked in this repository.

## Controls
| Action                     | Key(s)        |
|----------------------------|---------------|
| Move                       | Arrow keys    |
| Shoot                      | Spacebar      |
| Pause / Back               | Esc           |
| Start / Confirm            | Enter         |
| Hangar: buy focused ship   | **B**         |
| Hangar: select focused ship| **S**         |

## Gameplay
- Each level contains three waves: asteroids, enemy fighters, and a miniboss.
- Defeating enemies yields credits and score; credits persist via browser storage.
- Spend credits in the hangar to unlock new ships with distinct stats and visual themes.
- Difficulty settings (Easy/Medium/Hard) adjust enemy speed, spawn rate, and health.

## Project Structure
- **index.html** – Bootstrap page and canvas element.
- **style.css** – Minimal styling for the game canvas.
- **constants.js** – Core constants, enemy/ship stats, and wave configuration.
- **audio.js** – Sound effects and music playback.
- **storage.js** – Persistence of high scores, credits, and settings.
- **game.js** – Main game loop, rendering, input handling, and state management.

## Credits
Created by the Space Mini team. Enjoy the waves and good luck pilot!

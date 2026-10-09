# Piggus Adventure

just a bit of fun as a side project!! A crossy-road style game for kids starring Piggus, a greedy, lovable pig squishmallow who just needs to get to the toilet. 15 levels across eight worlds, ending in a boss fight with Dino-Capy. Pick **Hard mode** on the start screen for longer, faster levels and a tougher boss.

## How to play

**Play in your browser:** https://purviewpower-lab.github.io/Piggus-Adventure/ (on a PC or laptop with a keyboard, or on a phone or tablet with on-screen buttons; the page is big, so give it a moment to load).

Or play it offline:

1. Click the green **Code** button on this page, then **Download ZIP**, and unzip it.
2. Open the `game` folder and double-click **Piggus-Adventure.html**. It opens in your web browser (Chrome or Edge work best). No installs needed.
3. Play on a PC or laptop with a keyboard.

| Key | What it does |
|---|---|
| Arrow keys | Move Piggus (← → speed up or slow down in the side-scrolling runs) |
| Space bar or ↑ | Jump in the runs (hold for a bigger jump) |
| ↓ | Duck in the runs |
| Space bar (on the toilet) | Fill the poop meter |
| ◀ ▶ (start screen) | Pick Normal or Hard mode |
| Esc | Menu: restart, pick a level, Normal / Hard mode, volume, music |
| N | Next song |

On a phone or tablet, an arrow pad (bottom left) and a pink **GO** button (bottom right) appear. The arrows work like the arrow keys and GO works like the space bar. Turning the phone sideways gives the biggest picture.

## Levels

| Levels | World |
|---|---|
| 1-2 | Sunny Meadow |
| 3-4 | Desert Dunes |
| 5-6 | Super Snoutmarket (side-scrolling run) |
| 7-8 | Wrongfoot Prison |
| 9-10 | Under the Sea |
| 11-12 | Dino Jungle |
| 13-14 | Lady Squishshot's Forest |
| 15 | Dino-Capy boss |

## Your own pictures and sounds (optional)

Most artwork and all the music are built into the HTML file. Piggus, Winston, the toilet, the lorries, the captured friends and the start screen are loaded from `game/Resources/`, so keep that folder next to the HTML file. You can also add your own voice lines and sounds there. See [game/Resources/README.md](game/Resources/README.md) for the file names the game looks for. Any file that's missing just uses the built-in sound or drawing instead.

## What's in this repository

- `game/Piggus-Adventure.html`: the whole game in one file.
- `game/Piggus-Project-Notes.md`: design notes, what's in the game and what was decided against.
- `game/Resources/`: where your own sounds and pictures go.
- `game/pictures/`: original pictures used for the sea and supermarket levels.
- `art/`: original Lady Squishshot artwork.
- `game/testing/`: an automatic checker that plays every level in a hidden browser (needs Node and Playwright), with its latest report. Run `node game/testing/check-game.mjs game/Piggus-Adventure.html --no-compare`.

# Piggus Adventure checker

`check-game.mjs` plays the whole game in a hidden browser so a new build doesn't need a full manual replay.

Run it (needs Node and Playwright; both are installed in Claude's workspace):

    node game/testing/check-game.mjs                    # latest game vs newest backup in game/older/
    node game/testing/check-game.mjs NEW.html OLD.html  # any two files
    node game/testing/check-game.mjs NEW.html --no-compare

It checks:
- no script errors while loading or playing
- SHARPNESS is 1.2 and there are 15 levels
- a robot (Piggus can't get hurt) plays Level 1 through the boss using the real level-complete, Buffet and boss screens, so every level can still be finished (if it gets stuck on a level it says so and carries on from the next one)
- a minute of no-cheat robot play on every level, so Piggus gets caught and restarts (flags a level where nothing ever catches him)
- the Buffet round reaches its end screen
- with the random numbers fixed, pictures of each level at the start and 4 seconds in, compared with the older file, to list which levels look different. Levels are matched by world and place in that world, so adding a new world lists its levels as NEW instead of every later level as changed (a renumbered level may still show as changed because its level number is drawn on screen). The older file is checked from a temporary copy next to the game, so it uses the same Resources pictures

Results: `report/report.html` (table with pictures) and `report/summary.txt`. Exit code 1 means a problem was found.

What it can't judge: whether something is fun, too hard, or looks right. A change that only shows up deep into a level (later than 4 seconds in) may not appear in the "looks different" list, so the thread making a change should also say which levels it touched.

# World Cup Watchalong Kit

This kit is designed for a legal YouTube watchalong: your camera, your live commentary, live chat, scoreboard, timer, and graphics. Do not show match footage or play broadcast audio.

## Files

- `overlay.html`: Main OBS browser overlay for the stream.
- `control.html`: Producer panel for changing score, clock, hype, storylines, and stats live.
- `dashboard.html`: Command center for titles, descriptions, pinned chat, links, checklist, and Shorts ideas.
- `match-presets.js`: One-click match presets for all matches in the daily marathon.
- `config.js`: Edit match names, colors, host name, ticker, poll, and topic.
- `thumbnail.html`: 1280x720 thumbnail layout you can screenshot/export.
- `stream-script.md`: Stream flow, title ideas, and opening lines.

## OBS Setup

1. Create a new OBS scene named `World Cup Watchalong`.
2. Add your camera as a Video Capture Device.
3. Add `overlay.html` as a Browser Source.
4. Browser Source size: `1920 x 1080`.
5. Put the overlay above your camera source.
6. Crop or position your camera inside the large left frame.
7. Enable browser source audio if you want the small goal sound effect.
8. Add your mic with filters: Noise Suppression, Compressor, Limiter.
9. Open `control.html` in a normal browser window to run the stream like a producer.
10. Use Match Switcher in `control.html` to move from one fixture to the next.
11. Use `dashboard.html` before every match to copy title, description, pinned chat, and Shorts ideas.

## Keyboard Controls

- `Space`: start timer
- `P`: pause timer
- `H`: home goal
- `A`: away goal
- `R`: reset score
- `U`: hype meter up
- `J`: hype meter down
- `S`: speak next English auto-voice prompt
- `T`: toggle English auto-voice
- `+` and `-` buttons on screen: adjust timer by one minute

## Retention Features

- Chat Mission: gives viewers a reason to type immediately.
- Stream Hype: use it after goals, VAR, big chances, or chat spikes.
- Momentum: update values in `config.js` before the stream or at half-time.
- Key Battle: keeps casual viewers focused on one storyline.
- Game Pulse: your one-sentence live narrative for late joiners.

## Producer Panel

Open `control.html` in the same browser profile as the OBS browser source if possible. It live-updates:

- Score
- Clock minute
- Hype meter
- Talking point
- Game pulse
- Chat mission
- Momentum
- Shots and possession

## English Auto Voice

The overlay uses the browser's built-in speech synthesis for faceless English commentary prompts.

- Auto prompts speak roughly every 55 seconds.
- Goal and hype buttons trigger special voice lines.
- Press `S` to speak the next safe prompt.
- Press `T` to turn auto voice on/off.
- Do not use broadcast audio or copyrighted music under the voice.

Keep the voice useful and match-specific. Avoid running the same generic line repeatedly for hours.

## Today Marathon

- France vs Senegal - 12:30 AM IST, Wednesday June 17
- Iraq vs Norway - 3:30 AM IST, Wednesday June 17
- Argentina vs Algeria - 6:30 AM IST, Wednesday June 17
- Austria vs Jordan - 9:30 AM IST, Wednesday June 17

Go live 20-30 minutes before each match. Between matches, switch the preset, update the thumbnail/title, and keep a short waiting-room stream only if you still have energy and chat is active.

## Audio Settings

For a clean live sound:

- Mic gain: peaks around `-10 dB` to `-6 dB`
- Noise suppression: RNNoise if available
- Compressor ratio: `3:1`
- Limiter: `-1.0 dB`
- Music: avoid copyrighted music

## Legal Safety

Say this during the stream:

> This is a live watchalong with no match footage and no broadcast audio. Open the official broadcast and sync with our timer.

Keep this as a pinned chat message too.

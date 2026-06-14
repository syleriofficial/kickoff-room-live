# Local Tools Server

Run the stream tools on localhost for OBS Browser Sources.

## Start

```bash
npm run start:tools
```

Default URL:

`http://127.0.0.1:5173`

## Routes

- `/dashboard`: command center
- `/readiness`: live readiness checklist
- `/control`: producer panel
- `/overlay`: OBS overlay
- `/obs`: redirects to overlay
- `/thumbnail`: live thumbnail page
- `/trailer`: channel trailer page
- `/shorts/ger-cur/preview`
- `/shorts/ger-cur/key-battle`
- `/shorts/ger-cur/explainer`

## OBS

Add Browser Source:

`http://127.0.0.1:5173/overlay`

Size:

`1920 x 1080`

For Shorts recording, use:

`http://127.0.0.1:5173/shorts/ger-cur/preview`

Canvas:

`1080 x 1920`

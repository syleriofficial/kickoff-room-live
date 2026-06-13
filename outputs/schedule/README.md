# Live Schedule

Generate calendar and schedule files:

```bash
npm run schedule
```

Outputs:

- `live-calendar.ics`: import into Google Calendar, Apple Calendar, or Outlook
- `live-schedule.md`: human-readable schedule
- `live-schedule.json`: machine-readable schedule

The calendar uses go-live times, not just kickoff times, so you are reminded before the stream starts.

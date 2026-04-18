
User reports auto-sync is set to every 5 min but isn't running. Manual sync works. Need to investigate.

Hypothesis: cron jobs were either never scheduled, or `update-sync-schedule` failed silently, or the cron jobs exist but `net.http_post` fails (e.g., wrong anon key after key rotation, function unauthorized, or pg_net not enabled).

Let me check.

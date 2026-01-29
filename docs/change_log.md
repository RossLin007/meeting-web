Change Log

2026-01-16
- Meeting state source of truth: Socket room state only; IM limited to chat; meeting end cleanup logs out IM and clears cache, leaving meeting only ends session.
- Remote video stability: ref-based subscription, TRTC video-availability tracking, retry on failed subscription, and explicit screen-share sub stream handling.
- Recording stability: fixed nine-grid mix layout, status pending UI for start/stop, and subscriber list updates on member changes.
- Lightweight commercial sync: server broadcasts room snapshots every 30s; client periodically requests room state and reports member state (audio/video/screen/hand) for correction.
- Identity and metadata: member name sync/rename events, VideoGrid name updates, and meeting title propagation via invite link or API fallback.
- Global mute enforcement: member state heartbeat respects mute-all rules and rejects mismatched meeting IDs.

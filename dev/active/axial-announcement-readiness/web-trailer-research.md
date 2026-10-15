# Axial web trailer: research and proposed direction

Status: planning only. Researched September 21–22, 2026. No capture, installation, voice generation, purchase or publishing performed.

Follow-up: Caden subsequently authorized setup and script development. See [the current script](web-trailer-script.md) for the 44-second direction and [the video workspace](../../../axial-video/README.md) for installation details. The research below records the earlier proposal; its 38-second script is superseded. No footage or narration has been produced yet.

## Brief and recommendation

Caden wants a roughly 30–60 second, nontechnical trailer introducing the playable web version. He confirmed customizability and rule settings are part of the story, and prefers music with a short AI voiceover. The separate Unity gameplay video remains a different deliverable.

Start with a 35–40 second edit. Use actual gameplay, short animated titles, the existing Axial visual identity, restrained electronic music, game sounds and about 55–65 words of narration. The hook is the 3D board and the satisfying moment a line becomes visible. Show rule changes through their effects on play instead of lingering on a settings menu.

Recommended production chain: **OBS capture → Remotion edit and graphics → FFmpeg mix/export/verification**, with **ElevenLabs voice auditions** and OpenAI TTS as an alternative. This is a recommendation based on documented capabilities and the installed environment, not a completed production test.

## Tool choices

| Tool | Proposed role | Why it fits / limitation |
| --- | --- | --- |
| OBS | Record the browser and its game audio | Already installed (32.2.2). Test the Wayland capture source, audio routing and frame stability before recording all shots. Its recording guide supports hardware encoders, separate audio tracks, and MKV with MP4 remuxing. [Official guide](https://obsproject.com/kb/standard-recording-output-guide). |
| Remotion | Assemble clips; animate titles, framing and transitions; render multiple compositions | React/TypeScript makes frame timing and revisions explicit. Official documentation supports Codex and provides agent skills. This would be a separate video project, with no change to Axial's Svelte architecture. Its preview is useful for review; do not assume it is a conventional draggable editing timeline. [Agent workflow](https://www.remotion.dev/docs/ai/coding-agents), [skills](https://www.remotion.dev/docs/ai/skills). |
| FFmpeg / ffprobe | Mix speech, music and effects; encode and inspect deliverables | Installed FFmpeg n9.0.1 exposes `amix`, `loudnorm`, `sidechaincompress` and `xfade`. Use Remotion for visible composition and FFmpeg for final media processing where appropriate. [FFmpeg documentation](https://ffmpeg.org/documentation.html). |
| ElevenLabs | First voice audition candidate | Offers premade voices and voice design. Audition a small set with our actual script; documentation cannot establish which sounds best for Axial. Paid plans include commercial usage rights; the free plan has different use/attribution conditions. The retrieved pricing page lists Starter at $6/month before tax; verify at purchase time. [TTS capabilities](https://elevenlabs.io/docs/overview/capabilities/text-to-speech), [pricing](https://elevenlabs.io/pricing), [publication terms](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform). |
| OpenAI TTS | Alternative voice audition candidate | `gpt-4o-mini-tts` supports delivery instructions and WAV output. Useful for iterating tone and pacing through a script. Requires API access, not merely assuming this Codex session provides speech generation. Its documentation requires clear disclosure of AI-generated narration. [Official guide](https://developers.openai.com/api/docs/guides/text-to-speech). |
| Kdenlive | Alternative if a traditional timeline becomes preferable | A native editor with documented MP4 rendering. Not installed. Appropriate if Caden wants direct manual timeline editing; no need to maintain two editing projects initially. [Manual](https://docs.kdenlive.org/en/exporting.html). |

Remotion's current repository license permits individual video creation, including commercial work, for free; review the chosen version's terms when setting up. [License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

Other tools considered:

- **Blender:** installed and available for a bespoke 3D title shot if the concept calls for one. Rebuilding Axial's board there would add work before demonstrating any benefit.
- **Motion Canvas:** designed around TypeScript-driven explanatory vector animation. A better potential fit for the later hand-tracking diagram than this footage-led trailer. [Introduction](https://motioncanvas.io/docs/).
- **Remotion Canvas Capture:** promising high-resolution webpage recording, but its current installation guide requires an Apple Silicon Mac and a specific Chrome build. Excluded from this Linux workflow. This restriction is on Canvas Capture, not Remotion's editing/rendering package. [Installation](https://www.remotion.dev/docs/canvas-capture/installation).
- **Playwright video:** useful for repeatable test recordings, but the default recording fits within 800×800. Existing browser automation may help stage actions later; test-video defaults are not our delivery settings. [Video documentation](https://playwright.dev/docs/videos).
- **DaVinci Resolve:** an alternative to evaluate if we decide to do substantial manual finishing. It is not installed and was not tested; no claim of a verified Linux codec workflow is made here.

## What Astra contributes

Astra can help storyboard, write the edit code, coordinate available tools, inspect frames and revise timing. The actual video is produced by capture and rendering tools. OpenAI's model page lists text/image input and text output, so this is a tool-driven editing workflow, not a native MP4 output mode. No quality claim about Astra versus professional human editors or other models has been established. [Official model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra).

## Proposed 38-second structure

| Time | Picture and pacing | Message |
| --- | --- | --- |
| 0–3 s | Open on a piece landing, with a short orbit revealing the board's depth. Bring in the Axial name over action. | A familiar idea gains another dimension. |
| 3–11 s | Two or three readable moves. Show the developing threat from an angle that makes the connection understandable. | Drop pieces. Read the board. |
| 11–17 s | Complete a diagonal, hold long enough for the highlighted line to register, then cut on the music. | Connections exist through depth too. |
| 17–29 s | Brief setting changes followed by contrasting gameplay: larger board, connect five, two/three-line goals. Use distinct shots so these do not look like mid-match rule changes. | Change the board. Change the rules. |
| 29–34 s | A satisfying final sequence, with a short pause for game sound and music. | The payoff. |
| 34–38 s | Clean Axial end card and readable `playaxial.dev` invitation. | Play in your browser. |

This is a starting rhythm, not a locked script. We should choose legal move sequences and framing that make each feature evident. For multiple-line rules, show the progress counter and separate completed lines clearly; do not imply an impossible one-move triple win.

Possible narration, approximately 61 words:

> This is Axial. A familiar idea, with another dimension. Drop a piece. Look a little closer. The winning line might be hiding in plain sight. Connect four, or make it five. Change the size of the board. Make one line enough to win, or go for two. Or three. Your next move is waiting. Play Axial, right in your browser.

Delivery: conversational, lightly playful, with pauses around the piece impacts. Avoid a booming movie-trailer performance. Test pronunciation of “Axial.” Record or synthesize the chosen narration before final timing, while allowing silent gaps between phrases. The wording and voice are provisional.

Music should support the pace without competing with speech. Obtain a track whose terms cover the planned cross-platform use; do not assume an in-app music selection can be exported to other services. Keep music, narration and game sound separate so the mix can be revised. Use readable captions and short feature titles so the trailer remains understandable muted.

## Formats and platform findings

Create **two deliberately composed edits** rather than cropping one finished video:

| Destination | Proposed delivery | Evidence / distinction |
| --- | --- | --- |
| LinkedIn article cover and X | 1920×1080, 16:9, 30 fps | LinkedIn explicitly supports native article-cover video uploads with captions and a thumbnail. X's ordinary web-upload documentation lists a 40 fps maximum and 1920×1200 or 1200×1900 resolution ceilings. 1080p landscape at 30 fps fits these published bounds. |
| Instagram Reel | 1080×1920, 9:16, 30 fps | An editorial recommendation. Current consumer Reel-size Help was blocked by 429/login, so exact current upload limits were not independently verified. Check the upload preview when publishing is authorized. |
| Optional LinkedIn feed version | 1080×1350, 4:5, 30 fps | Fits LinkedIn's documented aspect range; useful if a separate feed post warrants another composition. Not required for the first cut. |

Sources: [LinkedIn article media](https://www.linkedin.com/help/linkedin/answer/a521719), [LinkedIn ordinary video uploads](https://www.linkedin.com/help/linkedin/answer/a548372/video-sharing-troubleshooting), [X video Help](https://help.x.com/en/using-x/x-videos), [Instagram Help, inaccessible during research](https://help.instagram.com/1038071743007909).

An initial export preset is MP4, H.264 video, AAC audio, `yuv420p`, fast-start metadata, 30 fps, and roughly 10–15 Mbps video bitrate. This is our starting preset, not a claim that every platform mandates these codecs. Inspect the rendered quality before locking it. Keep a high-quality master and avoid repeated intermediate lossy re-encoding.

For source capture, try a stable 60 fps at a resolution that leaves room for modest close-ups. If it drops frames, prioritize clean capture at a sustainable resolution. A 60 fps source allows 50% slow motion in a 30 fps edit; it does not justify slowing all gameplay. Higher-resolution capture must be tested on this machine.

A 16:9-to-9:16 center crop keeps only about 32% of the original width. Capture portrait-friendly views or compose the whole board within the vertical canvas, then reposition titles and close-ups. Do not let a vertical crop remove relevant columns or winning lines. Produce a separate static thumbnail from a strong gameplay frame.

## Local details and first production checkpoint

Verified installed tools: OBS, FFmpeg/ffprobe, Blender, Chromium/Chrome, Node and pnpm. Kdenlive and Resolve were not found on PATH. No dedicated Remotion editing project has been created, and no speech-service account or API access was verified.

Axial already supplies an Inter font and logo assets under `axial-web/apps/web/static/`. Its audio module uses synthesized browser audio. Sound is opt-in and needs a user gesture to unlock; impacts are emitted for fresh piece landings, not restored snapshots. Capture real moves with the page visible and sound enabled. Source: `axial-web/apps/web/src/lib/game/audio/gameAudio.ts`.

When production starts:

1. Select the visual rhythm, a short music candidate and two or three voice samples using the actual script.
2. Make a 5–10 second capture test, including a move, an orbit and sound. Check frame pacing, UI legibility and the audio route.
3. Build a 10-second edit proof in both aspect ratios, including a title, a gameplay cut and narration. Review this before recording the full shot list.
4. Capture legal, staged gameplay and a few seconds of handles before/after every action. Use existing state/replay mechanisms if helpful rather than building a new cinematic system by default.
5. Assemble the full cut, caption it, balance music underneath speech and export both versions.
6. Inspect dimensions, codec, frame rate and duration with ffprobe. Watch start-to-finish with audio, muted and at phone size; inspect important frames for cropped controls, unreadable text and hidden winning lines.

Keep current product features central. Do not present coming-soon Tactical features as playable. No technical explanation of MCTS is needed in this trailer; the article already provides that depth.

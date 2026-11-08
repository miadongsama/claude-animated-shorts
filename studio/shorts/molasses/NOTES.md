# "Slow as Molasses" — production notes (2026-11-08)

A 70-second vertical cartoon short about the Great Molasses Flood (Boston, 15 January 1919), made with the
`cartoon-3d-short` skill in a cloud session with no GPU (software WebGL).

## Files
| path | what |
|---|---|
| `SCRIPT.md` | facts with sources, the approved script (v1) and the tightened v2 that was voiced |
| `voice/voice.wav`, `voice/words.json` | ElevenLabs narration (voice "Brian", multilingual v2, speed 1.18, then +4 % tempo), word timings |
| `audio/` | soundtrack: `music.py` (original ragtime score), `sfx.py` (synthesized effects), `mix.py` (mix + master), stems, `cues.md` |
| `../../src/videos/molasses/` | the picture: `story.ts` (shots, cameras, wave physics), `world.ts` (scene), `build.ts` (North End), `cast.ts` (staging), `toon.ts` (characters), `paint2.ts` (textures) |

## Picture
- 20 shots, 2,100 frames (70.0 s) at 30 fps, composition `MolassesShort`.
- Wave: a polar heightfield around the tank (rings every 0.4 m), crest 7.6 m at the burst decaying with distance,
  front at 35 mph slowing to a stop ~107 m out, forward curl on the crest, lumps along it. It sets solid at night.
- The el columns tilt when the crest reaches them (the x = 68 pair on "bending", f1044); the shed is flattened on
  "flattening" (f1070); the tank's 12 wall panels fall outward under gravity after the burst (f912).
- Night = its own light preset and grade (moonlight, gas lamps with bloom).

## Software-rendering budget (no GPU)
Measured per frame at 1080x1920: MSAA x4 ~3.2 s, lens blur ~3.0 s, ink ~1.5 s, bloom ~1.0 s, 4096 shadow map ~0.9 s.
So: lens passes only run in shots with depth of field, bloom only at night, shadow map 2048.
Render settings: `REMOTION_GL=swangle`, `CHROME=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`,
`--timeout=300000` (the world takes ~30 s to build in software).

## Sound
- Mix: voice unchanged, music ~10 LU under it (ducked -3 dB under words), events 6 dB under their natural level,
  master -15 LUFS integrated, true peak -1.2 dBTP, 48 kHz stereo, exactly 70.000 s.
- Nothing under "Twenty-one people died." except wind and one distant church bell.

#!/usr/bin/env bash
# Final render of MolassesShort on a machine without a GPU (software WebGL), in chunks so a crash never costs the whole
# render: each chunk is an h264 file; they are joined losslessly, then the soundtrack is muxed in and the QA runs.
# usage: bash scripts/render_molasses.sh [concurrency] [scale]
set -u
cd "$(dirname "$0")/.."
CONC="${1:-1}"
SCALE="${2:-1}"
export REMOTION_TMP=/root/remotion-tmp TMPDIR=/root/remotion-tmp REMOTION_GL=swangle
CHROME=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
OUT=out/molasses/final
mkdir -p "$OUT/chunks"
# chunk edges on shot boundaries
EDGES=(0 374 668 940 1296 1620 1951 2100)
for ((i = 0; i < ${#EDGES[@]} - 1; i++)); do
  a=${EDGES[$i]}; b=$((${EDGES[$((i + 1))]} - 1))
  f="$OUT/chunks/c$(printf %02d $i)_${a}_${b}.mp4"
  if [ -s "$f" ]; then echo "skip $f"; continue; fi
  echo "[$(date +%H:%M:%S)] rendering frames $a-$b -> $f"
  for attempt in 1 2; do
    npx remotion render src/index.ts MolassesShort "$f.tmp.mp4" --frames="$a-$b" --codec=h264 --crf=16 --pixel-format=yuv420p \
      --browser-executable="$CHROME" --gl=swangle --concurrency="$CONC" --timeout=300000 --scale="$SCALE" --log=error >> "$OUT/render_log.txt" 2>&1 \
      && mv "$f.tmp.mp4" "$f" && break
    echo "[$(date +%H:%M:%S)] chunk $a-$b failed (attempt $attempt)"
  done
done
ls "$OUT"/chunks/c*_*.mp4 | sort | sed "s|^|file '$(pwd)/|; s|$|'|" > "$OUT/chunks.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/chunks.txt" -c copy "$OUT/video_silent.mp4"
ffmpeg -v error -y -i "$OUT/video_silent.mp4" -i shorts/molasses/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -ar 48000 -t 70 \
  -movflags +faststart "$OUT/slow_as_molasses.mp4"
echo "[$(date +%H:%M:%S)] muxed $OUT/slow_as_molasses.mp4"
python3 scripts/short_qa.py "$OUT/slow_as_molasses.mp4" "$OUT/qa" out/molasses/shots.json > "$OUT/qa_report.txt" 2>&1
echo "[$(date +%H:%M:%S)] QA done: $OUT/qa_report.txt"

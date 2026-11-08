# Picture timeline of the molasses short, mirrored (read-only) from src/videos/molasses/story.ts so every sound lands on
# its frame: shots, crossfades, the flash, the paint, the rivets, the burst, the wave, the el, the shed, the gavel,
# the hammer and the lid. Times in seconds (30 fps).
import json
import math

FPS = 30
TOTAL = 2100
DUR = TOTAL / FPS            # 70.0 s exactly
fr = lambda f: f / FPS

# id: (first frame, end frame, light, place, what)
SHOTS = {
    1: (0, 176, "day", "out", "hook: the wave in the street, people running"),
    2: (176, 374, "day", "out", "winter harbour, the tank, fifty feet tall"),
    3: (374, 434, "day", "out", "Jell turns his blueprint upside down"),
    4: (434, 504, "day", "out", "a bucket into the empty tank, thumbs up"),
    5: (504, 599, "day", "out", "leaking seam, painters roll it brown"),
    6: (599, 668, "day", "out", "kids with buckets at the drips"),
    7: (668, 819, "day", "out", "the ship tops it up, the thaw, the groan"),
    8: (819, 940, "day", "out", "lunch, rivets, the burst"),
    9: (940, 1114, "day", "out", "the wave: street, height, racing, el, shed"),
    10: (1114, 1205, "day", "out", "Luckily: the pancake man on his crate"),
    11: (1205, 1296, "day", "out", "Unluckily: swept off the crate"),
    12: (1296, 1435, "day", "kitchen", "honey: warm pours, cold is glue"),
    13: (1435, 1469, "day", "out", "the runny wave races past a lamp post"),
    14: (1469, 1580, "night", "out", "the freezing night: rescuers stuck"),
    15: (1580, 1620, "night", "out", "the silent wide"),
    16: (1620, 1721, "day", "court", "anarchists vs the tank, the gavel"),
    17: (1721, 1820, "day", "court", "a real engineer signs the plans"),
    18: (1820, 1880, "day", "out", "barrels at the distillery door"),
    19: (1880, 1951, "day", "out", "the saloon gets its sign"),
    20: (1951, TOTAL, "day", "kitchen", "slow molasses, the lid goes back on"),
}
XFADE = {12: 8, 13: 8, 14: 14, 16: 8, 18: 8, 20: 8}
FLASH = fr(176)
PAINT0, PAINT1 = fr(548), fr(596)
RIVETS = [fr(f) for f in (842, 850, 857, 862, 866, 871, 876, 881)]
BURST = fr(912)
EL_HIT = fr(1044)
SHED_HIT = fr(1071)
GAVEL = [fr(1688), fr(1697)]
HAMMER = [fr(1913), fr(1921), fr(1928)]
LID = fr(2046)
FRIDGE = fr(1365)
SPOON_PULL = fr(1405)


def shot_t(i):
    a, b = SHOTS[i][:2]
    return fr(a), fr(b)


def shot_at(t):
    f = t * FPS
    for i, (a, b, *_r) in SHOTS.items():
        if a <= f < b:
            return i
    return 20


def words(path):
    return json.load(open(path, encoding="utf-8"))

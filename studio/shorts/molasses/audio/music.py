# Original score for the molasses short ("Slow as Molasses"), composed and synthesized here. F major, a little 1919
# ragtime for the set-up (108 bpm: banjo-ish plucks on the after-beats, tuba on the downbeats, vibes melody), comic
# stings on the jokes, a tense pedal for the groan, snare shots on every rivet, an agitato for the wave, a cheerful /
# sour vamp for "Luckily / Unluckily", a music-box waltz for the honey, a cold hush for the night (silence under
# "Twenty-one people died."), a pompous courtroom, honky-tonk at the saloon, the theme slowed to a crawl for
# "slow as molasses", and a button on the lid.
import numpy as np
from dsp import SR, ns, rng, pan, place, fades, dbg, make_ir, convolve_st, integrated, lp, hp
import instruments as I
import timeline as T

N = ns(T.DUR)
F = I.m2f
BPM = 108
Q = 60 / BPM
BAR = 4 * Q

# theme "Molasses Rag": (bar, beat, quarters, midi)
THEME = [
    (1, 0, .5, 72), (1, .5, .5, 74), (1, 1, .75, 77), (1, 1.75, .25, 74), (1, 2, .5, 72), (1, 2.5, .5, 69), (1, 3, 1, 72),
    (2, 0, .5, 70), (2, .5, .5, 69), (2, 1, .5, 67), (2, 1.5, .25, 69), (2, 1.75, .75, 70), (2, 2.5, .5, 72), (2, 3, 1, 69),
    (3, 0, .5, 74), (3, .5, .5, 77), (3, 1, .75, 79), (3, 1.75, .25, 77), (3, 2, .5, 74), (3, 2.5, .5, 70), (3, 3, 1, 74),
    (4, 0, .5, 72), (4, .5, .5, 76), (4, 1, .5, 79), (4, 1.5, .5, 76), (4, 2, 1, 72), (4, 3, 1, 67),
    (5, 0, .5, 69), (5, .5, .5, 72), (5, 1, .75, 77), (5, 1.75, .25, 76), (5, 2, .5, 77), (5, 2.5, .5, 79), (5, 3, 1, 81),
    (6, 0, .5, 78), (6, .5, .5, 81), (6, 1, .5, 78), (6, 1.5, .5, 74), (6, 2, 1, 72), (6, 3, 1, 69),
    (7, 0, .5, 67), (7, .5, .5, 70), (7, 1, .5, 74), (7, 1.5, .5, 77), (7, 2, .5, 76), (7, 2.5, .5, 72), (7, 3, 1, 76),
    (8, 0, 1.5, 77), (8, 1.5, .5, 72), (8, 2, .5, 69), (8, 2.5, .5, 65),
]
CHB = {1: ["F", "F", "F", "F"], 2: ["C7", "C7", "F", "F"], 3: ["Bb", "Bb", "Bb", "Bb"], 4: ["C7", "C7", "C7", "C7"],
       5: ["F", "F", "F", "F"], 6: ["D7", "D7", "D7", "D7"], 7: ["G7", "G7", "C7", "C7"], 8: ["F", "F", "C7", "C7"]}
CH = {
    "F": dict(oom=(41, 36), pah=[57, 60, 65]), "C7": dict(oom=(36, 43), pah=[58, 60, 64]), "Bb": dict(oom=(34, 41), pah=[58, 62, 65]),
    "D7": dict(oom=(38, 45), pah=[54, 57, 60]), "G7": dict(oom=(43, 38), pah=[53, 59, 62]), "Dm": dict(oom=(38, 45), pah=[57, 62, 65]),
    "A7": dict(oom=(45, 40), pah=[55, 61, 64]), "Gm": dict(oom=(43, 38), pah=[55, 58, 62]), "Fm": dict(oom=(41, 36), pah=[56, 60, 65]),
    "Db7": dict(oom=(37, 44), pah=[59, 61, 65]),
}

# sections (for the cue sheet and the level automation in mix.py)
SECTIONS = [
    ("hook", 0.0, T.FLASH), ("rag", T.FLASH, 25.57), ("tension", 25.57, T.BURST), ("wave", T.BURST, 37.13),
    ("lucky", 37.13, 43.2), ("waltz", 43.2, 47.83), ("raced", 47.83, 48.97), ("night", 48.97, 54.0),
    ("court", 54.0, 57.37), ("engineer", 57.37, 60.67), ("saloon", 60.67, 65.03), ("ending", 65.03, T.DUR),
]
R = rng(1919)


def _r():
    return rng(int(R.integers(1 << 30)))


class Band:
    def __init__(self):
        self.tr, self.send, self.cues = {}, {}, []

    def track(self, name, send):
        if name not in self.tr:
            self.tr[name] = np.zeros((2, N))
            self.send[name] = send
        return self.tr[name]

    def add(self, name, x, t, p=0.0, g=1.0):
        if t >= T.DUR or t < -2:
            return
        buf = self.track(name, 0.15)
        place(buf, pan(x, p) if np.ndim(x) == 1 else x, max(0.0, t), g)


def theme(t1, bars=range(1, 9), transpose=0, q=Q, stretch=None):
    ev = []
    for (b, beat, d, m) in THEME:
        if b not in bars:
            continue
        t = t1 + ((b - min(bars)) * 4 + beat) * q
        if stretch:
            t = t1 + stretch((b - min(bars)) * 4 + beat)
        ev.append((t, d * q, m + transpose))
    return ev


def rag_bar(b, t, chords, vel=0.6, tuba=True, pluck=True, brush=True, q=Q):
    for beat in range(4):
        c = CH[chords[beat]]
        tb = t + beat * q
        if tuba and beat in (0, 2):
            b.add("tuba", I.brass(F(c["oom"][0 if beat == 0 else 1]), 0.32 * q / Q, vel, _r(), "tuba"), tb, -0.1)
        if pluck and beat in (1, 3):
            for k, m in enumerate(c["pah"]):
                b.add("pluck", I.pluck(F(m), vel * 0.75 * R.uniform(0.9, 1.05), _r(), 0.7, 0.65), tb + 0.006 * k, 0.25 - 0.12 * k)
            if beat == 3 and R.uniform() < 0.5:
                b.add("pluck", I.pluck(F(c["pah"][-1] + 12), vel * 0.4, _r(), 0.4, 0.7), tb + q / 2, 0.3)
        if brush:
            b.add("brush", I.brush(vel * (0.55 if beat in (1, 3) else 0.35), _r()), tb, 0.05)


def melody(b, name, notes, vel, fn="vibes", p=0.0):
    for (t, d, m) in notes:
        if fn == "vibes":
            x = I.vibes(F(m), vel * R.uniform(0.92, 1.05), _r(), dur=max(1.0, d + 0.7), damp=d + 0.25)
        elif fn == "glock":
            x = I.glock(F(m), vel * R.uniform(0.92, 1.05), _r())
        elif fn == "musicbox":
            x = I.musicbox(F(m), vel * R.uniform(0.92, 1.05), _r(), dur=max(1.2, d + 1.0))
        elif fn == "pluck":
            x = I.pluck(F(m), vel, _r(), max(0.4, d + 0.3), 0.7)
        else:
            x = I.brass(F(m), d * 0.9, vel, _r(), fn)
        b.add(name, x, t, p)


def stab(b, notes, t, vel=0.8, dur=0.22, kind="stab"):
    for m in notes:
        b.add("stab", I.brass(F(m), dur, vel, _r(), kind, scoop=-15), t, (m - 60) / 30)


def wah(b, t, notes, step=0.32, vel=0.6):
    """muted-trombone 'wah-wah' falling line"""
    for k, m in enumerate(notes):
        last = k == len(notes) - 1
        b.add("horn", I.brass(F(m), step * (2.2 if last else 0.9), vel, _r(), "horn", scoop=-40, fall=-0.7 if last else 0.0), t + k * step, -0.15)


def slide_whistle(b, t, f0, f1, dur, vel=0.5):
    n = ns(dur)
    tm = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (tm / dur)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip(tm / dur, 0, 1)) ** 0.5 * vel
    b.add("fife", y * 0.35, t, 0.1)


def tremolo_pad(b, t, dur, chord, vel=0.5, rate=7.0):
    tr = lambda tm: 0.65 + 0.35 * np.sin(2 * np.pi * rate * tm)
    b.add("pad", I.pad([F(m) for m in chord], dur, vel, _r(), att=0.12, rel=0.3, warm=1400, trem=tr), t)


def timp_roll(b, t0, t1, f, v0, v1):
    t = t0
    while t < t1:
        u = (t - t0) / max(1e-6, t1 - t0)
        b.add("timpani", I.timpani(F(f), (v0 + (v1 - v0) * u) * R.uniform(0.85, 1.0), _r(), dur=0.6), t, -0.05)
        t += 0.055


def build():
    b = Band()
    for name, send in [("vibes", 0.22), ("glock", 0.22), ("musicbox", 0.3), ("pluck", 0.16), ("tuba", 0.1), ("brush", 0.12), ("horn", 0.18),
                       ("stab", 0.16), ("snare", 0.14), ("cymbal", 0.18), ("timpani", 0.2), ("pad", 0.28), ("fife", 0.2), ("triangle", 0.25)]:
        b.track(name, send)
        b.send[name] = send

    # ============ HOOK 0 - 5.87: D minor agitato under the running crowd; button stab on the white flash
    tremolo_pad(b, 0.0, T.FLASH - 0.05, [50, 53, 57, 62], 0.5, 8.0)
    for k in range(int(T.FLASH / (Q / 2))):
        t = k * Q / 2
        b.add("tuba", I.brass(F(38 if k % 2 == 0 else 45), 0.18, 0.55 + 0.2 * (t / T.FLASH), _r(), "tuba", scoop=-30), t, -0.1)
    for t in [1.36, 2.42, 3.24, 4.06]:
        stab(b, [62, 65, 69], t, 0.55, 0.16)
    timp_roll(b, 3.9, T.FLASH - 0.04, 38, 0.2, 0.75)
    stab(b, [53, 57, 60, 65, 69], T.FLASH, 0.85, 0.3)
    b.add("cymbal", I.cymbal(0.45, _r()), T.FLASH, 0.0)
    cut = np.ones(N)
    a, z = ns(T.FLASH - 0.04), ns(T.FLASH)
    cut[a:z] = np.linspace(1, 0, z - a); cut[z:] = 0
    for k in ("pad", "tuba", "timpani"):
        b.tr[k] *= cut[None, :]
    b.cues.append((0.0, "hook: D minor agitato (tremolo pad, tuba eighths, stabs, timpani roll), F major stab + cymbal on the flash"))

    # ============ RAG 6.0 - 25.57: the theme, comic stings on the jokes
    t1 = T.FLASH + 0.15
    for bar in range(1, 9):
        tb = t1 + (bar - 1) * BAR
        light = tb > 23.4                            # the thaw: tuba drops out, vibes alone
        rag_bar(b, tb, CHB[bar], 0.55, tuba=not light, brush=not light)
    melody(b, "vibes", theme(t1), 0.6, "vibes", 0.15)
    melody(b, "musicbox", [(t, d, m + 12) for (t, d, m) in theme(t1, bars=range(6, 8))], 0.45, "musicbox", -0.3)   # the kids
    wah(b, 13.42, [58, 57], 0.3, 0.55)                                    # "couldn't read a blueprint"
    for t, m in [(16.15, 96), (16.3, 101)]:
        melody(b, "glock", [(t, 0.2, m)], 0.45, "glock", 0.3)             # "six inches of water"
    slide_whistle(b, 19.05, 1700, 380, 0.65)                              # "painted it brown"
    b.cues.append((t1, "rag: theme bars 1-8 (vibes), banjo plucks, tuba, brushes; wah on the blueprint, plinks on six inches, slide whistle on brown"))

    # ============ TENSION 25.57 - 30.4: uh-oh, a low pedal, rivets as snare shots, the burst
    b.add("tuba", I.brass(F(41), 0.45, 0.6, _r(), "tuba", fall=-5), 25.6, -0.1)
    b.add("pad", I.pad([F(m) for m in [29, 36, 41, 44]], 4.5, 0.42, _r(), att=1.4, rel=0.4, warm=500), 25.9)
    timp_roll(b, 26.3, 27.2, 29, 0.1, 0.35)
    for k in range(2):                                                    # lunch: a sly two-beat pluck figure
        for j, m in enumerate([65, 69, 72, 69]):
            melody(b, "pluck", [(27.32 + k * 0.4 + j * 0.1, 0.1, m)], 0.35, "pluck", 0.2)
    for k, t in enumerate(T.RIVETS):
        b.add("snare", I.snare(0.55 + 0.05 * k, _r()), t - 0.005, 0.05)
    tremolo_pad(b, 28.0, T.BURST - 28.0, [49, 52, 55, 58], 0.35, 11.0)    # diminished, crescendo through the rivets
    timp_roll(b, 29.4, T.BURST - 0.03, 38, 0.3, 0.9)
    stab(b, [38, 50, 53, 56, 62], T.BURST, 0.95, 0.5)
    b.add("cymbal", I.cymbal(0.7, _r(), dur=3.0), T.BURST, 0.0)
    b.add("timpani", I.timpani(F(38), 1.0, _r(), dur=2.5), T.BURST, -0.05)

    # ============ WAVE 30.4 - 37.13: agitato (tremolo pad, tuba eighths), hits on the el and the shed
    tremolo_pad(b, 30.9, 6.15, [50, 53, 57, 62, 65], 0.5, 9.0)
    t = 30.9
    while t < 37.0:
        b.add("tuba", I.brass(F(38 if int((t - 30.9) / (Q / 2)) % 2 == 0 else 45), 0.16, 0.6, _r(), "tuba", scoop=-30), t, -0.1)
        t += Q / 2
    for t, ch in [(T.EL_HIT, [50, 56, 62, 65]), (T.SHED_HIT, [49, 55, 61, 64])]:
        stab(b, ch, t, 0.85, 0.28)
        b.add("timpani", I.timpani(F(38), 0.9, _r()), t, -0.05)
    melody(b, "horn", [(32.0 + k * Q, Q * 0.9, m) for k, m in enumerate([62, 64, 65, 67, 69, 70, 72, 74])], 0.5, "horn", -0.2)

    # ============ LUCKY 37.13 - 40.17 (F major vamp) / UNLUCKY 40.17 - 43.2 (F minor + wah-wah)
    for k in range(2):
        rag_bar(b, 37.2 + k * 1.5, ["F", "F", "C7", "C7"], 0.5, q=0.375)
    melody(b, "glock", [(37.25, 0.2, 72), (37.45, 0.2, 77), (37.65, 0.4, 81), (38.75, 0.2, 77), (38.95, 0.4, 81)], 0.5, "glock", 0.25)
    for k in range(2):
        rag_bar(b, 40.25 + k * 1.5, ["Fm", "Fm", "Db7", "C7"], 0.45, q=0.375)
    wah(b, 42.2, [58, 57, 56, 55], 0.26, 0.55)

    # ============ WALTZ 43.2 - 47.83: music box in 3/4 (honey), stopped dead on "glue"
    q3 = 0.42
    waltz = [(0, 1, 72), (1, 1, 77), (2, 1, 81), (3, 2, 79), (5, 1, 77), (6, 1, 76), (7, 1, 77), (8, 1, 79), (9, 3, 81)]
    for (bt, d, m) in waltz:
        melody(b, "musicbox", [(43.3 + bt * q3, d * q3, m)], 0.55, "musicbox", 0.1)
    for k in range(int((46.85 - 43.3) / (3 * q3))):
        tb = 43.3 + k * 3 * q3
        b.add("pluck", I.pluck(F(41 if k % 2 == 0 else 36), 0.4, _r(), 0.6, 0.4), tb, -0.1)
        for j in (1, 2):
            for m in ([57, 60, 65] if k % 2 == 0 else [58, 60, 64]):
                b.add("pluck", I.pluck(F(m), 0.22, _r(), 0.35, 0.6), tb + j * q3, 0.2)
    b.add("tuba", I.brass(F(29), 0.18, 0.5, _r(), "tuba", scoop=-60, fall=-3), 46.95, -0.1)   # "glue": a low boing

    # ============ RACED 47.83 - 48.97: one agitato swirl
    tremolo_pad(b, 47.85, 1.0, [50, 53, 57], 0.35, 10.0)
    melody(b, "horn", [(47.9 + k * 0.12, 0.12, m) for k, m in enumerate([62, 65, 69, 74, 77])], 0.4, "horn", -0.2)

    # ============ NIGHT 48.97 - 54.0: cold hush; nothing under "Twenty-one people died."
    b.add("pad", I.pad([F(m) for m in [38, 45, 50, 53]], 3.3, 0.32, _r(), att=1.2, rel=1.6, warm=520), 49.1)
    for t, m in [(49.6, 69), (50.6, 65), (51.6, 62), (52.3, 60)]:
        melody(b, "vibes", [(t, 1.2, m)], 0.32, "vibes", 0.2)

    # ============ COURT 54.0 - 57.37: pompous processional, the gavel lands
    for k in range(4):
        tb = 54.15 + k * 0.6
        b.add("tuba", I.brass(F([41, 36, 38, 34][k]), 0.4, 0.55, _r(), "tuba"), tb, -0.1)
        stab(b, [[57, 60, 65], [55, 58, 64], [57, 62, 65], [58, 62, 65]][k], tb + 0.3, 0.45, 0.18, "horn")
    for t in T.GAVEL:
        b.add("timpani", I.timpani(F(36), 0.85, _r()), t, 0.0)
        stab(b, [48, 55, 60, 64], t, 0.7, 0.2)

    # ============ ENGINEER 57.37 - 60.67: bright and sure (vibes + plucks), a glock flourish on "plans"
    for k in range(2):
        rag_bar(b, 57.45 + k * BAR * 0.75, ["F", "F", "C7", "F"], 0.45, tuba=True, brush=False, q=Q * 0.75)
    melody(b, "vibes", theme(57.45, bars=[1], q=Q * 0.75) + theme(57.45 + BAR * 0.75, bars=[8], q=Q * 0.75), 0.5, "vibes", 0.15)
    melody(b, "glock", [(59.95 + k * 0.07, 0.1, m) for k, m in enumerate([77, 81, 84, 89])], 0.45, "glock", 0.3)

    # ============ SALOON 60.67 - 65.03: honky-tonk rag, three hammer stabs, a sour wah
    t2 = 60.75
    for bar in range(1, 3):
        rag_bar(b, t2 + (bar - 1) * BAR * 0.86, CHB[bar + 2], 0.55, q=Q * 0.86)
    melody(b, "pluck", [(t, d, m + 12) for (t, d, m) in theme(t2, bars=[3, 4], q=Q * 0.86)], 0.45, "pluck", 0.2)
    for t in T.HAMMER:
        stab(b, [53, 60, 65], t, 0.6, 0.14)
    wah(b, T.HAMMER[-1] + 0.25, [58, 57, 56, 55], 0.24, 0.5)

    # ============ ENDING 65.03 - 70: the theme at a crawl on the music box; button on the lid
    slow = lambda beat: beat * Q * 1.9 * (1 + 0.04 * beat)
    melody(b, "musicbox", theme(65.15, bars=[1], stretch=slow), 0.5, "musicbox", 0.1)
    b.add("pad", I.pad([F(m) for m in [41, 53, 57, 60]], 2.4, 0.22, _r(), att=0.6, rel=0.6, warm=600), 65.2)
    stab(b, [41, 53, 57, 60, 65, 69], T.LID, 0.75, 0.35)
    b.add("glock", I.glock(F(89), 0.5, _r()), T.LID, 0.3)
    b.add("cymbal", I.cymbal(0.25, _r(), dur=2.0), T.LID, 0.0)
    end = np.ones(N)
    a = ns(T.DUR - 0.5)
    end[a:] = np.linspace(1, 0, N - a) ** 1.5
    for k in b.tr:
        b.tr[k] *= end[None, :]
    return b


TARGET = {  # relative balance inside the band (LU, measured on each track's own active span)
    "vibes": 0.0, "glock": -5.0, "musicbox": -1.0, "pluck": -4.0, "tuba": -3.0, "brush": -14.0, "horn": -4.0, "stab": -3.0,
    "snare": -4.0, "cymbal": -11.0, "timpani": -5.0, "pad": -5.0, "fife": -6.0, "triangle": -15.0,
}


def render(b, ref=-20.0):
    hall = make_ir(1.4, 7, pre=0.018, hf=1.4)
    dry = np.zeros((2, N))
    wet = np.zeros((2, N))
    levels = {}
    for k, x in b.tr.items():
        if not np.any(x):
            continue
        L = integrated(x)
        g = dbg(ref + TARGET.get(k, -6) - L)
        levels[k] = (round(L, 1), round(ref + TARGET.get(k, -6), 1))
        x = x * g
        b.tr[k] = x
        dry += x
        wet += b.send[k] * x
    out = dry + 0.7 * convolve_st(wet.mean(0), hall)
    out = hp(out, 30, 2)
    return out, levels

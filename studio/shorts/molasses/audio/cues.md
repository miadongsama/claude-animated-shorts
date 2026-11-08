# Slow as Molasses - soundtrack cue sheet

All sound is original: synthesized in numpy/scipy by `sfx_gen.py` / `instruments.py`, placed by `sfx.py` / `music.py`, mixed by `mix.py`.
Voice = `voice/voice.wav`, gain only (no EQ, no compression, no pitch).

## Files
| file | content |
|---|---|
| `mix.wav` | final mix, 48 kHz, stereo, 24-bit, 3,360,000 samples = 70.000 s |
| `stem_voice.wav` / `stem_music.wav` / `stem_sfx.wav` | stems at mix gain (they sum to the mix before the master limiter) |

## Master loudness (own BS.1770-4 meter)
- Integrated **-15.0 LUFS**, true peak **-1.2 dBTP**, LRA 2.0 LU, max momentary -10.2 LUFS, max short-term -13.9 LUFS
- Stems: voice -15.0 LUFS, music -25.1 LUFS, sfx -30.8 LUFS (voice gain +5.81 dB, same gain on every stem)
- Master limiter (4x oversampled look-ahead, ceiling -1.2 dBTP): max gain reduction 4.01 dB, active (>0.1 dB) on 8.73 % of samples, >0.5 dB on 3.26 %

ffmpeg ebur128 cross-check:
```
Summary:
  Integrated loudness:
    I:         -15.0 LUFS
    Threshold: -25.2 LUFS
  Loudness range:
    LRA:         2.0 LU
    Threshold: -35.2 LUFS
    LRA low:   -16.2 LUFS
    LRA high:  -14.2 LUFS
  True peak:
    Peak:       -1.2 dBFS
```

## Voice on top: per-section loudness (LUFS, integrated per stem, at mix gain)
bed = music + sfx. margin = voice - bed (integrated over the section). speech median / p10 = median and 10th percentile of the 400 ms momentary margin (voice - bed) over windows centred on spoken words.

| section (shots) | time s | voice | music | sfx | bed | margin LU | speech median LU | speech p10 LU |
|---|---|---|---|---|---|---|---|---|
| hook (1) | 0.00-5.87 | -14.8 | -24.3 | -32.5 | -23.7 | 8.9 | 8.1 | 3.1 |
| setting (2) | 5.87-12.47 | -14.9 | -24.0 | -38.1 | -23.8 | 9.0 | 8.8 | 4.9 |
| jell+test (3-4) | 12.47-16.80 | -15.2 | -25.4 | -36.6 | -25.1 | 9.9 | 9.6 | 4.3 |
| paint+kids (5-6) | 16.80-22.27 | -15.9 | -25.9 | -37.7 | -25.6 | 9.7 | 9.2 | 5.9 |
| ship+groan (7) | 22.27-27.30 | -15.5 | -28.2 | -30.9 | -27.6 | 12.1 | 12.3 | 7.0 |
| lunch+burst (8) | 27.30-31.33 | -14.9 | -23.1 | -23.9 | -20.8 | 5.9 | 5.9 | 2.1 |
| wave (9) | 31.33-37.13 | -14.6 | -24.4 | -27.9 | -22.8 | 8.3 | 8.5 | 4.0 |
| lucky (10-11) | 37.13-43.20 | -15.3 | -25.3 | -32.2 | -24.5 | 9.2 | 9.1 | 2.3 |
| honey (12) | 43.20-47.83 | -15.7 | -26.7 | -38.5 | -26.4 | 10.7 | 10.2 | 5.6 |
| night (13-15) | 47.83-54.00 | -14.6 | -26.8 | -34.9 | -26.6 | 11.9 | 11.8 | 7.1 |
| court (16-17) | 54.00-60.67 | -14.6 | -25.4 | -32.9 | -24.9 | 10.2 | 10.6 | 4.2 |
| saloon (18-19) | 60.67-65.03 | -15.1 | -25.6 | -29.5 | -24.5 | 9.4 | 8.5 | 4.1 |
| ending (20) | 65.03-70.00 | -14.8 | -24.8 | -34.7 | -24.5 | 9.7 | 10.1 | 2.4 |

## Music map (original march, Bb major, 120 bpm: quarter note = footfall)
Music target per section, LU under the voice (after a -3 dB speech duck keyed from words.json): hook -9.5, rag -10.0, tension -10.0, wave -9.5, lucky -10.0, waltz -11.0, raced -10.0, night -13.0, court -10.5, engineer -10.5, saloon -10.5, ending -10.0. Applied section gains (dB): hook -9.2, rag -11.8, tension -7.4, wave -9.7, lucky -7.8, waltz -10.0, raced -3.5, night -6.7, court -6.3, engineer -9.7, saloon -8.8, ending -7.5, dropout -7.4.

Rides (music only, dB): 52.60-54.00 s -6.0 - so quiet sentence-final words stay on top and the band blooms in the gaps after them. The hook's last two footfalls (3.5, 4.0) are also 3 dB lower in the SFX for '...walking across it.'

| time s | frame | music |
|---|---|---|
| 0.00 | 0 | hook: D minor agitato (tremolo pad, tuba eighths, stabs, timpani roll), F major stab + cymbal on the flash |
| 6.02 | 180 | rag: theme bars 1-8 (vibes), banjo plucks, tuba, brushes; wah on the blueprint, plinks on six inches, slide whistle on brown |

## SFX events
Level convention: every EVENT has a naive level (LU vs the voice stem, as the event's max momentary loudness); applied = naive - 6 dB (standard mix rule) + distance/intensity offsets. BEDS are integrated loudness, not reduced. 'mix LUFS' = the event's max momentary loudness in the final mix (voice stem = -15.0 LUFS integrated). Column sounds also get the camera-distance low-pass and more valley reverb.

| # | time s | frame | cue | what | naive LU | applied LU | mix LUFS | pan |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.000 | 0.0 | bed_wave_hook (bed, integrated) | hook: the wave's roar right behind the runners, gloopy surge, running crowd (shot 1) | -18 | -18.0 | -33.0 | +0.00 |
| 2 | 1.200 | 36.0 | whoa_hook | a few startled 'whoa!'s from the people running | -14 | -20.0 | -35.2 | +0.00 |
| 3 | 5.867 | 176.0 | bed_city (bed, integrated) | Commercial Street 1919: far horse hooves, cart wheels, a murmur (shots 2-3) | -31 | -31.0 | -46.3 | +0.00 |
| 4 | 5.867 | 176.0 | bed_harbour (bed, integrated) | winter harbour: breeze, lapping at the pilings, gulls, a far bell buoy (shots 2-8) | -27 | -27.0 | -42.0 | +0.00 |
| 5 | 5.867 | 176.0 | flash | reverse swell into the white flash + soft low whoomp | -6 | -12.0 | -27.0 | +0.00 |
| 6 | 7.667 | 230.0 | whoosh | camera: cut to the tank | -13 | -19.0 | -34.0 | +0.00 |
| 7 | 8.600 | 258.0 | whoosh | camera: cut low under the wall | -13 | -19.0 | -34.0 | +0.00 |
| 8 | 9.733 | 292.0 | whoosh | camera: crane up the side | -13 | -19.0 | -34.0 | +0.00 |
| 9 | 13.267 | 398.0 | rustle | Jell turns the blueprint round (and round) | -12 | -18.0 | -33.0 | -0.10 |
| 10 | 14.867 | 446.0 | pour | one bucket of water tipped into the empty tank, splashing far below (with the tank's echo) | -12 | -18.0 | -33.0 | +0.00 |
| 11 | 16.900 | 507.0 | drip | molasses dripping from the seam | -18 | -24.0 | -39.0 | +0.10 |
| 12 | 17.600 | 528.0 | drip | molasses dripping from the seam | -18 | -24.0 | -39.0 | +0.10 |
| 13 | 18.133 | 544.0 | whoosh | camera: cut to the painters | -13 | -19.0 | -34.0 | +0.00 |
| 14 | 18.267 | 548.0 | roller | paint rollers slapping brown paint on the steel | -16 | -22.0 | -37.0 | +0.20 |
| 15 | 18.300 | 549.0 | drip | molasses dripping from the seam | -18 | -24.0 | -39.0 | +0.10 |
| 16 | 19.100 | 573.0 | drip | molasses dripping from the seam | -18 | -24.0 | -39.0 | +0.10 |
| 17 | 20.400 | 612.0 | kids | kids giggling at the drips | -16 | -22.0 | -294.9 | +0.00 |
| 18 | 22.267 | 668.0 | ship_horn | the steamship's whistle as it tops the tank up | -10 | -16.0 | -31.0 | -0.40 |
| 19 | 22.800 | 684.0 | pump | the hose pumping molasses up into the tank (rhythmic gloop) | -18 | -24.0 | -39.0 | -0.20 |
| 20 | 23.600 | 708.0 | whoosh | camera: cut to the roofs | -13 | -19.0 | -34.0 | +0.00 |
| 21 | 23.733 | 712.0 | icicle_drip | melt water dripping from the icicles | -20 | -26.0 | -41.0 | +0.00 |
| 22 | 23.950 | 718.5 | icicle_drip | melt water dripping from the icicles | -20 | -26.0 | -41.0 | +0.25 |
| 23 | 24.139 | 724.2 | icicle_drip | melt water dripping from the icicles | -20 | -26.0 | -41.0 | +0.27 |
| 24 | 24.384 | 731.5 | icicle_drip | melt water dripping from the icicles | -20 | -26.0 | -41.0 | +0.04 |
| 25 | 24.547 | 736.4 | icicle_drip | melt water dripping from the icicles | -20 | -26.0 | -41.0 | -0.23 |
| 26 | 24.816 | 744.5 | icicle_drip | melt water dripping from the icicles | -20 | -26.0 | -41.0 | -0.29 |
| 27 | 24.956 | 748.7 | icicle_drip | melt water dripping from the icicles | -20 | -26.0 | -41.0 | -0.08 |
| 28 | 25.245 | 757.4 | icicle_drip | melt water dripping from the icicles | -20 | -26.0 | -41.0 | +0.20 |
| 29 | 25.368 | 761.0 | icicle_drip | melt water dripping from the icicles | -20 | -26.0 | -41.0 | +0.30 |
| 30 | 25.567 | 767.0 | groan | the tank groaning: steel plates straining, a low moan | -8 | -14.0 | -29.0 | +0.00 |
| 31 | 25.567 | 767.0 | whoosh | camera: cut to the groaning wall | -13 | -19.0 | -34.0 | +0.00 |
| 32 | 25.900 | 777.0 | tick | plates ticking under strain | -16 | -22.0 | -37.0 | -0.20 |
| 33 | 26.300 | 789.0 | tick | plates ticking under strain | -16 | -22.0 | -37.0 | +0.00 |
| 34 | 26.750 | 802.5 | tick | plates ticking under strain | -16 | -22.0 | -37.0 | +0.20 |
| 35 | 27.300 | 819.0 | lunch | workers chatting over lunch, a laugh | -15 | -21.0 | -36.2 | +0.00 |
| 36 | 28.067 | 842.0 | rivet | rivet 1 shoots out (machine-gun rattle) | -6 | -12.0 | -27.0 | +0.00 |
| 37 | 28.067 | 842.0 | whoosh | camera: whip to the rivets | -13 | -19.0 | -34.0 | +0.00 |
| 38 | 28.333 | 850.0 | rivet | rivet 2 shoots out (machine-gun rattle) | -6 | -12.0 | -27.0 | +0.14 |
| 39 | 28.567 | 857.0 | rivet | rivet 3 shoots out (machine-gun rattle) | -6 | -12.0 | -27.0 | -0.11 |
| 40 | 28.733 | 862.0 | rivet | rivet 4 shoots out (machine-gun rattle) | -6 | -12.0 | -27.0 | -0.04 |
| 41 | 28.867 | 866.0 | rivet | rivet 5 shoots out (machine-gun rattle) | -6 | -12.0 | -27.0 | +0.15 |
| 42 | 29.033 | 871.0 | rivet | rivet 6 shoots out (machine-gun rattle) | -6 | -12.0 | -27.0 | -0.08 |
| 43 | 29.200 | 876.0 | rivet | rivet 7 shoots out (machine-gun rattle) | -6 | -12.0 | -27.0 | -0.08 |
| 44 | 29.367 | 881.0 | rivet | rivet 8 shoots out (machine-gun rattle) | -6 | -12.0 | -27.0 | +0.15 |
| 45 | 30.300 | 909.0 | bed_flood (bed, integrated) | the flood rolling out: roar + thick gloop, settling (shots 8-11) | -17 | -17.0 | -32.0 | +0.00 |
| 46 | 30.400 | 912.0 | burst | the whole tank tears open: metal rip, deep boom, panels clanging, the roar begins | +0 | -6.0 | -21.0 | +0.00 |
| 47 | 31.467 | 944.0 | whoa_wave | people running from the wave | -15 | -21.0 | -36.2 | +0.00 |
| 48 | 31.933 | 958.0 | whoosh | camera: cut low | -13 | -19.0 | -34.0 | +0.00 |
| 49 | 33.333 | 1000.0 | whoosh | camera: race alongside | -13 | -19.0 | -34.0 | +0.00 |
| 50 | 34.750 | 1042.5 | el_bend | the crest slams the el: columns screech and bend, a clank | -5 | -11.0 | -26.0 | +0.00 |
| 51 | 35.670 | 1070.1 | shed_crash | the wooden shed flattened: splintering crash + timber boom | -4 | -10.0 | -25.0 | +0.00 |
| 52 | 38.333 | 1150.0 | dip | the pancake dipped in runny molasses: a happy gloop | -15 | -21.0 | -36.0 | +0.10 |
| 53 | 40.300 | 1209.0 | swept | the flow sweeps the crate away: surge + squelchy plop | -9 | -15.0 | -30.0 | +0.00 |
| 54 | 43.070 | 1292.1 | bed_kitchen (bed, integrated) | kitchen: room tone, a wall clock ticking, winter wind at the window (shot 12) | -33 | -33.0 | -48.0 | +0.00 |
| 55 | 44.033 | 1321.0 | drizzle | warm honey drizzling onto toast | -19 | -25.0 | -40.0 | +0.10 |
| 56 | 45.500 | 1365.0 | fridge | the icebox door: clack, seal, cold hum | -13 | -19.0 | -34.0 | +0.30 |
| 57 | 46.833 | 1405.0 | stuck_spoon | pulling the spoon: the whole jar comes along with a sticky creak | -13 | -19.0 | -34.0 | -0.10 |
| 58 | 47.703 | 1431.1 | bed_wave2 (bed, integrated) | the runny wave racing past (shot 13) | -18 | -18.0 | -33.0 | +0.00 |
| 59 | 48.737 | 1462.1 | bed_night (bed, integrated) | the freezing night: cold wind, the harbour far off, molasses ticking as it sets (shots 14-15) | -26 | -26.0 | -41.0 | +0.00 |
| 60 | 51.067 | 1532.0 | whoosh | camera: push in | -13 | -19.0 | -34.0 | +0.00 |
| 61 | 51.250 | 1537.5 | squelch | a boot hauled out of set molasses on a stretching strand | -12 | -18.0 | -33.0 | +0.15 |
| 62 | 51.900 | 1557.0 | squelch | a boot hauled out of set molasses on a stretching strand | -12 | -18.0 | -33.0 | +0.15 |
| 63 | 52.450 | 1573.5 | squelch | a boot hauled out of set molasses on a stretching strand | -12 | -18.0 | -33.0 | +0.15 |
| 64 | 52.833 | 1585.0 | bell | one toll of a church bell across the frozen street | -14 | -20.0 | -35.0 | +0.00 |
| 65 | 53.870 | 1616.1 | bed_court (bed, integrated) | courtroom: high room tone, murmur, a chair creak (shots 16-17) | -32 | -32.0 | -47.3 | +0.00 |
| 66 | 56.267 | 1688.0 | gavel | the judge's gavel | -6 | -12.0 | -27.0 | +0.10 |
| 67 | 56.567 | 1697.0 | gavel | the judge's gavel | -6 | -12.0 | -27.0 | +0.10 |
| 68 | 59.600 | 1788.0 | pen | the engineer signs: nib scratching across the plans | -18 | -24.0 | -39.0 | -0.20 |
| 69 | 60.467 | 1814.0 | stamp | the seal stamped down | -12 | -18.0 | -33.0 | -0.20 |
| 70 | 60.537 | 1816.1 | bed_street (bed, integrated) | street by the distillery and the saloon: far hooves, chatter (shots 18-19) | -30 | -30.0 | -45.2 | +0.00 |
| 71 | 60.733 | 1822.0 | barrel | a barrel rolled over the cobbles to the distillery door | -15 | -21.0 | -36.0 | -0.20 |
| 72 | 63.767 | 1913.0 | hammer | hammer blow 1 nailing up the no-alcohol sign | -6 | -12.0 | -27.0 | +0.15 |
| 73 | 64.033 | 1921.0 | hammer | hammer blow 2 nailing up the no-alcohol sign | -6 | -12.0 | -27.0 | +0.15 |
| 74 | 64.267 | 1928.0 | hammer | hammer blow 3 nailing up the no-alcohol sign | -6 | -12.0 | -27.0 | +0.15 |
| 75 | 64.903 | 1947.1 | bed_kitchen2 (bed, integrated) | kitchen in January: clock, wind at the window (shot 20) | -33 | -33.0 | -48.0 | +0.00 |
| 76 | 65.500 | 1965.0 | slow_drip | molasses creeping onto the pancakes (slow, thick plops) | -20 | -26.0 | -41.0 | +0.10 |
| 77 | 68.200 | 2046.0 | lid | the lid slammed back on the jar | -7 | -13.0 | -28.0 | +0.05 |
| 78 | 68.533 | 2056.0 | slide | the jar slid away across the table | -16 | -22.0 | -37.0 | -0.10 |

import { Song, Studio } from "./types";

export const MOCK_SONGS: Song[] = [
  {
    id: "s1",
    title: "Cyber City Drift",
    bpm: 120,
    timeSignature: "4/4",
    resolution: 16,
    durationSeconds: 60,
    backingTrackUrl: "https://actions.google.com/sounds/v1/science_fiction/glitch_low_power.ogg", // Placeholder
    stems: [
      { id: "st1", type: "kick", audioUrl: "https://actions.google.com/sounds/v1/impacts/wood_block_impact.ogg", difficulty: "easy", pattern: [0, 4, 8, 12, 16, 20, 24, 28] },
      { id: "st2", type: "snare", audioUrl: "https://actions.google.com/sounds/v1/doors/door_knock_3.ogg", difficulty: "easy", pattern: [4, 12, 20, 28] },
      { id: "st3", type: "perc", audioUrl: "https://actions.google.com/sounds/v1/science_fiction/teleport_sound.ogg", difficulty: "medium", pattern: [2, 6, 10, 14, 18, 22, 26, 30] },
      { id: "st4", type: "hihat", audioUrl: "https://actions.google.com/sounds/v1/swishes/air_whoosh.ogg", difficulty: "medium", pattern: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { id: "st5", type: "vocal", audioUrl: "https://actions.google.com/sounds/v1/cartoon/clown_horn.ogg", difficulty: "advanced", pattern: [7, 15, 23, 31] },
    ]
  }
];

export const MOCK_STUDIOS: Studio[] = [
  { id: "std1", name: "Neon Heights", ownerUserId: "admin", description: "The core of futuristic beats.", coverColor: "#993DEB" },
  { id: "std2", name: "Bass Bunker", ownerUserId: "admin", description: "Deep vibes only.", coverColor: "#3838FA" },
  { id: "std3", name: "Synth Wave", ownerUserId: "admin", description: "Retro-future soul.", coverColor: "#EB3D99" },
  { id: "std4", name: "Glitch Lab", ownerUserId: "admin", description: "Experimental textures.", coverColor: "#3DEB99" },
  { id: "std5", name: "Beat Box", ownerUserId: "admin", description: "Old school rhythm.", coverColor: "#EBEB3D" },
];
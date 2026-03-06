# **App Name**: BeatHero

## Core Features:

- User Authentication: Secure user registration and login using Firebase Authentication, supporting email/password and Google accounts.
- Interactive Rhythm Gameplay: Core game mechanics with visually falling notes, responsive virtual sampler pads for 'Kick, Snare, Percussion, HiHats, Vocal Chops', and immediate hit/miss detection.
- Dynamic Song & Level Library: Dynamically load diverse songs, backing tracks, stem audio, and rhythmic patterns from Firestore and Firebase Storage.
- Performance Feedback Tool: Utilize an AI-powered tool to analyze player's rhythm performance and provide personalized, constructive feedback on timing accuracy and areas for improvement.
- Score & Progress Tracking: Accurately calculate and persistently store individual game scores, accuracy, hits, and misses in Firestore after each level.
- Global Leaderboards: Display a sorted leaderboard showing top player scores for various levels, queried dynamically from Firestore.

## Style Guidelines:

- Dark scheme with a vibrant electric violet as the primary interactive color for UI elements and active states. Primary Color: #993DEB (RGB: 153, 61, 235).
- Subtle, dark background with a deep, desaturated violet hue, providing a sophisticated backdrop for neon accents. Background Color: #1F1A23 (RGB: 31, 26, 35).
- An analogous electric blue as an accent color for key highlights, notifications, and contrasting UI components. Accent Color: #3838FA (RGB: 56, 56, 250).
- Headline and body font: 'Space Grotesk' (sans-serif) for a modern, techy, and sharp aesthetic, fitting the HipHop MPC interface inspiration.
- Sleek, minimalist, and geometric line-based icons, incorporating neon glow effects to complement the futuristic HipHop MPC visual theme.
- Distinctive three-panel layout: a top section for the scrolling waveform of the backing track, a central area for falling rhythm notes, and a bottom section dedicated to five large, responsive sampler pads.
- Smooth, fluid animations for falling notes. Interactive pads will glow and animate dynamically upon being triggered, along with visual feedback animations for hit/miss detection.
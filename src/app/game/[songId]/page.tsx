import React from 'react';
import { GameView } from '@/components/game/GameView';
import { MOCK_SONGS } from '@/lib/game/mock-data';
import { notFound } from 'next/navigation';

export default async function GamePage({ params }: { params: { songId: string } }) {
  const { songId } = await params;
  const song = MOCK_SONGS.find(s => s.id === songId);

  if (!song) {
    return notFound();
  }

  return (
    <div className="h-screen bg-[#1F1A23]">
      <GameView song={song} />
    </div>
  );
}
'use server';
/**
 * @fileOverview Provides AI-generated personalized feedback on a player's rhythm performance.
 *
 * - playerPerformanceFeedback - A function that generates performance feedback based on game stats.
 * - PlayerPerformanceFeedbackInput - The input type for the playerPerformanceFeedback function.
 * - PlayerPerformanceFeedbackOutput - The return type for the playerPerformanceFeedback function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PlayerPerformanceFeedbackInputSchema = z.object({
  songTitle: z.string().describe('The title of the song the player just completed.'),
  hits: z.number().int().min(0).describe('The total number of notes the player hit correctly.'),
  misses: z.number().int().min(0).describe('The total number of notes the player missed.'),
  accuracy: z.number().min(0).max(100).describe('The player\'s overall accuracy percentage (0-100).'),
});
export type PlayerPerformanceFeedbackInput = z.infer<typeof PlayerPerformanceFeedbackInputSchema>;

const PlayerPerformanceFeedbackOutputSchema = z.object({
  overallFeedback: z.string().describe('A general summary of the player\'s performance.'),
  strengths: z.array(z.string()).describe('An array of positive aspects of the player\'s performance.'),
  areasForImprovement: z.array(z.string()).describe('An array of areas where the player can improve.'),
  suggestions: z.array(z.string()).describe('An array of actionable suggestions for improvement.'),
});
export type PlayerPerformanceFeedbackOutput = z.infer<typeof PlayerPerformanceFeedbackOutputSchema>;

export async function playerPerformanceFeedback(input: PlayerPerformanceFeedbackInput): Promise<PlayerPerformanceFeedbackOutput> {
  return playerPerformanceFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'playerPerformanceFeedbackPrompt',
  input: { schema: PlayerPerformanceFeedbackInputSchema },
  output: { schema: PlayerPerformanceFeedbackOutputSchema },
  prompt: `You are a supportive and encouraging rhythm game coach named 'BeatBot'. Your goal is to provide personalized, constructive feedback to players after they complete a song in BeatHero. You will highlight their strengths and offer actionable suggestions for improvement.

The player just completed the song '{{{songTitle}}}' with the following results:
- Hits: {{{hits}}}
- Misses: {{{misses}}}
- Accuracy: {{{accuracy}}}%

Based on these results, please provide feedback in a friendly and encouraging tone. Focus on specific insights derived from the accuracy, hits, and misses. If the accuracy is very high (90% and above), emphasize their excellent rhythm. If it's moderate (60-89%), provide balanced feedback. If it's low (below 60%), focus on encouragement and foundational tips.

Structure your feedback in a clear JSON format with the following fields:
- overallFeedback: A concise, encouraging summary.
- strengths: An array of specific positive points.
- areasForImprovement: An array of specific areas for growth.
- suggestions: An array of practical tips or exercises.`,
});

const playerPerformanceFeedbackFlow = ai.defineFlow(
  {
    name: 'playerPerformanceFeedbackFlow',
    inputSchema: PlayerPerformanceFeedbackInputSchema,
    outputSchema: PlayerPerformanceFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

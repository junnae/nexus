export type Difficulty = 'easy' | 'medium' | 'hard'
export type CelebrationAnimation = 'pop' | 'bounce' | 'confetti'

export interface Word {
  level_id: number
  target_word: string
  letters: string[]
  foils: string[]
  image_path: string
  audio_word_path: string
  audio_letters: Record<string, string>
  difficulty: Difficulty
  celebration_animation: CelebrationAnimation
}

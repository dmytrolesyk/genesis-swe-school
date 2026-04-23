import type { QuizQuestion } from './quiz-content.js'

export type EvaluationResult = {
  correctOptionIds: string[]
  isCorrect: boolean
}

export type AttemptResult = EvaluationResult & {
  shouldRetry: boolean
}

export type QuizProgress = {
  answeredQuestionIds: string[]
  correctQuestionIds: string[]
  currentIndex: number
  firstAttemptOutcomes: Record<string, boolean | null>
  missedQuestionIds: string[]
  score: number
  streak: number
}

export type WeakTopicItem = {
  id: string
  interviewAnswer: string
  prompt: string
}

export type WeakTopicSummary = {
  category: string
  items: WeakTopicItem[]
  misses: number
}

export declare function evaluateQuestion (
  question: QuizQuestion,
  selectedOptionIds: string[]
): EvaluationResult

export declare function createInitialProgress (
  questions: QuizQuestion[]
): QuizProgress

export declare function applyAttempt (
  progress: QuizProgress,
  question: QuizQuestion,
  selectedOptionIds: string[]
): {
  progress: QuizProgress
  result: AttemptResult
}

export declare function getRetryQueue (
  questions: QuizQuestion[],
  missedQuestionIds: string[]
): QuizQuestion[]

export declare function summarizeWeakTopics (
  questions: QuizQuestion[],
  missedQuestionIds: string[]
): WeakTopicSummary[]

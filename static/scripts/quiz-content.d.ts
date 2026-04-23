export type QuizAchievement = {
  id: string
  label: string
}

export type QuizDiagram = {
  id: string
  title: string
  caption: string
  interviewNote: string
}

export type QuizOption = {
  id: string
  label: string
}

export type QuizQuestion = {
  id: string
  category: string
  kind: 'single' | 'multi' | 'order' | 'boss'
  prompt: string
  options: QuizOption[]
  correctOptionIds: string[]
  explanation: string
  interviewAnswer: string
  deeperFollowUp: string
  diagramId?: string
  achievementId?: string
}

export declare const quizAchievements: QuizAchievement[]
export declare const quizDiagrams: QuizDiagram[]
export declare const quizQuestions: QuizQuestion[]

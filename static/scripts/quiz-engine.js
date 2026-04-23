// @ts-nocheck — browser module, tested via Vitest import

const POINTS_PER_QUESTION = 10

/**
 * @param {import('./quiz-content.js').QuizQuestion} question
 * @param {string[]} selectedOptionIds
 */
export function evaluateQuestion (question, selectedOptionIds) {
  const expected = [...question.correctOptionIds].sort()
  const selected = [...selectedOptionIds]

  const isCorrect = question.kind === 'order'
    ? JSON.stringify(selected) === JSON.stringify(question.correctOptionIds)
    : JSON.stringify([...selected].sort()) === JSON.stringify(expected)

  return {
    correctOptionIds: expected,
    isCorrect
  }
}

/**
 * @param {import('./quiz-content.js').QuizQuestion[]} questions
 */
export function createInitialProgress (questions) {
  return {
    answeredQuestionIds: [],
    correctQuestionIds: [],
    currentIndex: 0,
    firstAttemptOutcomes: Object.fromEntries(
      questions.map((question) => [question.id, null])
    ),
    missedQuestionIds: [],
    score: 0,
    streak: 0
  }
}

/**
 * @param {ReturnType<typeof createInitialProgress>} progress
 * @param {import('./quiz-content.js').QuizQuestion} question
 * @param {string[]} selectedOptionIds
 */
export function applyAttempt (progress, question, selectedOptionIds) {
  const evaluation = evaluateQuestion(question, selectedOptionIds)
  const isFirstAttempt = progress.firstAttemptOutcomes[question.id] === null
  const wasAlreadyMissed = progress.missedQuestionIds.includes(question.id)

  const nextProgress = { ...progress }
  nextProgress.answeredQuestionIds = [...progress.answeredQuestionIds]
  nextProgress.correctQuestionIds = [...progress.correctQuestionIds]
  nextProgress.missedQuestionIds = [...progress.missedQuestionIds]
  nextProgress.firstAttemptOutcomes = { ...progress.firstAttemptOutcomes }

  if (isFirstAttempt) {
    nextProgress.firstAttemptOutcomes[question.id] = evaluation.isCorrect
  }

  if (evaluation.isCorrect) {
    if (!nextProgress.correctQuestionIds.includes(question.id)) {
      nextProgress.correctQuestionIds.push(question.id)
    }

    if (isFirstAttempt) {
      nextProgress.score += POINTS_PER_QUESTION
      nextProgress.streak += 1
    }

    return {
      progress: nextProgress,
      result: {
        ...evaluation,
        shouldRetry: false
      }
    }
  }

  // Wrong answer
  if (isFirstAttempt) {
    nextProgress.streak = 0
  }

  if (!wasAlreadyMissed) {
    nextProgress.missedQuestionIds.push(question.id)
  }

  return {
    progress: nextProgress,
    result: {
      ...evaluation,
      shouldRetry: true
    }
  }
}

/**
 * @param {import('./quiz-content.js').QuizQuestion[]} questions
 * @param {string[]} missedQuestionIds
 */
export function getRetryQueue (questions, missedQuestionIds) {
  const missedSet = new Set(missedQuestionIds)
  return questions.filter((question) => missedSet.has(question.id))
}

/**
 * @param {import('./quiz-content.js').QuizQuestion[]} questions
 * @param {string[]} missedQuestionIds
 */
export function summarizeWeakTopics (questions, missedQuestionIds) {
  const missedSet = new Set(missedQuestionIds)
  const missedQuestions = questions.filter((q) => missedSet.has(q.id))

  const categoryMap = new Map()

  for (const question of missedQuestions) {
    if (!categoryMap.has(question.category)) {
      categoryMap.set(question.category, [])
    }
    categoryMap.get(question.category).push({
      id: question.id,
      interviewAnswer: question.interviewAnswer,
      prompt: question.prompt
    })
  }

  return [...categoryMap.entries()]
    .map(([category, items]) => ({
      category,
      items,
      misses: items.length
    }))
    .sort((a, b) => b.misses - a.misses)
}

import { describe, expect, it } from 'vitest'

import type { QuizQuestion } from '../../../static/scripts/quiz-content.js'
import {
  applyAttempt,
  createInitialProgress,
  evaluateQuestion,
  getRetryQueue,
  summarizeWeakTopics
} from '../../../static/scripts/quiz-engine.js'

const singleQuestion: QuizQuestion = {
  id: 'api-protected-routes',
  category: 'api',
  kind: 'single',
  prompt: 'Why are /api/* routes protected?',
  options: [
    { id: 'a', label: 'Browsers cannot send headers' },
    { id: 'b', label: 'Quiz is public, API is programmatic' },
    { id: 'c', label: 'Fastify only supports auth under /api' }
  ],
  correctOptionIds: ['b'],
  explanation: 'The API needs protection.',
  interviewAnswer: 'API is protected, quiz is public.',
  deeperFollowUp: 'Add separate auth if quiz becomes dynamic.'
}

const multiQuestion: QuizQuestion = {
  id: 'api-status-codes',
  category: 'api',
  kind: 'multi',
  prompt: 'Which status codes does the API return?',
  options: [
    { id: 'a', label: '400' },
    { id: 'b', label: '401' },
    { id: 'c', label: '404' },
    { id: 'd', label: '500 for all' }
  ],
  correctOptionIds: ['a', 'b', 'c'],
  explanation: 'Uses 400, 401, 404.',
  interviewAnswer: '400 bad input, 401 no key, 404 missing.',
  deeperFollowUp: 'Precise status codes are self-documenting.'
}

const orderQuestion: QuizQuestion = {
  id: 'scanner-flow-order',
  category: 'scanner',
  kind: 'order',
  prompt: 'Order the scanner steps.',
  options: [
    { id: 'a', label: 'Tick fires' },
    { id: 'b', label: 'List repos' },
    { id: 'c', label: 'Fetch release' },
    { id: 'd', label: 'Compare tags' }
  ],
  correctOptionIds: ['a', 'b', 'c', 'd'],
  explanation: 'Follows a strict sequence.',
  interviewAnswer: 'Tick, list, fetch, compare.',
  deeperFollowUp: 'Each step can fail independently.'
}

const bossQuestion: QuizQuestion = {
  id: 'arch-monolith-vs-micro',
  category: 'architecture',
  kind: 'boss',
  prompt: 'Why not microservices?',
  options: [
    { id: 'a', label: 'Scope does not justify distributed overhead' },
    { id: 'b', label: 'Monoliths are always better' },
    { id: 'c', label: 'No time for Kubernetes' }
  ],
  correctOptionIds: ['a'],
  explanation: 'Monolith fits this scope.',
  interviewAnswer: 'Scope does not justify microservices.',
  deeperFollowUp: 'Microservices would add overhead.'
}

describe('quiz engine', () => {
  describe('evaluateQuestion', () => {
    it('evaluates single-choice questions', () => {
      expect(evaluateQuestion(singleQuestion, ['b']).isCorrect).toBe(true)
      expect(evaluateQuestion(singleQuestion, ['a']).isCorrect).toBe(false)
    })

    it('evaluates multi-choice questions regardless of selection order', () => {
      expect(evaluateQuestion(multiQuestion, ['c', 'a', 'b']).isCorrect).toBe(true)
      expect(evaluateQuestion(multiQuestion, ['a', 'b']).isCorrect).toBe(false)
      expect(evaluateQuestion(multiQuestion, ['a', 'b', 'c', 'd']).isCorrect).toBe(false)
    })

    it('evaluates order questions by exact sequence', () => {
      expect(evaluateQuestion(orderQuestion, ['a', 'b', 'c', 'd']).isCorrect).toBe(true)
      expect(evaluateQuestion(orderQuestion, ['b', 'a', 'c', 'd']).isCorrect).toBe(false)
    })

    it('evaluates boss questions like single-choice', () => {
      expect(evaluateQuestion(bossQuestion, ['a']).isCorrect).toBe(true)
      expect(evaluateQuestion(bossQuestion, ['b']).isCorrect).toBe(false)
    })

    it('returns the correct option ids', () => {
      const result = evaluateQuestion(multiQuestion, ['a'])
      expect(result.correctOptionIds).toEqual(['a', 'b', 'c'])
    })
  })

  describe('createInitialProgress', () => {
    it('creates initial progress with zeroed counters', () => {
      const progress = createInitialProgress([singleQuestion, multiQuestion])
      expect(progress.score).toBe(0)
      expect(progress.streak).toBe(0)
      expect(progress.currentIndex).toBe(0)
      expect(progress.answeredQuestionIds).toEqual([])
      expect(progress.correctQuestionIds).toEqual([])
      expect(progress.missedQuestionIds).toEqual([])
    })
  })

  describe('applyAttempt', () => {
    it('increments score and streak on correct first attempt', () => {
      const progress = createInitialProgress([singleQuestion])
      const result = applyAttempt(progress, singleQuestion, ['b'])

      expect(result.result.isCorrect).toBe(true)
      expect(result.result.shouldRetry).toBe(false)
      expect(result.progress.score).toBe(10)
      expect(result.progress.streak).toBe(1)
      expect(result.progress.correctQuestionIds).toEqual(['api-protected-routes'])
      expect(result.progress.missedQuestionIds).toEqual([])
    })

    it('records a miss on wrong first attempt and offers retry', () => {
      const progress = createInitialProgress([singleQuestion])
      const result = applyAttempt(progress, singleQuestion, ['a'])

      expect(result.result.isCorrect).toBe(false)
      expect(result.result.shouldRetry).toBe(true)
      expect(result.progress.streak).toBe(0)
      expect(result.progress.missedQuestionIds).toEqual(['api-protected-routes'])
      expect(result.progress.correctQuestionIds).toEqual([])
      expect(result.progress.score).toBe(0)
    })

    it('keeps the miss after retry success and does not add more score', () => {
      const progress = createInitialProgress([singleQuestion])
      const afterMiss = applyAttempt(progress, singleQuestion, ['a'])
      const afterRetry = applyAttempt(afterMiss.progress, singleQuestion, ['b'])

      expect(afterRetry.result.isCorrect).toBe(true)
      expect(afterRetry.result.shouldRetry).toBe(false)
      expect(afterRetry.progress.missedQuestionIds).toEqual(['api-protected-routes'])
      expect(afterRetry.progress.correctQuestionIds).toEqual(['api-protected-routes'])
      expect(afterRetry.progress.streak).toBe(0)
      expect(afterRetry.progress.score).toBe(0)
    })

    it('breaks an existing streak on first wrong attempt', () => {
      let progress = createInitialProgress([singleQuestion, multiQuestion])
      progress = applyAttempt(progress, singleQuestion, ['b']).progress
      expect(progress.streak).toBe(1)

      const afterMiss = applyAttempt(progress, multiQuestion, ['a'])
      expect(afterMiss.progress.streak).toBe(0)
    })
  })

  describe('getRetryQueue', () => {
    it('returns only missed questions', () => {
      const questions = [singleQuestion, multiQuestion, orderQuestion]
      const queue = getRetryQueue(questions, ['api-status-codes'])
      expect(queue).toHaveLength(1)
      expect(queue[0].id).toBe('api-status-codes')
    })

    it('returns an empty array when nothing was missed', () => {
      expect(getRetryQueue([singleQuestion], [])).toEqual([])
    })
  })

  describe('summarizeWeakTopics', () => {
    it('groups missed questions by category and includes interview answers', () => {
      const questions = [singleQuestion, multiQuestion, orderQuestion]
      const summary = summarizeWeakTopics(questions, ['api-protected-routes', 'api-status-codes', 'scanner-flow-order'])

      expect(summary).toHaveLength(2)
      expect(summary[0]).toMatchObject({ category: 'api', misses: 2 })
      expect(summary[1]).toMatchObject({ category: 'scanner', misses: 1 })
      expect(summary[0].items[0]).toMatchObject({
        id: 'api-protected-routes',
        interviewAnswer: singleQuestion.interviewAnswer
      })
    })

    it('returns empty array with no misses', () => {
      expect(summarizeWeakTopics([singleQuestion], [])).toEqual([])
    })
  })
})

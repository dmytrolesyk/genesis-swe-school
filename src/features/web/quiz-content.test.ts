import { describe, expect, it } from 'vitest'

import {
  quizAchievements,
  quizDiagrams,
  quizQuestions
} from '../../../static/scripts/quiz-content.js'

describe('quiz content', () => {
  it('covers the planned interview-prep scope', () => {
    expect(quizQuestions).toHaveLength(30)
    expect(quizDiagrams).toHaveLength(4)
    expect(quizAchievements.length).toBeGreaterThanOrEqual(3)
  })

  it('uses unique question ids and required question kinds', () => {
    expect(new Set(quizQuestions.map((question) => question.id)).size).toBe(quizQuestions.length)
    expect(new Set(quizQuestions.map((question) => question.kind))).toEqual(
      new Set(['single', 'multi', 'order', 'boss'])
    )
  })

  it('matches the category distribution from the spec', () => {
    const counts = Object.fromEntries(
      quizQuestions.reduce<Map<string, number>>((map, question) => {
        map.set(question.category, (map.get(question.category) ?? 0) + 1)
        return map
      }, new Map<string, number>())
    )

    expect(counts).toEqual({
      api: 6,
      architecture: 2,
      database: 6,
      deployment: 4,
      scanner: 5,
      security: 4,
      testing: 3
    })
  })

  it('requires explanation, interviewAnswer, and deeperFollowUp on every question', () => {
    quizQuestions.forEach((question) => {
      expect(question.explanation, `${question.id} missing explanation`).toBeTruthy()
      expect(question.interviewAnswer, `${question.id} missing interviewAnswer`).toBeTruthy()
      expect(question.deeperFollowUp, `${question.id} missing deeperFollowUp`).toBeTruthy()
    })
  })

  it('only references declared diagrams and achievements', () => {
    const diagramIds = new Set(quizDiagrams.map((diagram) => diagram.id))
    const achievementIds = new Set(quizAchievements.map((achievement) => achievement.id))

    quizQuestions.forEach((question) => {
      if (question.diagramId !== undefined) {
        expect(diagramIds.has(question.diagramId), `${question.id} references unknown diagram ${question.diagramId}`).toBe(true)
      }

      if (question.achievementId !== undefined) {
        expect(achievementIds.has(question.achievementId), `${question.id} references unknown achievement ${question.achievementId}`).toBe(true)
      }
    })
  })
})

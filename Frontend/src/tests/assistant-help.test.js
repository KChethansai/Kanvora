// Keyless help is deterministic, honest, and limited to verified content.
import { describe, expect, it } from 'vitest'
import {
  answerQuestion,
  ASSISTANT_ROUTES,
  helpModeNotice,
  matchHelpArticle,
  suggestedQuestions
} from '../utils/assistantHelp'

describe('deterministic assistant help', () => {
  it('answers every suggested question from a real help article', () => {
    const expected = {
      'How do I create a workspace?': 'create-workspace',
      'How do I invite a teammate?': 'invite-members',
      'How do I add a list or a card?': 'lists-and-cards',
      'How do roles and permissions work?': 'roles-and-access',
      'Where do I change my profile?': 'profile',
      'What are templates?': 'templates'
    }
    for (const question of suggestedQuestions) {
      expect(matchHelpArticle(question)?.id).toBe(expected[question])
      const answer = answerQuestion(question)
      expect(answer.reply).toContain(helpModeNotice)
      expect(answer.reply.length).toBeGreaterThan(40)
    }
  })

  it('answers a workspace question with the verified steps', () => {
    const answer = answerQuestion('How do I create a workspace?')
    expect(answer.reply).toMatch(/Create workspace/i)
    expect(answer.reply).toMatch(/sidebar/i)
    expect(answer.routes.map((route) => route.to)).toContain('/main-page')
  })

  it('offers only allowlisted destinations', () => {
    const questions = [...suggestedQuestions, 'restore an archived board', 'upload an attachment', 'change the theme']
    for (const question of questions) {
      const answer = answerQuestion(question)
      for (const route of answer.routes) expect(ASSISTANT_ROUTES).toContain(route.to)
    }
  })

  it('does not invent an answer to an unknown question', () => {
    const answer = answerQuestion('What is the airspeed of a swallow?')
    expect(answer.reply).toMatch(/can explain how Kanvora works/i)
    expect(answer.reply).not.toMatch(/I (found|checked|see) your/i)
    expect(answer.routes).toEqual(['/help'])
  })

  it('refuses to fabricate a project summary without a provider', () => {
    for (const question of ['Summarize this project', 'Which tasks are due this week?', 'How many cards are overdue?']) {
      const answer = answerQuestion(question)
      expect(answer.reply).toMatch(/needs AI answers to be configured/i)
      expect(answer.reply).not.toMatch(/your project has|there are \d+ (tasks|cards)/i)
    }
  })

  it('is stable for the same question', () => {
    const first = answerQuestion('How do roles and permissions work?')
    const second = answerQuestion('How do roles and permissions work?')
    expect(first).toEqual(second)
  })
})

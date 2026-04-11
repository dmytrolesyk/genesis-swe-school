import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMailer } from './mailer.ts'

type ResendSendPayload = {
  from: string
  subject: string
  text: string
  to: string[]
}

type ResendSendOptions = {
  idempotencyKey: string
}

type ResendSendResult = {
  data: {
    id: string
  } | null
  error: {
    message: string
  } | null
}

type ResendSend = (
  payload: ResendSendPayload,
  options: ResendSendOptions
) => Promise<ResendSendResult>

type SmtpMailPayload = {
  from: string
  subject: string
  text: string
  to: string
}

type SmtpSendMail = (payload: SmtpMailPayload) => Promise<{
  messageId: string
}>

const nodemailerMock = vi.hoisted(() => {
  return {
    createTransport: vi.fn(),
    sendMail: vi.fn<SmtpSendMail>()
  }
})

vi.mock('nodemailer', () => {
  return {
    default: {
      createTransport: nodemailerMock.createTransport
    }
  }
})

describe('createMailer', () => {
  beforeEach(() => {
    nodemailerMock.sendMail.mockResolvedValue({ messageId: 'smtp-message-id' })
    nodemailerMock.createTransport.mockReturnValue({
      sendMail: nodemailerMock.sendMail
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends confirmation emails through the Resend API for Resend production config', async () => {
    const send = vi.fn<ResendSend>(() => Promise.resolve({
      data: {
        id: 'resend-message-id'
      },
      error: null
    }))
    const resendClient = {
      emails: {
        send
      }
    }
    const createResendClient = vi.fn(() => resendClient)
    const mailer = createMailer({
      createResendClient,
      from: 'GitHub Release Notifications <notifications@send.dmytrolesyk.dev>',
      host: 'smtp.resend.com',
      pass: 're_test_key',
      port: 587,
      user: 'resend'
    })

    await mailer.sendConfirmationEmail({
      confirmUrl: 'https://example.com/api/confirm/confirm-token',
      email: 'delivered@resend.dev',
      repoFullName: 'nodejs/node',
      unsubscribeUrl: 'https://example.com/api/unsubscribe/unsubscribe-token'
    })

    expect(createResendClient).toHaveBeenCalledWith('re_test_key')
    expect(nodemailerMock.createTransport).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledTimes(1)

    const resendCall = send.mock.calls[0]
    const [payload, sendOptions] = resendCall

    expect(payload).toMatchObject({
      from: 'GitHub Release Notifications <notifications@send.dmytrolesyk.dev>',
      subject: 'Confirm release notifications for nodejs/node',
      to: ['delivered@resend.dev']
    })
    expect(payload.text).toContain('https://example.com/api/confirm/confirm-token')
    expect(sendOptions.idempotencyKey).toMatch(/^confirmation\/[a-f0-9]{48}$/)
  })

  it('throws when Resend returns an API error', async () => {
    const send = vi.fn<ResendSend>(() => Promise.resolve({
      data: null,
      error: {
        message: 'domain is not verified'
      }
    }))
    const mailer = createMailer({
      createResendClient: () => ({
        emails: {
          send
        }
      }),
      from: 'GitHub Release Notifications <notifications@send.dmytrolesyk.dev>',
      host: 'smtp.resend.com',
      pass: 're_test_key',
      port: 587,
      user: 'resend'
    })

    await expect(mailer.sendReleaseEmail({
      email: 'delivered@resend.dev',
      repoFullName: 'nodejs/node',
      tag: 'v1.0.0',
      unsubscribeUrl: 'https://example.com/api/unsubscribe/unsubscribe-token'
    })).rejects.toThrow('Resend email send failed: domain is not verified')
  })

  it('keeps non-Resend hosts on SMTP transport', async () => {
    const mailer = createMailer({
      from: 'noreply@example.com',
      host: 'localhost',
      port: 1025
    })

    await mailer.sendReleaseEmail({
      email: 'user@example.com',
      repoFullName: 'nodejs/node',
      tag: 'v1.0.0',
      unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/unsubscribe-token'
    })

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
      auth: undefined,
      host: 'localhost',
      port: 1025,
      secure: false
    })
    expect(nodemailerMock.sendMail).toHaveBeenCalledTimes(1)

    const smtpCall = nodemailerMock.sendMail.mock.calls[0]
    const [mailPayload] = smtpCall

    expect(mailPayload).toMatchObject({
      from: 'noreply@example.com',
      subject: 'New release detected for nodejs/node',
      to: 'user@example.com'
    })
    expect(mailPayload.text).toContain('v1.0.0')
  })
})

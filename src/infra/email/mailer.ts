import { createHash } from 'node:crypto'

import nodemailer, {
  type Transporter
} from 'nodemailer'
import { Resend } from 'resend'

import {
  createConfirmationEmailContent,
  createReleaseEmailContent
} from './templates.ts'

export type ConfirmationEmail = {
  confirmUrl: string
  email: string
  repoFullName: string
  unsubscribeUrl: string
}

export type ReleaseEmail = {
  email: string
  repoFullName: string
  tag: string
  unsubscribeUrl: string
}

export type Mailer = {
  sendConfirmationEmail: (input: ConfirmationEmail) => Promise<void>
  sendReleaseEmail: (input: ReleaseEmail) => Promise<void>
}

type MailTransportOptions = {
  from: string
  host: string
  pass?: string
  port: number
  user?: string
}

type SmtpTransporter = Pick<Transporter, 'sendMail'>

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

type ResendEmailClient = {
  emails: {
    send: (
      payload: ResendSendPayload,
      options: ResendSendOptions
    ) => Promise<ResendSendResult>
  }
}

type CreateMailerOptions = {
  createResendClient?: (apiKey: string) => ResendEmailClient
  createTransporter?: (options: MailTransportOptions) => SmtpTransporter
  from: string
  host: string
  pass?: string
  port: number
  user?: string
}

function createSmtpTransporter (options: MailTransportOptions): SmtpTransporter {
  return nodemailer.createTransport({
    auth: options.user !== undefined && options.user !== ''
      ? {
          pass: options.pass ?? '',
          user: options.user
        }
      : undefined,
    host: options.host,
    port: options.port,
    secure: false
  })
}

function createDefaultResendClient (apiKey: string): ResendEmailClient {
  return new Resend(apiKey)
}

function shouldUseResendApi (options: MailTransportOptions): boolean {
  return options.host === 'smtp.resend.com' && options.user === 'resend'
}

function getRequiredResendApiKey (options: MailTransportOptions): string {
  const apiKey = options.pass?.trim()

  if (apiKey === undefined || apiKey === '') {
    throw new Error('SMTP_PASS must be set when SMTP_HOST is smtp.resend.com')
  }

  return apiKey
}

function createIdempotencyKey (eventName: string, parts: string[]): string {
  const hash = createHash('sha256')
    .update(parts.join('\0'))
    .digest('hex')
    .slice(0, 48)

  return `${eventName}/${hash}`
}

async function sendResendEmail (
  client: ResendEmailClient,
  payload: ResendSendPayload,
  idempotencyKey: string
): Promise<void> {
  const result = await client.emails.send(payload, {
    idempotencyKey
  })

  if (result.error !== null) {
    throw new Error(`Resend email send failed: ${result.error.message}`)
  }

  if (result.data === null) {
    throw new Error('Resend email send failed without a message id')
  }
}

function createResendApiMailer (options: CreateMailerOptions): Mailer {
  const apiKey = getRequiredResendApiKey(options)
  const client = (options.createResendClient ?? createDefaultResendClient)(apiKey)

  return {
    async sendConfirmationEmail (input) {
      const content = createConfirmationEmailContent(input)

      await sendResendEmail(client, {
        from: options.from,
        subject: content.subject,
        text: content.text,
        to: [input.email]
      }, createIdempotencyKey('confirmation', [
        input.email,
        input.repoFullName,
        input.confirmUrl
      ]))
    },
    async sendReleaseEmail (input) {
      const content = createReleaseEmailContent(input)

      await sendResendEmail(client, {
        from: options.from,
        subject: content.subject,
        text: content.text,
        to: [input.email]
      }, createIdempotencyKey('release', [
        input.email,
        input.repoFullName,
        input.tag
      ]))
    }
  }
}

function createSmtpMailer (options: CreateMailerOptions): Mailer {
  const transporter = (options.createTransporter ?? createSmtpTransporter)(options)

  return {
    async sendConfirmationEmail (input) {
      const content = createConfirmationEmailContent(input)

      await transporter.sendMail({
        from: options.from,
        subject: content.subject,
        text: content.text,
        to: input.email
      })
    },
    async sendReleaseEmail (input) {
      const content = createReleaseEmailContent(input)

      await transporter.sendMail({
        from: options.from,
        subject: content.subject,
        text: content.text,
        to: input.email
      })
    }
  }
}

export function createMailer (options: CreateMailerOptions): Mailer {
  if (shouldUseResendApi(options)) {
    return createResendApiMailer(options)
  }

  return createSmtpMailer(options)
}

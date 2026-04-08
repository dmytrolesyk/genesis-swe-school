import nodemailer, {
  type Transporter
} from 'nodemailer'

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

type CreateMailerOptions = {
  from: string
  host: string
  pass?: string
  port: number
  user?: string
}

function createTransporter (options: CreateMailerOptions): Transporter {
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

export function createMailer (options: CreateMailerOptions): Mailer {
  const transporter = createTransporter(options)

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

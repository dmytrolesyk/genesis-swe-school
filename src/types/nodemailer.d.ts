declare module 'nodemailer' {
  export type SentMessageInfo = {
    messageId?: string
  }

  export type SendMailOptions = {
    from: string
    subject: string
    text: string
    to: string
  }

  export type TransportOptions = {
    auth?: {
      pass: string
      user: string
    }
    host: string
    port: number
    secure: boolean
  }

  export interface Transporter {
    sendMail: (mailOptions: SendMailOptions) => Promise<SentMessageInfo>
  }

  const nodemailer: {
    createTransport: (options: TransportOptions) => Transporter
  }

  export default nodemailer
}

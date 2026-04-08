type ConfirmationEmailInput = {
  confirmUrl: string
  repoFullName: string
  unsubscribeUrl: string
}

type ReleaseEmailInput = {
  repoFullName: string
  tag: string
  unsubscribeUrl: string
}

export function createConfirmationEmailContent (
  input: ConfirmationEmailInput
) {
  return {
    subject: `Confirm release notifications for ${input.repoFullName}`,
    text: [
      `Confirm your subscription for ${input.repoFullName}:`,
      input.confirmUrl,
      '',
      'If you did not request this subscription, you can unsubscribe here:',
      input.unsubscribeUrl
    ].join('\n')
  }
}

export function createReleaseEmailContent (input: ReleaseEmailInput) {
  return {
    subject: `New release detected for ${input.repoFullName}`,
    text: [
      `A new release is available for ${input.repoFullName}: ${input.tag}`,
      '',
      'Unsubscribe:',
      input.unsubscribeUrl
    ].join('\n')
  }
}

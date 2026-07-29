'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/Button'

export function SubmitButton(props: Omit<React.ComponentProps<typeof Button>, 'type' | 'loading'>) {
  const { pending } = useFormStatus()
  return <Button type="submit" loading={pending} {...props} />
}

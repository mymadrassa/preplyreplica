'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Send } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/Avatar'
import { LoadingBlock } from '@/components/LoadingBlock'

interface Message {
  id: string
  sender_id: string
  body: string
  created_at: string
}

/**
 * Where the messages live: a student–teacher conversation, or a user's
 * thread with the team ("Admin"). In a team thread every admin writes on the
 * same side, so `viewer` says which side the current user is on.
 */
export type ChatTarget =
  | { kind: 'conversation'; id: string }
  | { kind: 'support'; id: string; threadUserId: string; viewer: 'user' | 'admin' }

export function ChatThread({
  target,
  currentUserId,
  otherPartyName,
  headerLink,
}: {
  target: ChatTarget
  currentUserId: string
  otherPartyName: string
  /** A button at the right of the header, e.g. to the teacher's profile. */
  headerLink?: { href: string; label: string }
}) {
  const column = target.kind === 'conversation' ? 'conversation_id' : 'support_thread_id'
  const targetId = target.id
  const isMine = (senderId: string) =>
    target.kind === 'support' && target.viewer === 'admin' ? senderId !== target.threadUserId : senderId === currentUserId
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    let isMounted = true

    supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .eq(column, targetId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (isMounted) setMessages(data ?? [])
        setLoading(false)
      })

    // First use of Supabase Realtime in this codebase -- a postgres_changes
    // subscription scoped to this one conversation's new rows. The sender
    // also receives their own insert through this channel, so no local
    // optimistic append is needed.
    const channel = supabase
      .channel(`${column}:${targetId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `${column}=eq.${targetId}` },
        (payload) => {
          const next = payload.new as Message
          setMessages((prev) => (prev.some((m) => m.id === next.id) ? prev : [...prev, next]))
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [column, targetId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(event: React.FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    const channelField = target.kind === 'conversation' ? { conversation_id: targetId } : { support_thread_id: targetId }
    const { error } = await supabase.from('messages').insert({ ...channelField, sender_id: currentUserId, body })
    setSending(false)
    if (!error) setDraft('')
  }

  return (
    <div className="flex h-[32rem] flex-col rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <p className="min-w-0 truncate font-semibold text-slate-900">{otherPartyName}</p>
        {headerLink ? (
          <Link
            href={headerLink.href}
            className="flex-shrink-0 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-800 shadow-md transition-shadow hover:shadow-lg"
          >
            {headerLink.label}
          </Link>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <LoadingBlock label="Loading conversation…" />
        ) : messages.length ? (
          messages.map((message) => {
            const mine = isMine(message.sender_id)
            return (
              <div key={message.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                {!mine ? <Avatar name={otherPartyName} size="sm" /> : null}
                <div
                  className={`max-w-[75%] whitespace-pre-line rounded-2xl px-4 py-2 text-sm ${
                    mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {message.body}
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-sm text-slate-500">No messages yet — say hello!</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-slate-200 p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSend(event)
            }
          }}
          rows={1}
          placeholder="Write a message…"
          className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="Send message"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}

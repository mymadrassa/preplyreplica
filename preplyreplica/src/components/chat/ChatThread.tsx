'use client'

import { useEffect, useRef, useState } from 'react'
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

export function ChatThread({
  conversationId,
  currentUserId,
  otherPartyName,
}: {
  conversationId: string
  currentUserId: string
  otherPartyName: string
}) {
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
      .eq('conversation_id', conversationId)
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
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
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
  }, [conversationId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(event: React.FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: currentUserId, body })
    setSending(false)
    if (!error) setDraft('')
  }

  return (
    <div className="flex h-[32rem] flex-col rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="font-semibold text-slate-900">{otherPartyName}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <LoadingBlock label="Loading conversation…" />
        ) : messages.length ? (
          messages.map((message) => {
            const isMine = message.sender_id === currentUserId
            return (
              <div key={message.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine ? <Avatar name={otherPartyName} size="sm" /> : null}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    isMine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-900'
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

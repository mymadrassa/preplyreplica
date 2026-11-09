// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/types/database.ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

/** Why a lesson was reported (see migration 0042). */
export type ReportReason = 'no_show' | 'technical' | 'cut_short' | 'other'
export type ReportResolution = 'pay_teacher' | 'refund_student' | 'refund_partial'
/** Where a lesson's teacher payout stands: not yet due, held by a report, payable (trial: next daily run; others: the 3rd), paid, or refunded instead. */
/** Where a payment was charged: the teacher's Stripe account (until migration 0044) or My Madrassa's. */
export type ChargeModel = 'direct' | 'platform'
export type PayoutState = 'none' | 'held' | 'scheduled' | 'paid' | 'refunded'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          username: string | null
          role: 'student' | 'teacher' | 'admin'
          avatar_url: string | null
          phone: string | null
          gender: 'male' | 'female' | null
          pending_processing_fees: number
          created_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          full_name?: string | null
          username?: string | null
          role?: 'student' | 'teacher' | 'admin'
          avatar_url?: string | null
          phone?: string | null
          gender?: 'male' | 'female' | null
          pending_processing_fees?: number
          created_at?: string
        }
        Update: {
          email?: string | null
          full_name?: string | null
          username?: string | null
          role?: 'student' | 'teacher' | 'admin'
          avatar_url?: string | null
          phone?: string | null
          gender?: 'male' | 'female' | null
          pending_processing_fees?: number
          created_at?: string
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          id: string
          // Leftover from a pre-0001 legacy schema that keyed this table by
          // user_id instead of id -- 0001_init.sql's `create table if not
          // exists` silently skipped this already-existing table, so the
          // column (NOT NULL, no default) is still live today. Always equal
          // to `id` in practice; every insert must set it explicitly.
          user_id: string
          headline: string | null
          bio: string | null
          languages: string[]
          subjects: string[]
          hourly_rate: number
          video_url: string | null
          payout_account_id: string | null
          payment_provider: string
          tier: 'starter' | 'mid' | 'top'
          tier_locked: boolean
          tier_updated_at: string | null
          approved_at: string | null
          review_note: string | null
          reviewed_at: string | null
          payments_enabled: boolean
          payouts_enabled: boolean
          status: 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'
          rating_avg: number
          rating_count: number
          approval_seen_at: string | null
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          headline?: string | null
          bio?: string | null
          languages?: string[]
          subjects?: string[]
          hourly_rate?: number
          video_url?: string | null
          payout_account_id?: string | null
          payment_provider?: string
          tier?: 'starter' | 'mid' | 'top'
          tier_locked?: boolean
          tier_updated_at?: string | null
          approved_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          payments_enabled?: boolean
          payouts_enabled?: boolean
          status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'
          rating_avg?: number
          rating_count?: number
          approval_seen_at?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          headline?: string | null
          bio?: string | null
          languages?: string[]
          subjects?: string[]
          hourly_rate?: number
          video_url?: string | null
          payout_account_id?: string | null
          payment_provider?: string
          tier?: 'starter' | 'mid' | 'top'
          tier_locked?: boolean
          tier_updated_at?: string | null
          approved_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          payments_enabled?: boolean
          payouts_enabled?: boolean
          status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'
          rating_avg?: number
          rating_count?: number
          approval_seen_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      lesson_packages: {
        Row: {
          id: string
          student_id: string
          teacher_id: string
          lessons_total: number
          lessons_used: number
          price: number
          teacher_fee_per_lesson: number
          refund_per_lesson: number
          refunded_amount: number
          tier: 'starter' | 'mid' | 'top'
          provider: string
          provider_checkout_id: string | null
          provider_payment_id: string | null
          status: 'pending_payment' | 'active' | 'used_up' | 'expired' | 'cancelled'
          expires_at: string | null
          charge_model: ChargeModel
          processing_fee: number | null
          platform_amount: number | null
          card_country: string | null
          paid_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          teacher_id: string
          lessons_total: number
          lessons_used?: number
          price: number
          teacher_fee_per_lesson: number
          refund_per_lesson: number
          refunded_amount?: number
          tier: 'starter' | 'mid' | 'top'
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          status?: 'pending_payment' | 'active' | 'used_up' | 'expired' | 'cancelled'
          expires_at?: string | null
          charge_model?: ChargeModel
          processing_fee?: number | null
          platform_amount?: number | null
          card_country?: string | null
          paid_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          teacher_id?: string
          lessons_total?: number
          lessons_used?: number
          price?: number
          teacher_fee_per_lesson?: number
          refund_per_lesson?: number
          refunded_amount?: number
          tier?: 'starter' | 'mid' | 'top'
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          status?: 'pending_payment' | 'active' | 'used_up' | 'expired' | 'cancelled'
          expires_at?: string | null
          charge_model?: ChargeModel
          processing_fee?: number | null
          platform_amount?: number | null
          card_country?: string | null
          paid_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lesson_packages_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lesson_packages_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      session_feedback: {
        Row: {
          id: string
          booking_id: string
          author_id: string
          recipient_id: string
          author_role: 'student' | 'teacher'
          status: 'given' | 'skipped'
          rating: number | null
          comment: string | null
          visibility: 'public' | 'private' | null
          tags: string[]
          outcome: 'ok' | 'reported'
          criteria: Record<string, number>
          report_reason: ReportReason | null
          report_detail: string | null
          recipient_seen_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          author_id: string
          recipient_id: string
          author_role: 'student' | 'teacher'
          status: 'given' | 'skipped'
          rating?: number | null
          comment?: string | null
          visibility?: 'public' | 'private' | null
          tags?: string[]
          outcome?: 'ok' | 'reported'
          criteria?: Record<string, number>
          report_reason?: ReportReason | null
          report_detail?: string | null
          recipient_seen_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          author_id?: string
          recipient_id?: string
          author_role?: 'student' | 'teacher'
          status?: 'given' | 'skipped'
          rating?: number | null
          comment?: string | null
          visibility?: 'public' | 'private' | null
          tags?: string[]
          outcome?: 'ok' | 'reported'
          criteria?: Record<string, number>
          report_reason?: ReportReason | null
          report_detail?: string | null
          recipient_seen_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_feedback_booking_id_fkey'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_feedback_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_feedback_recipient_id_fkey'
            columns: ['recipient_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      lesson_homework: {
        Row: {
          id: string
          booking_id: string
          teacher_id: string
          student_id: string
          revision_from_surah: number | null
          revision_from_ayah: number | null
          revision_to_surah: number | null
          revision_to_ayah: number | null
          memorization_from_surah: number | null
          memorization_from_ayah: number | null
          memorization_to_surah: number | null
          memorization_to_ayah: number | null
          note: string | null
          sent_channel: 'whatsapp' | 'email' | null
          whatsapp_message_id: string | null
          delivery_status: 'sent' | 'delivered' | 'read' | 'failed' | null
          last_error: string | null
          sent_at: string | null
          student_seen_at: string | null
          done_at: string | null
          teacher_seen_done_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          teacher_id: string
          student_id: string
          revision_from_surah?: number | null
          revision_from_ayah?: number | null
          revision_to_surah?: number | null
          revision_to_ayah?: number | null
          memorization_from_surah?: number | null
          memorization_from_ayah?: number | null
          memorization_to_surah?: number | null
          memorization_to_ayah?: number | null
          note?: string | null
          sent_channel?: 'whatsapp' | 'email' | null
          whatsapp_message_id?: string | null
          delivery_status?: 'sent' | 'delivered' | 'read' | 'failed' | null
          last_error?: string | null
          sent_at?: string | null
          student_seen_at?: string | null
          done_at?: string | null
          teacher_seen_done_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          revision_from_surah?: number | null
          revision_from_ayah?: number | null
          revision_to_surah?: number | null
          revision_to_ayah?: number | null
          memorization_from_surah?: number | null
          memorization_from_ayah?: number | null
          memorization_to_surah?: number | null
          memorization_to_ayah?: number | null
          note?: string | null
          sent_channel?: 'whatsapp' | 'email' | null
          whatsapp_message_id?: string | null
          delivery_status?: 'sent' | 'delivered' | 'read' | 'failed' | null
          last_error?: string | null
          sent_at?: string | null
          student_seen_at?: string | null
          done_at?: string | null
          teacher_seen_done_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lesson_homework_booking_id_fkey'
            columns: ['booking_id']
            isOneToOne: true
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lesson_homework_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lesson_homework_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      teacher_profile_changes: {
        Row: {
          teacher_id: string
          headline: string | null
          bio: string | null
          subjects: string[]
          languages: string[]
          video_url: string | null
          avatar_url: string | null
          state: 'draft' | 'submitted'
          review_note: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          teacher_id: string
          headline?: string | null
          bio?: string | null
          subjects?: string[]
          languages?: string[]
          video_url?: string | null
          avatar_url?: string | null
          state?: 'draft' | 'submitted'
          review_note?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          headline?: string | null
          bio?: string | null
          subjects?: string[]
          languages?: string[]
          video_url?: string | null
          avatar_url?: string | null
          state?: 'draft' | 'submitted'
          review_note?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_profile_changes_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: true
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      teacher_documents: {
        Row: {
          id: string
          teacher_id: string
          bucket_path: string
          kind: 'identity' | 'certificate'
          review_change: 'add' | 'remove' | null
          scan_status: 'clean' | 'suspicious' | null
          scan_detail: string | null
          scanned_at: string | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          bucket_path: string
          kind?: 'identity' | 'certificate'
          review_change?: 'add' | 'remove' | null
          scan_status?: 'clean' | 'suspicious' | null
          scan_detail?: string | null
          scanned_at?: string | null
          uploaded_at?: string
        }
        Update: {
          teacher_id?: string
          bucket_path?: string
          kind?: 'identity' | 'certificate'
          review_change?: 'add' | 'remove' | null
          scan_status?: 'clean' | 'suspicious' | null
          scan_detail?: string | null
          scanned_at?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_documents_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      availability_slots: {
        Row: {
          id: string
          teacher_id: string
          weekday: number
          start_time: string
          end_time: string
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          weekday: number
          start_time: string
          end_time: string
          created_at?: string
        }
        Update: {
          teacher_id?: string
          weekday?: number
          start_time?: string
          end_time?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'availability_slots_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      availability_exceptions: {
        Row: {
          id: string
          teacher_id: string
          exception_date: string
          start_time: string | null
          end_time: string | null
          kind: 'available' | 'busy' | 'vacation'
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          exception_date: string
          start_time?: string | null
          end_time?: string | null
          kind: 'available' | 'busy' | 'vacation'
          created_at?: string
        }
        Update: {
          teacher_id?: string
          exception_date?: string
          start_time?: string | null
          end_time?: string | null
          kind?: 'available' | 'busy' | 'vacation'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'availability_exceptions_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      bookings: {
        Row: {
          id: string
          student_id: string
          teacher_id: string
          subject: string
          language: string
          subject_id: string | null
          duration: number
          duration_hours: number | null
          start_at: string
          end_at: string
          scheduled_at: string | null
          status: 'pending' | 'pending_payment' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'
          package_id: string | null
          recurrence_group_id: string | null
          recurrence: string | null
          base_amount: number | null
          platform_commission: number | null
          total_student_pays: number | null
          teacher_receives: number | null
          provider_checkout_id: string | null
          reminder_sent_at: string | null
          teacher_confirmed_at: string | null
          admin_confirmed_at: string | null
          student_joined_at: string | null
          student_left_at: string | null
          teacher_joined_at: string | null
          teacher_left_at: string | null
          is_trial: boolean
          payout_state: PayoutState
          payout_amount: number | null
          payout_eligible_at: string | null
          payout_batch_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          teacher_id: string
          subject: string
          language: string
          subject_id?: string | null
          duration: number
          duration_hours?: number | null
          start_at: string
          end_at: string
          scheduled_at?: string | null
          status?: 'pending' | 'pending_payment' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'
          package_id?: string | null
          recurrence_group_id?: string | null
          recurrence?: string | null
          base_amount?: number | null
          platform_commission?: number | null
          total_student_pays?: number | null
          teacher_receives?: number | null
          provider_checkout_id?: string | null
          reminder_sent_at?: string | null
          teacher_confirmed_at?: string | null
          admin_confirmed_at?: string | null
          student_joined_at?: string | null
          student_left_at?: string | null
          teacher_joined_at?: string | null
          teacher_left_at?: string | null
          is_trial?: boolean
          payout_state?: PayoutState
          payout_amount?: number | null
          payout_eligible_at?: string | null
          payout_batch_id?: string | null
          created_at?: string
        }
        Update: {
          student_id?: string
          teacher_id?: string
          subject?: string
          language?: string
          subject_id?: string | null
          duration?: number
          duration_hours?: number | null
          start_at?: string
          end_at?: string
          scheduled_at?: string | null
          status?: 'pending' | 'pending_payment' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'
          package_id?: string | null
          recurrence_group_id?: string | null
          recurrence?: string | null
          base_amount?: number | null
          platform_commission?: number | null
          total_student_pays?: number | null
          teacher_receives?: number | null
          provider_checkout_id?: string | null
          reminder_sent_at?: string | null
          teacher_confirmed_at?: string | null
          admin_confirmed_at?: string | null
          student_joined_at?: string | null
          student_left_at?: string | null
          teacher_joined_at?: string | null
          teacher_left_at?: string | null
          is_trial?: boolean
          payout_state?: PayoutState
          payout_amount?: number | null
          payout_eligible_at?: string | null
          payout_batch_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bookings_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      payments: {
        Row: {
          id: string
          booking_id: string
          provider_payment_id: string | null
          provider: string
          provider_checkout_id: string | null
          amount: number
          currency: string
          platform_fee: number
          teacher_fee: number
          processing_fee_estimate: number
          pending_fees_billed: number
          payout_at: string | null
          charge_model: ChargeModel
          processing_fee: number | null
          platform_amount: number | null
          card_country: string | null
          paid_at: string | null
          refunded_amount: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          provider_payment_id?: string | null
          provider?: string
          provider_checkout_id?: string | null
          amount: number
          currency?: string
          platform_fee: number
          teacher_fee: number
          processing_fee_estimate?: number
          pending_fees_billed?: number
          payout_at?: string | null
          charge_model?: ChargeModel
          processing_fee?: number | null
          platform_amount?: number | null
          card_country?: string | null
          paid_at?: string | null
          refunded_amount?: number
          status?: string
          created_at?: string
        }
        Update: {
          booking_id?: string
          provider_payment_id?: string | null
          provider?: string
          provider_checkout_id?: string | null
          amount?: number
          currency?: string
          platform_fee?: number
          teacher_fee?: number
          processing_fee_estimate?: number
          pending_fees_billed?: number
          payout_at?: string | null
          charge_model?: ChargeModel
          processing_fee?: number | null
          platform_amount?: number | null
          card_country?: string | null
          paid_at?: string | null
          refunded_amount?: number
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_booking_id_fkey'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          }
        ]
      }
      reviews: {
        Row: {
          id: string
          booking_id: string
          student_id: string
          teacher_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          student_id: string
          teacher_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          booking_id?: string
          student_id?: string
          teacher_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reviews_booking_id_fkey'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      student_preferences: {
        Row: {
          id: string
          courses: string[]
          immediate_availability: 'now' | 'this_week' | 'flexible'
          weekly_slots: Json
          lessons_per_week: number
          monthly_package_size: number
          selected_teacher_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          courses?: string[]
          immediate_availability: 'now' | 'this_week' | 'flexible'
          weekly_slots?: Json
          lessons_per_week: number
          monthly_package_size: number
          selected_teacher_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          courses?: string[]
          immediate_availability?: 'now' | 'this_week' | 'flexible'
          weekly_slots?: Json
          lessons_per_week?: number
          monthly_package_size?: number
          selected_teacher_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'student_preferences_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_preferences_selected_teacher_id_fkey'
            columns: ['selected_teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      recommendation_events: {
        Row: {
          id: number
          student_id: string | null
          teacher_id: string
          event_type: 'impression' | 'selection'
          score: number | null
          rank: number | null
          created_at: string
        }
        Insert: {
          id?: number
          student_id?: string | null
          teacher_id: string
          event_type: 'impression' | 'selection'
          score?: number | null
          rank?: number | null
          created_at?: string
        }
        Update: {
          student_id?: string | null
          teacher_id?: string
          event_type?: 'impression' | 'selection'
          score?: number | null
          rank?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recommendation_events_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recommendation_events_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      error_logs: {
        Row: {
          id: number
          context: string
          message: string
          detail: string | null
          created_at: string
        }
        Insert: {
          id?: number
          context: string
          message: string
          detail?: string | null
          created_at?: string
        }
        Update: {
          context?: string
          message?: string
          detail?: string | null
          created_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          student_id: string
          teacher_id: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          teacher_id: string
          created_at?: string
        }
        Update: {
          student_id?: string
          teacher_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversations_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      lesson_pages: {
        Row: {
          booking_id: string
          page: number
          first_seen_at: string
        }
        Insert: {
          booking_id: string
          page: number
          first_seen_at?: string
        }
        Update: {
          booking_id?: string
          page?: number
          first_seen_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lesson_pages_booking_id_fkey'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          }
        ]
      }
      lesson_reports: {
        Row: {
          id: string
          booking_id: string
          reported_by: string
          reporter_role: 'student' | 'teacher'
          reason: ReportReason
          detail: string
          status: 'open' | 'resolved'
          resolution: ReportResolution | null
          refund_amount: number | null
          admin_note: string | null
          resolved_by: string | null
          resolved_at: string | null
          reminder_sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          reported_by: string
          reporter_role: 'student' | 'teacher'
          reason: ReportReason
          detail: string
          status?: 'open' | 'resolved'
          resolution?: ReportResolution | null
          refund_amount?: number | null
          admin_note?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          reminder_sent_at?: string | null
          created_at?: string
        }
        Update: {
          status?: 'open' | 'resolved'
          resolution?: ReportResolution | null
          refund_amount?: number | null
          admin_note?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          reminder_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'lesson_reports_booking_id_fkey'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          }
        ]
      }
      teacher_payouts: {
        Row: {
          id: string
          teacher_id: string
          booking_id: string | null
          period: string
          amount: number
          lessons_count: number
          provider: string
          provider_payout_id: string | null
          provider_transfer_id: string | null
          transferred_amount: number
          status: 'pending' | 'paid' | 'failed'
          failure_reason: string | null
          attempts: number
          paid_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          booking_id?: string | null
          period: string
          amount: number
          lessons_count: number
          provider?: string
          provider_payout_id?: string | null
          provider_transfer_id?: string | null
          transferred_amount?: number
          status?: 'pending' | 'paid' | 'failed'
          failure_reason?: string | null
          attempts?: number
          paid_at?: string | null
          created_at?: string
        }
        Update: {
          amount?: number
          lessons_count?: number
          provider_payout_id?: string | null
          provider_transfer_id?: string | null
          transferred_amount?: number
          status?: 'pending' | 'paid' | 'failed'
          failure_reason?: string | null
          attempts?: number
          paid_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_payouts_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'teacher_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      support_threads: {
        Row: {
          id: string
          user_id: string
          user_last_read_at: string | null
          admin_last_read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          user_last_read_at?: string | null
          admin_last_read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          user_last_read_at?: string | null
          admin_last_read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'support_threads_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string | null
          support_thread_id: string | null
          sender_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id?: string | null
          support_thread_id?: string | null
          sender_id: string
          body: string
          created_at?: string
        }
        Update: {
          conversation_id?: string | null
          support_thread_id?: string | null
          sender_id?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {}
    Functions: {
      use_package_lesson: {
        Args: { package: string; delta: number }
        Returns: boolean
      }
    }
    Enums: {}
    CompositeTypes: {}
  }
}

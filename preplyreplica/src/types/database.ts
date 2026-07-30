// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/types/database.ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
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
          pending_stripe_fees: number
          created_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          full_name?: string | null
          username?: string | null
          role?: 'student' | 'teacher' | 'admin'
          avatar_url?: string | null
          pending_stripe_fees?: number
          created_at?: string
        }
        Update: {
          email?: string | null
          full_name?: string | null
          username?: string | null
          role?: 'student' | 'teacher' | 'admin'
          avatar_url?: string | null
          pending_stripe_fees?: number
          created_at?: string
        }
      }
      teacher_profiles: {
        Row: {
          id: string
          headline: string | null
          bio: string | null
          languages: string[]
          subjects: string[]
          hourly_rate: number
          video_url: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_payouts_enabled: boolean
          status: 'pending' | 'approved' | 'rejected' | 'suspended'
          rating_avg: number
          rating_count: number
          updated_at: string
        }
        Insert: {
          id: string
          headline?: string | null
          bio?: string | null
          languages?: string[]
          subjects?: string[]
          hourly_rate?: number
          video_url?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          status?: 'pending' | 'approved' | 'rejected' | 'suspended'
          rating_avg?: number
          rating_count?: number
          updated_at?: string
        }
        Update: {
          headline?: string | null
          bio?: string | null
          languages?: string[]
          subjects?: string[]
          hourly_rate?: number
          video_url?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          status?: 'pending' | 'approved' | 'rejected' | 'suspended'
          rating_avg?: number
          rating_count?: number
          updated_at?: string
        }
      }
      teacher_documents: {
        Row: {
          id: string
          teacher_id: string
          bucket_path: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          bucket_path: string
          uploaded_at?: string
        }
        Update: {
          teacher_id?: string
          bucket_path?: string
          uploaded_at?: string
        }
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
      }
      availability_exceptions: {
        Row: {
          id: string
          teacher_id: string
          exception_date: string
          start_time: string | null
          end_time: string | null
          exception_type: 'blocked' | 'added'
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          exception_date: string
          start_time?: string | null
          end_time?: string | null
          exception_type: 'blocked' | 'added'
          created_at?: string
        }
        Update: {
          teacher_id?: string
          exception_date?: string
          start_time?: string | null
          end_time?: string | null
          exception_type?: 'blocked' | 'added'
          created_at?: string
        }
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
          recurrence_group_id: string | null
          recurrence: string | null
          base_amount: number | null
          platform_commission: number | null
          total_student_pays: number | null
          teacher_receives: number | null
          stripe_checkout_session_id: string | null
          reminder_sent_at: string | null
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
          recurrence_group_id?: string | null
          recurrence?: string | null
          base_amount?: number | null
          platform_commission?: number | null
          total_student_pays?: number | null
          teacher_receives?: number | null
          stripe_checkout_session_id?: string | null
          reminder_sent_at?: string | null
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
          recurrence_group_id?: string | null
          recurrence?: string | null
          base_amount?: number | null
          platform_commission?: number | null
          total_student_pays?: number | null
          teacher_receives?: number | null
          stripe_checkout_session_id?: string | null
          reminder_sent_at?: string | null
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          booking_id: string
          stripe_payment_intent_id: string | null
          stripe_checkout_session_id: string | null
          amount: number
          currency: string
          platform_fee: number
          teacher_fee: number
          stripe_fee_estimate: number
          pending_fees_billed: number
          payout_at: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          stripe_payment_intent_id?: string | null
          stripe_checkout_session_id?: string | null
          amount: number
          currency?: string
          platform_fee: number
          teacher_fee: number
          stripe_fee_estimate?: number
          pending_fees_billed?: number
          payout_at?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          booking_id?: string
          stripe_payment_intent_id?: string | null
          stripe_checkout_session_id?: string | null
          amount?: number
          currency?: string
          platform_fee?: number
          teacher_fee?: number
          stripe_fee_estimate?: number
          pending_fees_billed?: number
          payout_at?: string | null
          status?: string
          created_at?: string
        }
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
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      books: {
        Row: {
          id: string
          user_id: string
          title: string
          author: string
          language: string | null
          source_type: string | null
          cover_url: string | null
          collection_id: string | null
          imported_at: string
          chapter_count: number
          last_read_chapter_id: string | null
          last_opened_at: string | null
          analysis_state: string
          epub_file_path: string | null
        }
        Insert: {
          id: string
          user_id: string
          title: string
          author: string
          language?: string | null
          source_type?: string | null
          cover_url?: string | null
          collection_id?: string | null
          imported_at: string
          chapter_count: number
          last_read_chapter_id?: string | null
          last_opened_at?: string | null
          analysis_state: string
          epub_file_path?: string | null
        }
        Update: Partial<Database['public']['Tables']['books']['Insert']>
        Relationships: []
      }
      chapters: {
        Row: {
          id: string
          user_id: string
          book_id: string
          title: string
          order_index: number
          epub_href: string | null
          original_text: string
          source_text: string
          paragraph_blocks: Json
          sentences: Json
          results: Json
          analysis_state: string
          active_range: Json
          last_read_end: number
          last_opened_at: string | null
          resume_anchor: Json
        }
        Insert: {
          id: string
          user_id: string
          book_id: string
          title: string
          order_index: number
          epub_href?: string | null
          original_text: string
          source_text: string
          paragraph_blocks: Json
          sentences: Json
          results: Json
          analysis_state: string
          active_range?: Json
          last_read_end: number
          last_opened_at?: string | null
          resume_anchor?: Json
        }
        Update: Partial<Database['public']['Tables']['chapters']['Insert']>
        Relationships: []
      }
      collections: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: number
        }
        Insert: {
          id: string
          user_id: string
          name: string
          created_at: number
        }
        Update: Partial<Database['public']['Tables']['collections']['Insert']>
        Relationships: []
      }
      pending_anki_notes: {
        Row: {
          id: string
          user_id: string
          dedupe_key: string
          language: string
          payload: Json
          text: string
          kind: string
          explanation: string
          sentence_id: string
          sentence_text: string
          created_at: string
          imported_at: string | null
          last_error: string | null
          book_id: string | null
          book_title: string | null
          chapter_id: string | null
          chapter_title: string | null
        }
        Insert: {
          id: string
          user_id: string
          dedupe_key: string
          language: string
          payload: Json
          text: string
          kind: string
          explanation: string
          sentence_id: string
          sentence_text: string
          created_at: string
          imported_at?: string | null
          last_error?: string | null
          book_id?: string | null
          book_title?: string | null
          chapter_id?: string | null
          chapter_title?: string | null
        }
        Update: Partial<Database['public']['Tables']['pending_anki_notes']['Insert']>
        Relationships: []
      }
      resources: {
        Row: {
          id: string
          user_id: string
          signature: string
          text: string
          kind: string
          explanation: string
          grammar_text: string
          meaning: string | null
          sentence_id: string
          sentence_text: string
          saved_at: string
          book_id: string | null
          book_title: string | null
          chapter_id: string | null
          chapter_title: string | null
        }
        Insert: {
          id: string
          user_id: string
          signature: string
          text: string
          kind: string
          explanation: string
          grammar_text: string
          meaning?: string | null
          sentence_id: string
          sentence_text: string
          saved_at: string
          book_id?: string | null
          book_title?: string | null
          chapter_id?: string | null
          chapter_title?: string | null
        }
        Update: Partial<Database['public']['Tables']['resources']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}


// Minimal Supabase type helpers.
//
// This project expects `Tables<'table_name'>` in many places.
// The fully generated `Database` type (via `supabase gen types`) can be
// reintroduced later; for now we provide a safe fallback that keeps builds working.

export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

type GenericTable = {
	Row: Record<string, any>;
	Insert: Record<string, any>;
	Update: Record<string, any>;
	Relationships: unknown[];
};

export type Database = {
	public: {
		Tables: Record<string, GenericTable>;
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};

export type Tables<TableName extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][TableName]['Row'];

export type TablesInsert<TableName extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][TableName]['Insert'];

export type TablesUpdate<TableName extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][TableName]['Update'];


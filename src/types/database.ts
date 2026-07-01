export interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  created_at: string;
}

export interface AITool {
  id: string;
  name: string;
  url: string;
  logo_url: string | null;
  category_id: string | null;
  is_bookmarked: boolean;
  sort_order: number;
  created_at: string;
}

export interface QuickUrl {
  id: string;
  title: string;
  url: string;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  display_picture_url: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface ToolUsageLog {
  id: string;
  tool_id: string | null;
  tool_name: string;
  user_id: string | null;
  clicked_at: string;
}

export interface PasswordReset {
  id: string;
  identifier: string;
  otp_code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

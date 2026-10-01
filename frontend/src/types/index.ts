// Mirrors the Pydantic models in backend/app/models. Keeping these in sync by
// hand is the trade-off for not generating a client from the OpenAPI schema.

export interface Onboarding {
  domain_id: string;
  topic_id: string;
  domain_name: string;
  topic_name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  onboarding: Onboarding | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Topic {
  id: string;
  domain_id: string;
  name: string;
  slug: string;
  description: string;
  question_count: number;
}

export interface Domain {
  id: string;
  name: string;
  slug: string;
  description: string;
  topics: Topic[];
}

/** A question as served during an exam — note there is no correct answer here. */
export interface ExamQuestion {
  id: string;
  text: string;
  options: string[];
}

export interface ExamSession {
  id: string;
  domain_id: string;
  topic_id: string;
  domain_name: string;
  topic_name: string;
  status: string;
  started_at: string;
  questions: ExamQuestion[];
}

export interface QuestionResult {
  question_id: string;
  text: string;
  options: string[];
  selected_option: number | null;
  correct_option: number;
  is_correct: boolean;
}

export interface ExamResult {
  id: string;
  domain_name: string;
  topic_name: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  submitted_at: string;
  breakdown: QuestionResult[];
}

export interface ExamSummary {
  id: string;
  domain_name: string;
  topic_name: string;
  status: string;
  score: number | null;
  total: number;
  started_at: string;
  submitted_at: string | null;
}

/** Map of question id -> selected option index. The core of exam state. */
export type AnswerMap = Record<string, number>;

export type RequestStatus = "idle" | "loading" | "succeeded" | "failed";

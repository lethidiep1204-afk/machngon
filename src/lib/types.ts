export type DocumentCategory =
  | 'Ngôn ngữ học'
  | 'Văn học và lý luận văn học'
  | 'Triết học và tư tưởng'
  | 'Logic và lập luận'
  | 'Tư duy phản biện'
  | 'Kiến thức liên ngành'
  // Legacy category strings kept strictly for backward compatibility with stored custom docs
  | 'Ngôn ngữ'
  | 'Ngữ văn'
  | 'Tư duy và lập luận'
  | 'Văn hóa - xã hội'
  | 'Văn hóa – xã hội'
  | 'Lịch sử - Văn hóa'
  | 'Kỹ năng viết'
  | 'Khác';

export type DocumentBlockType =
  | 'prose'
  | 'concept'
  | 'quote'
  | 'counterargument'
  | 'question';

export type DocumentDifficulty = 'intro' | 'explore' | 'advanced';

export type DocumentReviewStatus =
  | 'editing'
  | 'pending_source'
  | 'verified'
  | 'published'
  | 'archived';

export interface ArticleReference {
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  url?: string;
  note?: string;
  verified: boolean;
}

export interface DocumentBlock {
  id: string;
  sectionId: string;
  type: DocumentBlockType;
  label?: string;
  heading?: string;
  content: string;
  citation?: string;
}

export interface DocumentSection {
  id: string;
  title: string;
}

export interface LibraryDocument {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  source: string;
  publishedDate: string;
  readingMinutes: number;
  category: DocumentCategory;
  coverImage: string;
  coverAlt: string;
  excerpt: string;
  keywords: string[];
  sections: DocumentSection[];
  blocks: DocumentBlock[];
  status: 'published' | 'draft';
  // Backward-compatible extensions (Library Expansion)
  difficulty?: DocumentDifficulty;
  tags?: string[];
  featured?: boolean;
  collectionIds?: string[];
  references?: ArticleReference[];
  relatedConceptIds?: string[];
  reviewedAt?: string;
  reviewStatus?: DocumentReviewStatus;
  verified?: boolean;
  contentVersion?: number;
}

export interface LibraryCategoryMeta {
  id: string;
  name: DocumentCategory;
  shortName: string;
  description: string;
  iconKey: 'languages' | 'feather' | 'landmark' | 'scale' | 'compass' | 'layers';
  order: number;
  hidden?: boolean;
}

export interface LibraryCollection {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  coverImage: string;
  coverAlt: string;
  documentIds: string[];
  status: 'published' | 'draft';
  order: number;
}

export interface LibraryConcept {
  id: string;
  term: string;
  englishTerm?: string;
  category: DocumentCategory;
  shortDefinition: string;
  example?: string;
  relatedConceptIds: string[];
  documentIds: string[];
  matchAliases?: string[];
}

export type LabType = 'concept' | 'debate';

export type LabActionIntent =
  | 'explain'
  | 'analyze_concept'
  | 'examples_counterexamples'
  | 'guiding_questions'
  | 'debate_claim';

export interface DebateStepItem {
  key: 'identify' | 'analyze' | 'challenge' | 'synthesize' | 'respond';
  title: string;
  vietnameseTitle: string;
  summary: string;
}

export interface ThreeLayerResponse {
  /** Lớp 1 – Tóm tắt ý chính (TL;DR / Phản hồi trực diện, tối đa 2 câu) */
  tldr?: string;
  /** Cơ sở / dữ kiện khách quan (nằm trong Lớp 2 – Phân tích chi tiết) */
  facts: string;
  /** Giả định ngầm (nằm trong Lớp 2 – Phân tích chi tiết) */
  assumptions: string;
  /** Góc nhìn phản biện / Điểm hở logic / Ví dụ minh họa (nằm trong Lớp 2 – Phân tích chi tiết) */
  interpretation: string;
  /** Lớp 3 – Đúng 1 câu hỏi sắc bén, dễ hiểu cho lượt tiếp theo */
  guidingQuestion: string;
  /** Gợi ý ngắn gọn giúp người dùng dễ trả lời câu hỏi ở Lớp 3 */
  questionHint?: string;
}

export interface LedgerEntry {
  id: string; // e.g., "U#1", "A#1"
  speaker: 'user' | 'ai';
  turnIndex: number;
  claim: string;
  assumptions: string[];
  contradictionFlag?: string;
  timestamp: string;
}

export interface LabMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  turnRef?: string; // U#1 or A#1
  threeLayer?: ThreeLayerResponse;
  debateSteps?: DebateStepItem[];
  sourceEngine?: 'openai-responses' | 'gemini' | 'local-fallback';
  responseId?: string;
}

export interface LabSession {
  id: string;
  title: string;
  labType: LabType;
  resourceContextId?: string;
  previousResponseId?: string;
  messages: LabMessage[];
  ledger: LedgerEntry[];
  coreAssumptions: string[];
  contradictions: Array<{
    id: string;
    refA: string;
    refB: string;
    note: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface LabApiRequestPayload {
  session_id: string;
  lab_type: LabType;
  message: string;
  resource_context_id?: string | null;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
    turnRef?: string;
  }>;
  ledger_snapshot?: LedgerEntry[];
  core_assumptions?: string[];
  previous_response_id?: string | null;
  simulate_429?: boolean;
}

export interface LabApiResponsePayload {
  session_id: string;
  lab_type: LabType;
  response_id: string;
  source_engine: 'openai-responses' | 'gemini' | 'local-fallback';
  user_claim_summary: string;
  ai_claim_summary: string;
  new_assumptions: string[];
  contradiction_note?: string | null;
  contradiction_ref?: string | null;
  debate_steps: DebateStepItem[];
  three_layer: ThreeLayerResponse;
}

export interface UserNotificationPrefs {
  dailyQuoteReminder: boolean;
  labFollowUpSuggestions: boolean;
  libraryNewHighlights: boolean;
}

export interface UserPrivacyPrefs {
  saveReadingProgress: boolean;
  saveLabHistory: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  roleLabel: string;
  bio?: string;
  avatarTint?: string;
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
  interests: string[];
  readingDepth: string;
  debateStyle: string;
  goal: string;
  weeklyRhythm: string;
  confidenceLevel?: string;
  exploreTopic?: string;
  notifications?: UserNotificationPrefs;
  privacy?: UserPrivacyPrefs;
}

export interface ReadingNote {
  id: string;
  documentId: string;
  blockId?: string;
  sectionId?: string;
  sectionTitle?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LabHandoffPayload {
  labType: LabType;
  resourceContextId: string;
  resourceTitle: string;
  quoteText: string;
  blockLabel?: string;
  sectionId?: string;
  sectionTitle?: string;
  actionIntent?: LabActionIntent;
}

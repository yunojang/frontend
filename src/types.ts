export type RoleType = 'owner' | 'translator' | 'reviewer'

export interface User {
  id: string
  name: string
  role: RoleType
  avatarUrl?: string
  languages?: string[]
}

export interface ProjectMember {
  id: string
  name: string
  role: RoleType
  assignedLanguages?: string[]
}

export type LanguageStatus = 'pending' | 'processing' | 'review' | 'completed'

export interface Language {
  code: string
  name: string
  subtitle: boolean
  dubbing: boolean
  progress?: number
  status?: LanguageStatus
  translatorId?: string
  translator?: string
  reviewerId?: string
  deadline?: string
  translationReviewed?: boolean
  voiceConfig?: Record<string, { voiceId?: string; preserveTone: boolean }>
}
export type TranslationIssueType = 'term' | 'length' | 'number' | 'tone'

export type TranslationIssueSeverity = 'warning' | 'error'

export interface TranslationIssue {
  _id: string
  type: TranslationIssueType
  kind?: string
  severity: TranslationIssueSeverity
  message: string
  recommend_text: string
}

export interface CorrectionSuggestion {
  id: string
  text: string
  reason: string
}

export interface TermCorrection {
  id: string
  original: string
  replacement: string
  reason?: string
}

export interface STTSegment {
  id: string
  startTime: string
  endTime: string
  text: string
  speaker?: string
  confidence: number
}

export interface Translation {
  projectId: string
  id: string
  timestamp: string
  original: string
  translated: string
  confidence: number
  issues?: TranslationIssue[]
  speaker?: string
  segmentDurationSeconds?: number
  originalSpeechSeconds?: number
  translatedSpeechSeconds?: number
  correctionSuggestions?: CorrectionSuggestion[]
  termCorrections?: TermCorrection[]
  assets?: SegmentAssetKeys
  rawSegment?: ProjectSegment

  // 백엔드 세그먼트 PK (없으면 기존 id를 임시로 사용)
  segmentId?: string
  // 미리보기 상태/결과
  preview?: {
    jobId?: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    videoUrl?: string
    audioUrl?: string
    updatedAt?: string
  }
}

export type ProjectStatus = 'upload_done' | 'stt' | 'mt' | 'tts' | 'pack' | 'publish' | 'done'

export interface Project {
  id: string
  name: string
  languages: Language[]
  status: ProjectStatus
  uploadProgress?: number
  createdAt: string
  thumbnail?: string
  members?: ProjectMember[]
  seriesTitle?: string
  episodeTitle?: string
  deadline?: string
  reviewerId?: string
  ownerId?: string
  jobId?: string
  jobStatus?: 'queued' | 'in_progress' | 'done' | 'failed'
  jobResultKey?: string
  jobMetadata?: Record<string, unknown>
  segmentAssetsPrefix?: string
  segments?: ProjectSegment[]
}

export type PipelineStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'review'

// 개별 파이프라인
export interface PipelineStage {
  id: string
  status: PipelineStatus
  progress: number
  started_at?: string
  completed_at?: string
  error?: string
}

// 전체 파이프라인 (여러 단계들을 포함)
export interface ProjectPipeline {
  project_id: string
  stages: PipelineStage[]
  current_stage: string
  overall_progress: number
}

export interface SegmentAssetKeys {
  sourceKey?: string
  bgmKey?: string
  ttsKey?: string
  mixKey?: string
  videoKey?: string
}

export interface ProjectSegmentIssue {
  issueId?: string
  issueContext?: string | null
  [key: string]: unknown
}

export interface ProjectSegment {
  id: string
  text: string
  translation: string
  start: number
  end: number
  length: number
  score?: number | null
  issues?: TranslationIssue[]
  assets?: SegmentAssetKeys
}

export interface ProjectDetail extends Project {
  segments: ProjectSegment[]
  segmentAssetsPrefix?: string
}

export interface AuthUser {
  code: string
  name: string
  email?: string
  role?: 'owner' | 'translator' | 'admin'
}

export interface AuthContextValue {
  user: AuthUser | null
  setUser(user: AuthUser | null): void
  isLoading: boolean
  setIsLoading(next: boolean): void
  refresh(): Promise<void>
}

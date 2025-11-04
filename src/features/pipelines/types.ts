export type PipelineStageStatus = 'pending' | 'processing' | 'review' | 'completed' | 'failed'

export interface IPipelineStage {
  id: string
  title: string
  description?: string
  status: PipelineStageStatus
  progress: number // 0~100
  estimatedTime?: string
  startedAt?: string
  endedAt?: string
  errorMessage?: string
}

export interface PipelineEventPayload {
  project_id: string
  stage: string
  status: PipelineStageStatus
  progress?: number
  timestamp: string
}

export interface PipelineState {
  project_id: string
  stages: IPipelineStage[]
  current_stage: string
  overall_progress: number
}

export interface PipelineSummary {
  total: number
  completed: number
  processing: number
  pending: number
  failed: number
  review: number
  currentStageId?: string
  currentStageTitle?: string
}

export interface PipelineStageMeta {
  title: string
  description?: string
  estimatedTime?: string
}

export const PIPELINE_STAGE_ORDER = [
  'upload',
  'stt',
  'mt',
  'rag',
  'tts',
  'packaging',
  'outputs',
] as const

export const PIPELINE_STAGE_META: Record<string, PipelineStageMeta> = {
  upload: {
    title: '1. 영상 업로드',
    description: '원본 영상 파일을 서버에 업로드합니다',
  },
  stt: {
    title: '2. STT (Speech to Text)',
    description: '음성을 텍스트로 변환하고 타임스탬프를 생성합니다',
    estimatedTime: '3-5분',
  },
  mt: {
    title: '3. MT (Machine Translation)',
    description: '추출된 텍스트를 타겟 언어로 번역합니다',
    estimatedTime: '2분',
  },
  rag: {
    title: '4. RAG/LLM 교정',
    description: 'AI 교정 결과를 검토하고, 번역가를 지정해 상세 번역을 요청하세요',
    estimatedTime: '3분',
  },
  tts: {
    title: '5. TTS (Text to Speech)',
    description: '번역된 텍스트를 음성으로 변환합니다',
    estimatedTime: '5분',
  },
  packaging: {
    title: '6. 패키징',
    description: '더빙된 음성과 자막을 영상에 합성합니다',
    estimatedTime: '2분',
  },
  outputs: {
    title: '7. 산출물 점검 및 Publish',
    description: '완료된 산출물을 검수하고 배포 설정을 확정합니다',
  },
}

export const DEFAULT_STAGES: IPipelineStage[] = PIPELINE_STAGE_ORDER.map((id) => {
  const meta = PIPELINE_STAGE_META[id]
  return {
    id,
    status: 'pending',
    progress: 0,
    title: meta?.title ?? id,
    description: meta?.description,
    estimatedTime: meta?.estimatedTime,
  }
})

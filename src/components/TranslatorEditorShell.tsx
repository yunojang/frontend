import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { fetchProjectDetail } from '@/features/projects/services/projects'
import type {
  ProjectDetail,
  ProjectSegment,
  Translation,
  TranslationIssue,
  TranslationIssueType,
} from '@/types'
import { AdvancedTranslationEditor } from './AdvancedTranslationEditor'
import { Button } from './ui/button'
import type { TranslatorAssignment } from '@/pages/TranslatorPage'

interface TranslatorEditorShellProps {
  assignment: TranslatorAssignment
  onBack: () => void
}

const formatTime = (seconds: number): string => {
  if (Number.isNaN(seconds) || seconds < 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, '0')
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0')
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')
  return `${h}:${m}:${s}`
}

const mapIssue = (issue: TranslationIssue): TranslationIssue => {
  const message = issue.message
  let type: TranslationIssueType = 'term'
  let severity: 'warning' | 'error' = 'warning'

  if (message.includes('길이') || message.toLowerCase().includes('length')) {
    type = 'length'
    severity = 'error'
  } else if (message.includes('톤') || message.toLowerCase().includes('tone')) {
    type = 'tone'
  } else if (message.includes('숫자') || message.toLowerCase().includes('number')) {
    type = 'number'
  }

  return {
    ...issue,
    type,
    severity,
    message,
  }
}

const mapSegmentToTranslation = (segment: ProjectSegment): Translation => {
  const duration = Math.max(0, segment.end - segment.start)
  return {
    id: segment.id || `${segment.start}-${segment.end}`,
    segmentId: segment.id || undefined,
    timestamp: `${formatTime(segment.start)} - ${formatTime(segment.end)}`,
    original: segment.text,
    translated: segment.translation,
    confidence: segment.score ?? 0,
    issues: (segment.issues ?? []).map(mapIssue),
    segmentDurationSeconds: duration,
    correctionSuggestions: [],
    termCorrections: [],
    assets: segment.assets,
    rawSegment: segment,
  }
}

const updateSegmentsWithTranslations = (
  segments: ProjectSegment[],
  translations: Translation[]
): ProjectSegment[] => {
  const byId = new Map(translations.map((t) => [t.id, t]))
  return segments.map((segment) => {
    const next = byId.get(segment.id)
    if (!next) return segment
    return {
      ...segment,
      text: next.original,
      translation: next.translated,
    }
  })
}

export function TranslatorEditorShell({ assignment, onBack }: TranslatorEditorShellProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [segments, setSegments] = useState<ProjectSegment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    fetchProjectDetail(assignment.projectId)
      .then((detail) => {
        if (!isMounted) return
        setProject(detail)
        setSegments(detail.segments ?? [])
        setError(null)
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : '세그먼트를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [assignment.projectId])

  const editorTranslations = useMemo(
    () => segments.map((segment) => mapSegmentToTranslation(segment)),
    [segments]
  )

  const pageTitle = useMemo(
    () => `${assignment.projectName} · ${assignment.languageName}`,
    [assignment.projectName, assignment.languageName]
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              할당 목록
            </Button>
            <div className="h-6 w-px bg-gray-300" />
            <div>
              <h2 className="text-lg font-semibold">{pageTitle}</h2>
              <p className="text-xs text-gray-500">번역가: {assignment.translator || '미지정'}</p>
            </div>
          </div>
          {project?.segmentAssetsPrefix ? (
            <span className="text-xs text-gray-400"> Assets: {project.segmentAssetsPrefix}</span>
          ) : null}
        </div>
      </header>

      {isLoading ? (
        <div className="max-w-6xl mx-auto px-6 py-12 text-sm text-gray-500">
          세그먼트를 불러오는 중…
        </div>
      ) : error ? (
        <div className="max-w-6xl mx-auto px-6 py-12 text-sm text-red-500">
          세그먼트를 불러오는 중 오류가 발생했습니다. {error}
        </div>
      ) : (
        <AdvancedTranslationEditor
          projectID={assignment.projectId}
          languageCode={assignment.languageCode}
          language={assignment.languageName}
          translations={editorTranslations}
          onSave={(updated) => {
            setSegments((prev) => updateSegmentsWithTranslations(prev, updated))
          }}
          onBack={onBack}
          isDubbing={assignment.isDubbing}
          showVoiceSelector={false}
        />
      )}
    </div>
  )
}

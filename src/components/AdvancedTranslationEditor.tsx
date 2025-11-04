import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  Play,
  RotateCcw,
  Lightbulb,
  ArrowLeft,
  MonitorPlay,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  Translation,
  CorrectionSuggestion,
  TermCorrection,
  TranslationIssueType,
} from '../types'
import { createSegmentPreview, getSegmentPreview } from '../api/editor'
import { fetchJobStatus, requestSegmentRetranslate } from '../features/projects/services/jobs'
import { Suggestion } from './editor/LangSuggest'
import { IussueCard } from './editor/IussueCard'
import { StatisticsCard } from './editor/StatisticsCard'
import { TermCorrectionCard } from './editor/LangCorrection'

export interface AdvancedTranslationEditorProps {
  projectID: string
  languageCode: string
  language: string
  translations: Translation[]
  onSave: (translations: Translation[]) => void
  onBack: () => void
  isDubbing?: boolean
  showVoiceSelector?: boolean
  onVoiceChange?: (speaker: string, config: { voiceId?: string; preserveTone: boolean }) => void
}

export function AdvancedTranslationEditor({
  projectID,
  languageCode,
  language,
  translations,
  onSave,
  onBack,
  // isDubbing = false,
  // showVoiceSelector = true,
  // onVoiceChange,
}: AdvancedTranslationEditorProps) {
  const [editedTranslations, setEditedTranslations] = useState<Translation[]>(translations)
  // const [selectedTab, setSelectedTab] = useState<'edit' | 'voice' | 'output'>('edit')
  // const handleTabChange = (value: string) => {
  //   if (value === 'edit' || value === 'voice' || value === 'output') {
  //     setSelectedTab(value)
  //   }
  // }

  console.log(editedTranslations)

  const enrichTranslations = useMemo(
    () => editedTranslations.map((t) => ({ ...t, issues: t.issues ?? [] })),
    [editedTranslations]
  )

  const translationGroups = useMemo(() => {
    const groups: {
      key: string
      timestamp: string
      translations: Translation[]
    }[] = []

    const indexMap = new Map<string, number>()

    translations.forEach((item) => {
      const timeKey = item.timestamp
      if (indexMap.has(timeKey)) {
        const idx = indexMap.get(timeKey)!
        groups[idx].translations.push(item)
      } else {
        const idx = groups.length
        indexMap.set(timeKey, idx)
        groups.push({
          key: item.timestamp + idx.toString(),
          timestamp: item.timestamp,
          translations: [item],
        })
      }
    })

    return groups.map((group) => ({
      ...group,
      translations: group.translations.map(
        (item) => enrichTranslations.find((t) => t.id === item.id) ?? item
      ),
    }))
  }, [enrichTranslations, translations])

  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewTranslation, setPreviewTranslation] = useState<Translation | null>(null)
  const [isPreviewProcessing, setIsPreviewProcessing] = useState(false)
  const previewTimerRef = useRef<number>()
  const previewPollerRef = useRef<number>()
  const retranslatePollersRef = useRef<Map<string, number>>(new Map())
  const editedTranslationsRef = useRef(editedTranslations)

  const parseTimestampDuration = (timestamp: string) => {
    const [start, end] = timestamp.split(' - ')
    if (!start || !end) return 0
    const toSeconds = (value: string) => {
      const parts = value.split(':').map(Number)
      if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
        return 0
      }
      const [hours, minutes, seconds] = parts
      return hours * 3600 + minutes * 60 + seconds
    }
    const duration = toSeconds(end) - toSeconds(start)
    return duration > 0 ? duration : 0
  }

  const getSegmentDuration = (translation: Translation) =>
    translation.segmentDurationSeconds ?? parseTimestampDuration(translation.timestamp)

  const formatSeconds = (value?: number) => {
    if (value === undefined) return '-'
    return `${value.toFixed(1)}초`
  }

  const getGaugeColor = (progress: number) => {
    if (progress <= 80) return 'bg-emerald-500'
    if (progress <= 100) return 'bg-amber-500'
    return 'bg-red-500'
  }

  // 특정 translation의 preview필드 부분 업데이트
  const patchPreviewOn = (id: string, patch: Partial<NonNullable<Translation['preview']>>) => {
    setEditedTranslations((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        return { ...t, preview: { ...(t.preview ?? { status: 'pending' }), ...patch } }
      })
    )
    setPreviewTranslation((prev) => {
      if (!prev || prev.id !== id) return prev
      return { ...prev, preview: { ...(prev.preview ?? { status: 'pending' }), ...patch } }
    })
  }

  const beginPreviewPolling = (id: string, previewID: string) => {
    // 안전장치: 기존 폴링 중지
    if (previewPollerRef.current) window.clearInterval(previewPollerRef.current)
    previewPollerRef.current = window.setInterval(async () => {
      try {
        const res = await getSegmentPreview(previewID)
        if (res.status === 'completed') {
          window.clearInterval(previewPollerRef.current!)
          patchPreviewOn(id, {
            status: 'completed',
            videoUrl: res.videoUrl,
            audioUrl: res.audioUrl,
            updatedAt: res.updatedAt,
          })
          setIsPreviewProcessing(false)
        } else if (res.status === 'failed') {
          window.clearInterval(previewPollerRef.current!)
          patchPreviewOn(id, { status: 'failed' })
          setIsPreviewProcessing(false)
          toast.error('미리보기 생성 실패')
        }
        // processing 이면 계속 폴링
      } catch (e: unknown) {
        window.clearInterval(previewPollerRef.current!)
        setIsPreviewProcessing(false)
        if (e instanceof Error) {
          toast.error(e?.message ?? '미리보기 조회 실패')
        } else {
          // totalIssues.errot('미리보기 조회 실패')
        }
      }
    }, 800)
  }

  const clearRetranslatePoller = (jobId: string) => {
    const intervalId = retranslatePollersRef.current.get(jobId)
    if (intervalId) {
      window.clearInterval(intervalId)
      retranslatePollersRef.current.delete(jobId)
    }
  }

  const refreshPreviewAfterRetranslate = async (translationId: string) => {
    if (!projectID || !languageCode) {
      toast.error('프로젝트 정보를 확인할 수 없습니다. 새 오디오를 가져오지 못했습니다.')
      return
    }

    const current = editedTranslationsRef.current.find((t) => t.id === translationId)
    if (!current) {
      return
    }

    const segId = current.segmentId ?? current.id

    try {
      const res = await createSegmentPreview(projectID, languageCode, segId, {
        text: current.translated,
      })

      if (res.status === 'completed') {
        patchPreviewOn(translationId, {
          status: 'completed',
          jobId: res.previewId,
          videoUrl: res.videoUrl,
          audioUrl: res.audioUrl,
          updatedAt: res.updatedAt,
        })
        toast.success('재번역된 오디오가 준비되었습니다')
        return
      }

      if (res.status === 'processing' && res.previewId) {
        patchPreviewOn(translationId, { status: 'processing', jobId: res.previewId })
        beginPreviewPolling(translationId, res.previewId)
        return
      }

      patchPreviewOn(translationId, { status: 'failed' })
      toast.error('새로운 오디오를 불러오지 못했습니다')
    } catch (error) {
      patchPreviewOn(translationId, { status: 'failed' })
      if (error instanceof Error) {
        toast.error(error.message ?? '새로운 오디오 조회 실패')
      } else {
        toast.error('새로운 오디오 조회 실패')
      }
    }
  }

  const handlePreview = async (translation: Translation) => {
    if (!projectID || !languageCode) {
      toast.error('프로젝트 정보를 확인할 수 없어 미리보기를 생성하지 못했습니다.')
      return
    }
    // Dialog 열고 로딩 진입
    setPreviewTranslation(translation)
    setIsPreviewOpen(true)
    setIsPreviewProcessing(true)

    const segId = translation.segmentId ?? translation.id
    try {
      const res = await createSegmentPreview(projectID, languageCode, segId, {
        text: translation.translated,
      })
      // 즉시 완료 (Mock)
      if (res.status === 'completed') {
        patchPreviewOn(translation.id, {
          status: 'completed',
          jobId: res.previewId,
          videoUrl: res.videoUrl,
          audioUrl: res.audioUrl,
          updatedAt: res.updatedAt,
        })
        setIsPreviewProcessing(false)
        return
      }
      // 처리 중이면 폴링 시작
      if (res.status === 'processing' && res.previewId) {
        patchPreviewOn(translation.id, { status: 'processing', jobId: res.previewId })
        beginPreviewPolling(translation.id, res.previewId)
        return
      }
      // 그 외 상태는 실패 처리
      patchPreviewOn(translation.id, { status: 'failed' })
      setIsPreviewProcessing(false)
      toast.error('미리보기 생성 실패')
    } catch (e: unknown) {
      patchPreviewOn(translation.id, { status: 'failed' })
      setIsPreviewProcessing(false)
      if (e instanceof Error) {
        toast.error(e.message ?? '미리보기 생성 오류')
      } else {
        toast.error('미리보기 생성 오류')
      }
    }
  }
  const handlePreviewOpenChange = (open: boolean) => {
    if (!open) {
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current)
      }
      if (previewPollerRef.current) {
        window.clearInterval(previewPollerRef.current)
      }
      setIsPreviewProcessing(false)
      setPreviewTranslation(null)
    }
    setIsPreviewOpen(open)
  }

  useEffect(() => {
    editedTranslationsRef.current = editedTranslations
  }, [editedTranslations])

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current)
      }
      if (previewPollerRef.current) {
        window.clearInterval(previewPollerRef.current)
      }
      retranslatePollersRef.current.forEach((intervalId) => {
        window.clearInterval(intervalId)
      })
      retranslatePollersRef.current.clear()
    }
  }, [])

  // 이슈 통계
  const issueStats = useMemo(
    () => ({
      term: enrichTranslations.reduce(
        (acc, t) => acc + (t.issues ?? []).filter((i) => i.type === 'term').length,
        0
      ),
      length: enrichTranslations.reduce(
        (acc, t) => acc + (t.issues ?? []).filter((i) => i.type === 'length').length,
        0
      ),
    }),
    [enrichTranslations]
  )

  const totalIssues = enrichTranslations.reduce((acc, t) => acc + (t.issues?.length ?? 0), 0)

  const handleTranslationChange = (id: string, newText: string) => {
    setEditedTranslations((prev) =>
      prev.map((t) => (t.id === id ? { ...t, translated: newText } : t))
    )
  }

  const handleApplyIssueSuggestion = (id: string, suggestion: string) => {
    setEditedTranslations((prev) =>
      prev.map((t) => (t.id === id ? { ...t, translated: suggestion, issues: [] } : t))
    )
    toast.success('제안이 적용되었습니다')
  }

  // const handleApplyCorrectionSuggestion = (id: string, suggestion: CorrectionSuggestion) => {
  //   setEditedTranslations((prev) =>
  //     prev.map((t) => {
  //       if (t.id !== id) return t
  //       const remaining = t.correctionSuggestions?.filter((s) => s.id !== suggestion.id) ?? []
  //       return {
  //         ...t,
  //         translated: suggestion.text,
  //         correctionSuggestions: remaining,
  //       }
  //     })
  //   )
  //   toast.success(`${suggestion.reason} 교정 후보가 적용되었습니다`)
  // }

  // const handleApplyTermCorrection = (id: string, correction: TermCorrection) => {
  //   setEditedTranslations((prev) =>
  //     prev.map((t) => {
  //       if (t.id !== id) return t
  //       const updatedText = t.translated.replace(correction.original, correction.replacement)
  //       const remainingTerms = t.termCorrections?.filter((c) => c.id !== correction.id) ?? []
  //       return {
  //         ...t,
  //         translated: updatedText,
  //         termCorrections: remainingTerms,
  //       }
  //     })
  //   )
  //   toast.success('용어 교정이 적용되었습니다')
  // }

  const handleRetranslate = async (id: string) => {
    if (!projectID) {
      toast.error('프로젝트 정보를 확인할 수 없어 재번역을 시작하지 못했습니다.')
      return
    }

    const target = editedTranslationsRef.current.find((translation) => translation.id === id)
    if (!target) {
      toast.error('선택된 문장을 찾을 수 없습니다.')
      return
    }

    const segmentId = target.segmentId ?? target.id

    const label = target.original ? `"${target.original}"` : '선택된 문장'
    patchPreviewOn(id, { status: 'processing' })
    toast.info(`${label} 재번역 작업을 시작했습니다`)

    try {
      const res = await requestSegmentRetranslate(projectID, segmentId, {
        text: target.translated,
      })

      patchPreviewOn(id, { status: 'processing', jobId: res.jobId })

      const poller = window.setInterval(async () => {
        try {
          const job = await fetchJobStatus(res.jobId)
          if (job.status === 'done') {
            clearRetranslatePoller(res.jobId)
            await refreshPreviewAfterRetranslate(id)
          } else if (job.status === 'failed') {
            clearRetranslatePoller(res.jobId)
            patchPreviewOn(id, { status: 'failed' })
            const message = (job.error as string | undefined) ?? '재번역 작업이 실패했습니다'
            toast.error(message)
          }
        } catch (error) {
          clearRetranslatePoller(res.jobId)
          patchPreviewOn(id, { status: 'failed' })
          if (error instanceof Error) {
            toast.error(error.message ?? '재번역 상태 확인에 실패했습니다')
          } else {
            toast.error('재번역 상태 확인에 실패했습니다')
          }
        }
      }, 1500)

      retranslatePollersRef.current.set(res.jobId, poller)
    } catch (error) {
      patchPreviewOn(id, { status: 'failed' })
      if (error instanceof Error) {
        toast.error(error.message ?? '재번역 요청에 실패했습니다')
      } else {
        toast.error('재번역 요청에 실패했습니다')
      }
    }
  }

  const handleSave = () => {
    onSave(editedTranslations)
    toast.success('번역이 저장되었습니다')
    onBack()
  }

  const getIssueIcon = (type: TranslationIssueType) => {
    switch (type) {
      case 'term':
        return <MessageSquare className="w-4 h-4" />
      case 'length':
        return <TrendingUp className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const getIssueLabel = (type: TranslationIssueType) => {
    switch (type) {
      case 'term':
        return '용어'
      case 'length':
        return '길이'
      default:
        return type
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={onBack} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                대시보드로 돌아가기
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h2 className="flex items-center gap-3">
                  <span>번역 검토 및 수정 - {language}</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    <Lightbulb className="w-3 h-3 mr-1" />
                    AI 교정 반영
                  </Badge>
                  {totalIssues > 0 && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {totalIssues}개 이슈
                    </Badge>
                  )}
                </h2>
              </div>
            </div>
            <Button onClick={handleSave}>저장 및 다음 단계</Button>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* <Tabs value={selectedTab} onValueChange={handleTabChange} className="space-y-6"> */}
        {/* <TabsList>
            <TabsTrigger value="edit">번역 편집</TabsTrigger>
            {isDubbing && <TabsTrigger value="voice">보이스 설정</TabsTrigger>}
          </TabsList> */}

        {/* <TabsContent value="edit" className="grid grid-cols-1 lg:grid-cols-4 gap-6 m-0"> */}
        {/* 왼쪽: 영상 미리보기 + 이슈 요약 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 m-0">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4 text-blue-500" />
                  원본 영상
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-900">
                  <video
                    className="w-full h-full object-cover"
                    controls
                    poster="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1280&q=60"
                  >
                    <source
                      src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
                      type="video/mp4"
                    />
                    브라우저가 video 태그를 지원하지 않습니다.
                  </video>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>00:01:12 / 05:23</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      1080p
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      자막 ON
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    현재 구간 반복
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    전체 화면
                  </Button>
                </div>
              </CardContent>
            </Card>
            <IussueCard issueStats={issueStats} />

            <StatisticsCard editedTranslations={enrichTranslations} />
          </div>

          {/* 오른쪽: 번역 리스트 */}
          <div className="lg:col-span-3">
            <div className="space-y-4">
              {translationGroups.map((group, gidx) => {
                // const groupIssues = group.translations.reduce(
                //   (acc, item) => acc + item.issues.length,
                //   0
                // )
                return (
                  <Card
                    key={group.key}
                    // className={`${groupIssues > 0 ? 'border-orange-300 bg-orange-50/30' : ''}`}
                  >
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {group.timestamp}
                        </span>
                        {group.translations.length > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            동시 화자 {group.translations.length}명
                          </Badge>
                        )}
                        <span className="text-xs text-gray-400">{gidx + 1}번째 세그먼트</span>
                      </div>

                      <div className="space-y-3">
                        {group.translations.map((translation) => {
                          const segmentDuration = getSegmentDuration(translation)
                          const safeSegmentDuration = segmentDuration || 1
                          const originalSpeech =
                            translation.originalSpeechSeconds ?? segmentDuration
                          const translatedSpeech =
                            translation.translatedSpeechSeconds ?? segmentDuration
                          const originalProgress = originalSpeech
                            ? (originalSpeech / safeSegmentDuration) * 100
                            : 0
                          const translatedProgress = translatedSpeech
                            ? (translatedSpeech / safeSegmentDuration) * 100
                            : 0
                          const translatedDelta =
                            translatedSpeech && segmentDuration
                              ? translatedSpeech - segmentDuration
                              : 0
                          const translatedDeltaLabel =
                            translatedSpeech && segmentDuration
                              ? `${translatedDelta >= 0 ? '+' : ''}${translatedDelta.toFixed(1)}초`
                              : '0.0초'
                          const translatedDeltaClass =
                            translatedSpeech && segmentDuration
                              ? translatedDelta > 0.3
                                ? 'text-red-600'
                                : translatedDelta < -0.3
                                  ? 'text-emerald-600'
                                  : 'text-gray-500'
                              : 'text-gray-500'

                          const issues = translation.issues ?? []
                          // const correctionSuggestions = translation.correctionSuggestions ?? []
                          // const termCorrections = translation.termCorrections ?? []

                          const issueSuggestionItems = issues
                            // .filter((issue) => issue.suggestion)
                            .map((issue) => ({
                              id: issue._id,
                              reason: issue.message,
                              text: issue.recommend_text ?? '',
                              onApply: () =>
                                handleApplyIssueSuggestion(
                                  translation.id,
                                  issue.recommend_text ?? ''
                                ),
                            }))

                          // const correctionSuggestionItems = correctionSuggestions.map(
                          //   (suggestion) => ({
                          //     id: suggestion.id,
                          //     text: suggestion.text,
                          //     reason: suggestion.reason,
                          //     onApply: () =>
                          //       handleApplyCorrectionSuggestion(translation.id, suggestion),
                          //   })
                          // )
                          const combinedSuggestions = [
                            ...issueSuggestionItems,
                            // ...correctionSuggestionItems,
                          ]

                          return (
                            <div
                              key={translation.id}
                              className="rounded-lg border border-gray-200/70 bg-white/70 p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-gray-100 text-gray-700"
                                  >
                                    세그먼트 {gidx + 1}
                                  </Badge>
                                  {translation.speaker && (
                                    <Badge variant="outline" className="text-xs">
                                      화자 {translation.speaker}
                                    </Badge>
                                  )}
                                  <div className="flex items-center gap-1">
                                    {translation.confidence >= 0.8 ? (
                                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                                    ) : (
                                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                    )}
                                    <span className="text-xs text-gray-500">
                                      {(translation.confidence * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1"
                                    onClick={() => handlePreview(translation)}
                                  >
                                    <Play className="w-3 h-3" />
                                    미리보기
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1"
                                    onClick={() => handleRetranslate(translation.id)}
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    재번역
                                  </Button>
                                </div>
                              </div>
                              {segmentDuration > 0 && (
                                <div className="space-y-2 text-xs">
                                  <div className="flex items-center gap-3 text-gray-500">
                                    <span className="w-16 shrink-0">원문 발화</span>
                                    <div className="flex-1 h-1 bg-gray-200/80 rounded-full overflow-hidden relative">
                                      <span
                                        className="absolute inset-y-0 w-0.5 bg-gray-400/70"
                                        style={{ left: 'calc(100% - 1px)' }}
                                      />
                                      <div
                                        className={`h-full ${getGaugeColor(originalProgress)}`}
                                        style={{
                                          width: `${Math.min(Math.max(originalProgress, 0), 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="w-28 text-right">
                                      {formatSeconds(originalSpeech)} /{' '}
                                      {formatSeconds(segmentDuration)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span className="w-16 shrink-0 text-gray-500">번역 발화</span>
                                    <div className="flex-1 h-1 bg-gray-200/80 rounded-full overflow-hidden relative">
                                      <span
                                        className="absolute inset-y-0 w-0.5 bg-gray-400/70"
                                        style={{ left: 'calc(100% - 1px)' }}
                                      />
                                      <div
                                        className={`h-full ${getGaugeColor(translatedProgress)}`}
                                        style={{
                                          width: `${Math.min(Math.max(translatedProgress, 0), 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-end gap-2 w-36">
                                      <span className="text-gray-500">
                                        {formatSeconds(translatedSpeech)} /{' '}
                                        {formatSeconds(segmentDuration)}
                                      </span>
                                      {translatedSpeech && segmentDuration ? (
                                        <span className={translatedDeltaClass}>
                                          {translatedDeltaLabel}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">원문</label>
                                <div className="bg-gray-50 p-3 rounded text-sm">
                                  {translation.original}
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">번역</label>
                                <Textarea
                                  value={translation.translated}
                                  onChange={(e) =>
                                    handleTranslationChange(translation.id, e.target.value)
                                  }
                                  className="min-h-20 resize-none"
                                />
                              </div>
                              {/* {issues.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {issues.map((issue, issueIdx) => (
                                    <Badge
                                      key={issueIdx}
                                      variant="outline"
                                      className={`text-xs ${
                                        issue.severity === 'error'
                                          ? 'border-red-300 bg-red-50 text-red-700'
                                          : 'border-yellow-300 bg-yellow-50 text-yellow-700'
                                      }`}
                                    >
                                      {getIssueIcon(issue.type)}
                                      <span className="ml-1">
                                        {getIssueLabel(issue.type)}: {issue.message}
                                      </span>
                                    </Badge>
                                  ))}
                                </div>
                              )} */}
                              <TermCorrectionCard
                                termCorrections={combinedSuggestions}
                                // onApply={handleApplyTermCorrection}
                              />
                              {/* <Suggestion combinedSuggestions={combinedSuggestions} /> */}
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
        {/* </TabsContent> */}

        {/* {isDubbing && (
          <TabsContent value="voice" className="m-0">
            {showVoiceSelector && (
              <VoiceSelector translations={editedTranslations} onVoiceChange={onVoiceChange} />
            )}
          </TabsContent>
        )} */}
        {/* </Tabs> */}
      </main>

      <Dialog open={isPreviewOpen} onOpenChange={handlePreviewOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>번역 미리보기</span>
              {previewTranslation?.timestamp && (
                <span className="text-xs font-mono text-gray-400">
                  {previewTranslation.timestamp}
                </span>
              )}
            </DialogTitle>
            {previewTranslation && (
              <DialogDescription>
                최신 번역 텍스트로 합성된 음성을 영상과 함께 확인해보세요.
              </DialogDescription>
            )}
          </DialogHeader>

          {isPreviewProcessing || !previewTranslation ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <div className="text-sm text-gray-600 text-center">
                번역된 음성을 합성하고 있습니다...
                <br />
                평균 1초 내외로 완료돼요.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                <video
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  poster="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1280&q=60"
                >
                  <source
                    src={
                      previewTranslation.preview?.videoUrl ??
                      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
                    }
                    type="video/mp4"
                  />
                  브라우저가 video 태그를 지원하지 않습니다.
                </video>
              </div>

              <div className="flex items-center justify-between gap-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">번역 텍스트</p>
                  <p className="text-sm font-medium">{previewTranslation.translated}</p>
                </div>
                <audio
                  controls
                  className="min-w-[200px]"
                  src={
                    previewTranslation.preview?.audioUrl ??
                    'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3'
                  }
                >
                  브라우저가 audio 태그를 지원하지 않습니다.
                </audio>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="border rounded-lg p-3 space-y-1">
                  <p className="text-xs text-gray-500">원문</p>
                  <p>{previewTranslation.original}</p>
                </div>
                <div className="border rounded-lg p-3 space-y-1">
                  <p className="text-xs text-gray-500">번역</p>
                  <p>{previewTranslation.translated}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

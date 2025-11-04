import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { CheckCircle2, Circle, Clock, AlertCircle, Edit } from 'lucide-react'
import type { PipelineStatus } from '../types'

interface PipelineStageProps {
  title: string
  description?: string
  status: PipelineStatus
  progress?: number
  onEdit?: () => void
  showEditButton?: boolean
  estimatedTime?: string
  editLabel?: string
}

export function PipelineStage({
  title,
  description,
  status,
  progress = 0,
  onEdit,
  showEditButton = false,
  editLabel,
}: PipelineStageProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />
      case 'processing':
        return <Clock className="w-6 h-6 text-blue-500 animate-pulse" />
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-500" />
      case 'review':
        return <Edit className="w-6 h-6 text-yellow-500" />
      default:
        return <Circle className="w-6 h-6 text-gray-300" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return '완료'
      case 'processing':
        return '처리 중'
      case 'failed':
        return '실패'
      case 'review':
        return '검토 필요'
      default:
        return '대기 중'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'processing':
        return 'bg-blue-100 text-blue-700'
      case 'failed':
        return 'bg-red-100 text-red-700'
      case 'review':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-500'
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-1">{getStatusIcon()}</div>

        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="flex items-center gap-2">
                {title}
                <Badge variant="secondary" className={`text-xs ${getStatusColor()}`}>
                  {getStatusText()}
                </Badge>
              </h3>
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            </div>

            {showEditButton && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} className="gap-1">
                <Edit className="w-3 h-3" />
                {editLabel ?? '편집'}
              </Button>
            )}
          </div>

          {status === 'processing' && (
            <div className="space-y-2">
              <div className="text-sm text-gray-500">
                작업이 진행 중입니다...
                {/* 백엔드에서 세부 진행률과 예상 시간이 제공되면 표시 */}
                {/* {estimatedTime && <span className="ml-1 text-gray-400">예상 {estimatedTime}</span>} */}
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                {progress === 0 ? (
                  <div className="h-full w-full rounded bg-blue-500/60 animate-pulse" />
                ) : (
                  <div
                    className="h-full rounded bg-blue-500/80 transition-[width]"
                    style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                  />
                )}
              </div>
            </div>
          )}

          {status === 'pending' && <div className="text-sm text-gray-400">작업 대기 중입니다</div>}

          {status === 'completed' && (
            <div className="text-sm text-green-600">✓ 처리가 완료되었습니다</div>
          )}

          {status === 'failed' && (
            <div className="text-sm text-red-600">✗ 처리 중 오류가 발생했습니다</div>
          )}

          {status === 'review' && (
            <div className="text-sm text-yellow-600">⚠ 번역 결과를 검토하고 수정해주세요</div>
          )}
        </div>
      </div>
    </Card>
  )
}

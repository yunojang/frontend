import { MessageSquare } from 'lucide-react'
import { Button } from '../ui/button'

export interface TermCorrection {
  id: string
  text: string
  reason: string
  onApply: () => void
}

interface TermCorrectionCardProps {
  termCorrections: TermCorrection[]
  // onApply: (correction: TermCorrection) => void
}

export const TermCorrectionCard = ({ termCorrections }: TermCorrectionCardProps) => {
  // TODO: 제안이 있을 경우 렌더링하도록 아래 주석을 풀어야함
  // if (!termCorrections || termCorrections.length === 0) {
  //   return null
  // }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
        <MessageSquare className="w-4 h-4" />
        용어 교정
      </div>
      {termCorrections.map((correction) => (
        <div key={correction.id} className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-blue-600">{correction.reason}</p>
            <p className="text-sm text-blue-900">
              {/* <span className="line-through decoration-blue-400 decoration-2 mr-1">
                원본 
              </span> */}
              →<span className="ml-1 font-medium">{correction.text}</span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            // 클릭 시 'onApply' 핸들러에 이 'correction' 객체를 전달합니다.
            // onClick={() => onApply(correction)}
            onClick={() => correction?.onApply()}
          >
            적용
          </Button>
        </div>
      ))}
    </div>
  )
}

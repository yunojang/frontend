import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import type { Translation } from '../../types'

export const StatisticsCard = ({ editedTranslations }: { editedTranslations: Translation[] }) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">통계</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">총 문장</span>
          <span>{editedTranslations.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">낮은 신뢰도</span>
          <span className="text-yellow-600">
            {editedTranslations.filter((t) => t.confidence < 0.8).length}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">이슈 있음</span>
          <span className="text-orange-600">
            {editedTranslations.filter((t) => t.issues.length > 0).length}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

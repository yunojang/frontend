import { useEffect, useState, type FC } from 'react'
import { useSSE } from '@/hooks/useSSE'

import Pipelines from './Pipelines'

import {
  DEFAULT_STAGES,
  type IPipelineStage,
  type PipelineEventPayload,
  type PipelineSummary,
} from '../types'
import type { Project } from '@/types'
import { enrichStages, mergeStageUpdate, summarizeStages } from '../utils'
import { fetchPipelineStatus } from '../services'

interface PipelineContainerProps {
  project: Project
  onOverallProgressChange?(prog: number): void
  onSummaryChange?(summary: PipelineSummary): void
}

const computeOverallProgress = (stages: IPipelineStage[]) => {
  if (!stages.length) return 0
  const completed = stages.filter((s) => s.status === 'completed').length
  return Math.round((completed / stages.length) * 100)
}

const PipelineContainer: FC<PipelineContainerProps> = ({
  project,
  onOverallProgressChange,
  onSummaryChange,
}) => {
  const [pipelines, setPipelines] = useState<IPipelineStage[]>(() =>
    DEFAULT_STAGES.map((stage) => ({ ...stage }))
  )

  useEffect(() => {
    let mounted = true

    const loadInitial = async () => {
      try {
        const state = await fetchPipelineStatus(project.id)
        if (mounted && state?.stages) {
          const enriched = enrichStages(state.stages)
          setPipelines(enriched)
        }
      } catch (err) {
        console.error('Failed to load pipeline status', err)
      }
    }

    loadInitial()
    return () => {
      mounted = false
    }
  }, [project.id])

  const {
    data: pipelineEvent,
    // isConnected,
    // error,
  } = useSSE<PipelineEventPayload>(`/api/pipeline/${project.id}/events`)

  useEffect(() => {
    if (!pipelineEvent) return
    setPipelines((prev) => mergeStageUpdate(prev, pipelineEvent))
  }, [pipelineEvent, onOverallProgressChange, onSummaryChange])

  useEffect(() => {
    onOverallProgressChange?.(computeOverallProgress(pipelines))
    onSummaryChange?.(summarizeStages(pipelines))
  }, [pipelines, onOverallProgressChange, onSummaryChange])

  return <Pipelines pipelines={pipelines} />
}

export default PipelineContainer

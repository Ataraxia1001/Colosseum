import type { ReactNode } from 'react'

export type Provider = 'openai' | 'anthropic' | 'google'

export type ProviderRank = Record<Provider, number>

export type ProviderColorMap = Record<Provider, string>

export type ProviderIconMap = Record<Provider, ReactNode>

export interface ResponseItem {
  provider: Provider
  content?: string
  model?: string
  error?: string
}

export interface CritiqueItem {
  provider: Provider
  content?: string
  error?: string
}

export interface Evaluation {
  provider: Provider | 'pairwise' | string
  component: string
  error?: string
  winner?: Provider
  contestants?: Provider[]
  scores?: Record<string, number>
}

export interface Summary {
  summary?: string
  error?: string
  winner?: Provider
  is_tie?: boolean
}

export interface UserTurn {
  role: 'user'
  content: string
}

export interface AssistantTurn {
  role: 'assistant'
  responses: ResponseItem[]
  critiques: CritiqueItem[]
  evaluations: Evaluation[]
  summary: Summary | null
}

export type ChatTurn = UserTurn | AssistantTurn

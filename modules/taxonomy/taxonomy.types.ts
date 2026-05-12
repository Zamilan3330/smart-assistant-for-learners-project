export interface KnowledgeUnit {
  id: string
  name: string
  topics: string[]
}

export interface KnowledgeArea {
  id: string
  name: string
  description: string
  units: KnowledgeUnit[]
}

export interface ClassificationResult {
  kaCode: string
  kuCode: string
}

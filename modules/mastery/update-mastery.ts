/**
 * modules/mastery/update-mastery.ts
 *
 * Core evidence-based mastery update logic.
 *
 * Flow (per diploma thesis §1.6.3):
 *   1. Resolve KU by code → get KA
 *   2. Write MasteryEvidence log row
 *   3. Upsert UserKuMastery: newScore = clamp(old + delta, 0, 1)
 *   4. Recompute UserMastery (KA aggregate = average of its KU scores)
 */

import { prisma } from "../../lib/db/prisma";
import {
  EVIDENCE_WEIGHTS,
  type EvidenceResult,
  type RecordEvidenceParams,
} from "./mastery.types";

const CONFIDENCE_SATURATION = 10;

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function toNum(d: { toString(): string } | null | undefined): number {
  return d ? Number(d.toString()) : 0;
}

export async function recordEvidence(
  params: RecordEvidenceParams,
): Promise<EvidenceResult | null> {
  const delta = EVIDENCE_WEIGHTS[params.evidenceType];

  const ku = await prisma.knowledgeUnit.findUnique({
    where: { kuCode: params.kuCode },
    select: { id: true, knowledgeAreaId: true },
  });
  if (!ku) {
    console.warn(`[mastery] unknown kuCode: ${params.kuCode}`);
    return null;
  }

  await prisma.masteryEvidence.create({
    data: {
      userId: params.userId,
      sessionId: params.sessionId,
      messageId: params.messageId,
      knowledgeAreaId: ku.knowledgeAreaId,
      knowledgeUnitId: ku.id,
      evidenceType: params.evidenceType,
      scoreDelta: delta,
      confidenceDelta: Math.abs(delta) / 2,
      evidenceText: params.evidenceText,
      metadata: params.metadata as never,
    },
  });

  const existing = await prisma.userKuMastery.findUnique({
    where: {
      userId_knowledgeUnitId: { userId: params.userId, knowledgeUnitId: ku.id },
    },
  });

  const oldScore = toNum(existing?.masteryScore);
  const newCount = (existing?.evidenceCount ?? 0) + 1;
  const newScore = clamp01(oldScore + delta);
  const newConfidence = clamp01(newCount / CONFIDENCE_SATURATION);
  const now = new Date();

  await prisma.userKuMastery.upsert({
    where: {
      userId_knowledgeUnitId: { userId: params.userId, knowledgeUnitId: ku.id },
    },
    create: {
      userId: params.userId,
      knowledgeUnitId: ku.id,
      masteryScore: newScore,
      confidenceScore: newConfidence,
      evidenceCount: newCount,
      lastAssessedAt: now,
    },
    update: {
      masteryScore: newScore,
      confidenceScore: newConfidence,
      evidenceCount: newCount,
      lastAssessedAt: now,
    },
  });

  await recomputeKaMastery(params.userId, ku.knowledgeAreaId);

  return {
    kuCode: params.kuCode,
    evidenceType: params.evidenceType,
    oldScore,
    newScore,
    delta,
    evidenceCount: newCount,
  };
}

/**
 * KA score = arithmetic mean of the user's KU scores within that KA.
 * Matches diploma thesis §1.5.4 ("KA-ийн ерөнхий төлөвийг KU-уудын дундажаар").
 */
export async function recomputeKaMastery(
  userId: bigint,
  knowledgeAreaId: bigint,
): Promise<void> {
  const totalKuCount = await prisma.knowledgeUnit.count({
    where: { knowledgeAreaId },
  });
  if (totalKuCount === 0) return;

  const kuRows = await prisma.userKuMastery.findMany({
    where: { userId, knowledgeUnit: { knowledgeAreaId } },
    select: { masteryScore: true, confidenceScore: true, evidenceCount: true },
  });

  // Divide by totalKuCount (not kuRows.length) so unstudied KUs count as 0
  // KA score = KU score-уудын дундаж
  const avgScore =
    kuRows.reduce((a, r) => a + toNum(r.masteryScore), 0) / totalKuCount;
  const avgConfidence =
    kuRows.reduce((a, r) => a + toNum(r.confidenceScore), 0) / totalKuCount;
  const totalEvidence = kuRows.reduce((a, r) => a + r.evidenceCount, 0);
  const now = new Date();

  await prisma.userMastery.upsert({
    where: { userId_knowledgeAreaId: { userId, knowledgeAreaId } },
    create: {
      userId,
      knowledgeAreaId,
      masteryScore: avgScore,
      confidenceScore: avgConfidence,
      evidenceCount: totalEvidence,
      lastAssessedAt: now,
    },
    update: {
      masteryScore: avgScore,
      confidenceScore: avgConfidence,
      evidenceCount: totalEvidence,
      lastAssessedAt: now,
    },
  });
}

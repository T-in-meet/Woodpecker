import { z } from "zod";

/** Related Notes AI 실행 Snapshot의 정본 Zod schema입니다. */
export const relatedNotesSnapshotsSchema = z.object({
  schemaVersion: z.literal(1),
  sourceInput: z.object({
    input: z.object({
      note: z.object({
        id: z.string().uuid(),
        title: z.string(),
        content: z.string(),
        updatedAt: z.string(),
      }),
    }),
  }),
  queryExpansion: z
    .object({
      input: z.object({
        source: z.object({ title: z.string(), content: z.string() }),
        variables: z.object({ title: z.string(), content: z.string() }),
        renderedSystemPrompt: z.string(),
        renderedUserPrompt: z.string(),
      }),
      configuration: z.object({
        model: z.object({
          id: z.string().uuid(),
          provider: z.string(),
          model: z.string(),
          settings: z.record(z.string(), z.unknown()).optional(),
        }),
        prompt: z.object({
          agent: z.record(z.string(), z.unknown()),
          family: z.record(z.string(), z.unknown()),
          version: z.record(z.string(), z.unknown()),
        }),
        temperature: z.number(),
        responseFormat: z.unknown().optional(),
      }),
      output: z
        .object({
          rawResponse: z.string(),
          providerMetadata: z.unknown(),
          parsed: z.object({ expandedQuery: z.string() }).optional(),
        })
        .optional(),
      usage: z
        .object({
          inputTokens: z.number().nonnegative(),
          outputTokens: z.number().nonnegative(),
          totalTokens: z.number().nonnegative(),
        })
        .optional(),
      error: z
        .object({
          type: z.string().optional(),
          message: z.string(),
          issues: z.array(z.unknown()).optional(),
        })
        .optional(),
    })
    .optional(),
  exclusions: z
    .object({
      input: z.object({ targetNoteId: z.string().uuid() }),
      configuration: z.object({
        excludeManual: z.boolean(),
        excludeDismissedAi: z.boolean(),
        excludeActiveAi: z.boolean(),
        resolveRelationBidirectionally: z.boolean(),
        excludeTargetNote: z.boolean(),
      }),
      output: z
        .object({
          excludedRelatedNoteIds: z.array(z.string().uuid()),
          excludeSourceIds: z.array(z.string().uuid()),
        })
        .optional(),
      error: z
        .object({
          type: z.string().optional(),
          message: z.string(),
          issues: z.array(z.unknown()).optional(),
        })
        .optional(),
    })
    .optional(),
  retrieval: z
    .object({
      input: z.object({
        inputText: z.string(),
        excludeSourceIds: z.array(z.string().uuid()),
      }),
      configuration: z.object({
        embeddingModel: z.object({
          id: z.string().uuid(),
          provider: z.string(),
          model: z.string(),
          dimensions: z.number().int().positive().nullable(),
          settings: z.record(z.string(), z.unknown()).optional(),
        }),
        search: z.object({
          limit: z.number().int().positive(),
          minSimilarity: z.number(),
          sourceType: z.string(),
          inputKind: z.string(),
        }),
      }),
      embedding: z
        .object({
          providerMetadata: z.unknown(),
          usage: z.object({
            inputTokens: z.number().nonnegative(),
            outputTokens: z.number().nonnegative(),
            totalTokens: z.number().nonnegative(),
          }),
        })
        .optional(),
      searchResult: z
        .object({
          matches: z.array(
            z.object({
              embeddingId: z.string().uuid(),
              sourceId: z.string().uuid(),
              chunkIndex: z.number().int().nonnegative(),
              similarity: z.number(),
              distance: z.number(),
            }),
          ),
        })
        .optional(),
      hydratedCandidates: z
        .array(
          z.object({
            noteId: z.string().uuid(),
            title: z.string(),
            chunkText: z.string(),
            embeddingId: z.string().uuid(),
            similarity: z.number(),
            distance: z.number(),
          }),
        )
        .optional(),
      output: z.object({ context: z.string() }).optional(),
      error: z
        .object({
          type: z.string().optional(),
          message: z.string(),
          issues: z.array(z.unknown()).optional(),
        })
        .optional(),
    })
    .optional(),
  answerGeneration: z
    .union([
      z.object({
        input: z.object({
          source: z.object({ title: z.string(), content: z.string() }),
          matchedCandidateIndexes: z
            .array(z.number().int().nonnegative())
            .optional(),
          context: z.string(),
          variables: z.object({
            title: z.string(),
            content: z.string(),
            context: z.string(),
          }),
          renderedSystemPrompt: z.string(),
          renderedUserPrompt: z.string(),
        }),
        configuration: z.object({
          model: z.object({
            id: z.string().uuid(),
            provider: z.string(),
            model: z.string(),
            settings: z.record(z.string(), z.unknown()).optional(),
          }),
          prompt: z.object({
            agent: z.record(z.string(), z.unknown()),
            family: z.record(z.string(), z.unknown()),
            version: z.record(z.string(), z.unknown()),
          }),
          temperature: z.number(),
          responseFormat: z.unknown().optional(),
        }),
        output: z
          .object({
            rawResponse: z.string(),
            providerMetadata: z.unknown(),
            parsed: z
              .object({
                recommendations: z.array(
                  z.object({
                    noteId: z.string().uuid(),
                    reason: z.string(),
                  }),
                ),
              })
              .optional(),
          })
          .optional(),
        postProcessing: z
          .object({
            resolvedRecommendations: z.array(
              z.object({
                noteId: z.string().uuid(),
                title: z.string(),
                reason: z.string(),
              }),
            ),
          })
          .optional(),
        usage: z
          .object({
            inputTokens: z.number().nonnegative(),
            outputTokens: z.number().nonnegative(),
            totalTokens: z.number().nonnegative(),
          })
          .optional(),
        error: z
          .object({
            type: z.string().optional(),
            message: z.string(),
            issues: z.array(z.unknown()).optional(),
          })
          .optional(),
      }),
      z.object({ skipped: z.object({ reason: z.literal("no_candidates") }) }),
    ])
    .optional(),
  verification: z
    .union([
      z.object({
        input: z.object({
          source: z.object({ title: z.string(), content: z.string() }),
          recommendations: z.array(
            z.object({
              noteId: z.string().uuid(),
              title: z.string(),
              reason: z.string(),
            }),
          ),
          matchedCandidateIndexes: z
            .array(z.number().int().nonnegative())
            .optional(),
          context: z.string(),
          variables: z.object({
            title: z.string(),
            content: z.string(),
            recommendations: z.string(),
          }),
          renderedSystemPrompt: z.string(),
          renderedUserPrompt: z.string(),
        }),
        configuration: z.object({
          model: z.object({
            id: z.string().uuid(),
            provider: z.string(),
            model: z.string(),
            settings: z.record(z.string(), z.unknown()).optional(),
          }),
          prompt: z.object({
            agent: z.record(z.string(), z.unknown()),
            family: z.record(z.string(), z.unknown()),
            version: z.record(z.string(), z.unknown()),
          }),
          temperature: z.number(),
          responseFormat: z.unknown().optional(),
        }),
        output: z
          .object({
            rawResponse: z.string(),
            providerMetadata: z.unknown(),
            parsed: z
              .object({
                verifications: z.array(
                  z.object({
                    noteId: z.string().uuid(),
                    approved: z.boolean(),
                    reason: z.string(),
                  }),
                ),
              })
              .optional(),
          })
          .optional(),
        postProcessing: z
          .object({
            idConsistency: z
              .object({
                expectedNoteIds: z.array(z.string().uuid()),
                actualNoteIds: z.array(z.string().uuid()),
                hasDuplicate: z.boolean(),
                hasMissing: z.boolean(),
                hasUnknown: z.boolean(),
              })
              .optional(),
            orderedVerifications: z
              .array(
                z.object({
                  noteId: z.string().uuid(),
                  approved: z.boolean(),
                  reason: z.string(),
                }),
              )
              .optional(),
            recommendations: z
              .array(
                z.object({ noteId: z.string().uuid(), reason: z.string() }),
              )
              .optional(),
          })
          .optional(),
        usage: z
          .object({
            inputTokens: z.number().nonnegative(),
            outputTokens: z.number().nonnegative(),
            totalTokens: z.number().nonnegative(),
          })
          .optional(),
        error: z
          .object({
            type: z.string().optional(),
            message: z.string(),
            issues: z.array(z.unknown()).optional(),
          })
          .optional(),
      }),
      z.object({
        skipped: z.object({
          reason: z.enum(["no_candidates", "no_recommendations"]),
        }),
      }),
    ])
    .optional(),
  finalOutput: z
    .object({
      recommendations: z.array(
        z.object({ noteId: z.string().uuid(), reason: z.string() }),
      ),
    })
    .optional(),
});

/** 검증된 Related Notes AI 실행 Snapshot 타입입니다. */
export type RelatedNotesSnapshots = z.infer<typeof relatedNotesSnapshotsSchema>;

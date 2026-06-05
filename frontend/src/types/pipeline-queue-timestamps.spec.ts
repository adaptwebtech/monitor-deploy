import { describe, it, expectTypeOf } from "vitest";
import type { PipelineQueue } from "./index";

describe("PipelineQueue type — pipeline-queue-timestamps", () => {
  it("AC-10: PipelineQueue has startedAt: string | null", () => {
    expectTypeOf<PipelineQueue["startedAt"]>().toEqualTypeOf<string | null>();
  });

  it("AC-10: PipelineQueue has finalizedAt: string | null", () => {
    expectTypeOf<PipelineQueue["finalizedAt"]>().toEqualTypeOf<string | null>();
  });

  it("AC-10: a full PipelineQueue object with null timestamps is valid", () => {
    const pipeline: PipelineQueue = {
      id: "p1",
      app: "my-app",
      environment: "production",
      commitSha: "abc1234",
      commitMessage: "fix: something",
      commitAuthor: "Dev",
      commitAuthorAvatar: null,
      status: "Queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      finalizedAt: null,
    };
    expectTypeOf(pipeline.startedAt).toEqualTypeOf<string | null>();
    expectTypeOf(pipeline.finalizedAt).toEqualTypeOf<string | null>();
  });

  it("AC-10: a full PipelineQueue object with non-null timestamps is valid", () => {
    const pipeline: PipelineQueue = {
      id: "p1",
      app: "my-app",
      environment: "production",
      commitSha: "abc1234",
      commitMessage: "fix: something",
      commitAuthor: "Dev",
      commitAuthorAvatar: null,
      status: "Completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
    };
    expectTypeOf(pipeline.startedAt).toEqualTypeOf<string | null>();
    expectTypeOf(pipeline.finalizedAt).toEqualTypeOf<string | null>();
  });
});

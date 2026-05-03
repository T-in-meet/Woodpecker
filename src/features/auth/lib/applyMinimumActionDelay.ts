import { MIN_RESPONSE_MS } from "./applyMinimumResponseTime";

export async function applyMinimumActionDelay(start: number): Promise<void> {
  const elapsed = Date.now() - start;
  const remaining = MIN_RESPONSE_MS - elapsed;

  if (remaining <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, remaining);
  });
}

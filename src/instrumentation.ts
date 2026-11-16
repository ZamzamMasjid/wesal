// Next.js calls register() once when the server starts. The job loop runs in
// the Node.js runtime only (ADR-009), and can be switched off with JOBS=off.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.JOBS === "off") return;
  const { startJobs } = await import("./jobs/start");
  startJobs();
}

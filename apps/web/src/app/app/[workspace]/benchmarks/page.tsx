import { BenchmarkWorkspace } from "@/components/benchmarks/benchmark-workspace";

export default async function BenchmarksPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return <BenchmarkWorkspace workspace={workspace} />;
}

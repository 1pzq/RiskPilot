import { RiskPilotApp } from '@/frontend/components/riskpilot-app';
import type { DemoSection } from '@/frontend/components/app-shell';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const demoSections: DemoSection[] = ['overview', 'risk', 'strategy', 'audit', 'prepare'];

function normalizeSection(value: string | string[] | undefined): DemoSection {
  const section = Array.isArray(value) ? value[0] : value;

  return demoSections.includes(section as DemoSection) ? (section as DemoSection) : 'overview';
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const demo = Array.isArray(params?.demo) ? params.demo[0] : params?.demo;

  return <RiskPilotApp initialJudgeDemo={demo === 'judge'} initialSection={normalizeSection(params?.stage)} />;
}

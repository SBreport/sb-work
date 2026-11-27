import type { Metadata } from 'next';

// 설문 링크는 주소 자체가 열쇠다 — 검색에 잡히지 않게 하고, 다른 사이트로 주소가 새지 않게 한다.
export const metadata: Metadata = {
  title: '병원 사전 설문',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import { redirect } from 'next/navigation';

// 옛 주소 — 설문 화면은 /surveys로 옮겼다(직원 역할도 쓰도록).
export default function Page() {
  redirect('/surveys');
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /freelancer → /my 리다이렉트 (하위 호환)
export default function FreelancerRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/my'); }, [router]);
  return null;
}

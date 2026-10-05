'use client';

import {useRouter} from 'next/navigation';

export default function AccountCancelButton() {
  const router = useRouter();
  return <button
    type="button"
    className="btn btn-md btn-default"
    onClick={() => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        router.replace('/');
      }
    }}
  >
    <span className="btn-icon">×</span> Annulla
  </button>;
}

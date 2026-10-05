import Link from 'next/link';

export default function DetailBackButton({ href }: { href: string }) {
  return <Link data-page-transition="backward" className="btn btn-sm btn-ghost detail-back-button" href={href} replace>
    <span className="btn-icon">↩</span> Indietro
  </Link>;
}

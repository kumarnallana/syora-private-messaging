import { Heart } from 'lucide-react';

export function LogoMark() {
  return <span className="logo-mark" aria-hidden="true"><Heart size={21} strokeWidth={2.25} fill="currentColor" /></span>;
}

export function Brand() {
  return <span className="brand-logo"><LogoMark/><span>SYORA<span className="brand-logo__dot">.</span></span></span>;
}

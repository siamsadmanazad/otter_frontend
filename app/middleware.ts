import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export default auth((req: any) => {
  const pathname = req.url;
  
  if (req.auth && pathname === '/') {
    return NextResponse.redirect(new URL('/feed', req.url));
  }
});

export const config = {
  matcher: ['/'],
};
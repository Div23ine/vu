import { type NextRequest, NextResponse } from 'next/server';
import { env } from './env';
import { buildCsp } from './lib/csp';

function nonce():string {
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 let binary='';
 for(const byte of bytes) binary+=String.fromCharCode(byte);
 return btoa(binary);
}

export default function middleware(request:NextRequest):NextResponse {
 const value=nonce();
 const policy=buildCsp({nonce:value,apiOrigin:env.NEXT_PUBLIC_API_URL,dev:process.env.NODE_ENV==='development'});
 const headers=new Headers(request.headers);
 headers.set('x-nonce',value);
 headers.set('content-security-policy',policy);
 const response=NextResponse.next({request:{headers}});
 response.headers.set('content-security-policy',policy);
 return response;
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
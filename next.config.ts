import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode:true,
  // Keep the project as the tracing root, even when Windows home has another package-lock.json.
  outputFileTracingRoot: process.cwd(),
  async headers(){
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      {key:'Content-Security-Policy',value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'"},
      ...(process.env.NODE_ENV==='production' ? [{key:'Strict-Transport-Security',value:'max-age=31536000'}] : [])
    ]}];
  }
};
export default nextConfig;

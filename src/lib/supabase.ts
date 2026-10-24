import { createClient } from '@supabase/supabase-js';

/**
 * Auth/Storage client restricted to server code. Never use Supabase data APIs
 * from a browser. Anon key is used solely for Supabase Auth's verified OAuth.
 */
export function googleAuthClient(saved?:Record<string,string>) {
  const url=process.env.SUPABASE_URL;
  const anon=process.env.SUPABASE_ANON_KEY;
  if(!url||!anon)throw new Error('Google authentication is not configured.');
  const pkceValues=new Map<string,string>(Object.entries(saved??{}));
  const client=createClient(url,anon,{
    auth:{
      flowType:'pkce',persistSession:true,autoRefreshToken:false,
      detectSessionInUrl:false,
      storage:{
        getItem:(key)=>pkceValues.get(key)??null,
        setItem:(key,value)=>{pkceValues.set(key,value);},
        removeItem:(key)=>{pkceValues.delete(key);}
      }
    }
  });
  return {client,pkceValues};
}

export function storageAdmin(){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Supabase Storage service credentials are missing.');
  return createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
}

export function googleConfigured(){
  return Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY&&process.env.APP_URL);
}
export function storageConfigured(){
  return Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
}
export const STORAGE_BUCKET='condovery-media';

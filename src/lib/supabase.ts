import { createClient } from '@supabase/supabase-js';

/**
 * No Supabase Auth tokens or database access credentials are exposed to the UI.
 * Only server routes invoke these clients. The browser authenticates with the
 * Condovery HttpOnly session cookie after Supabase Auth validates the identity.
 */
function environment() {
  const url=process.env.SUPABASE_URL;
  const anon=process.env.SUPABASE_ANON_KEY;
  if(!url||!anon)throw new Error('Supabase Auth is not configured.');
  return {url,anon};
}

export function passwordAuthClient(){
  const {url,anon}=environment();
  return createClient(url,anon,{
    auth:{flowType:'implicit',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
}

export function googleAuthClient(saved?:Record<string,string>) {
  const {url,anon}=environment();
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
  if(!url||!key)throw new Error('Supabase service credentials are missing.');
  return createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
}

export const emailConfigured=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY&&process.env.APP_URL);
export const recoveryConfigured=()=>emailConfigured()&&Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
export const googleConfigured=emailConfigured;
export const storageConfigured=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
export const STORAGE_BUCKET='condovery-media';

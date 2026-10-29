/** Used by browser API requests to distinguish stale responses from the active login. */
let generation=0;
export const SESSION_EXPIRED_EVENT='condovery:session-expired';
export const currentSessionGeneration=()=>generation;
export const advanceSessionGeneration=()=>++generation;

export function sessionWasRevoked(
  status:number,path:string,method:string,requestGeneration:number,
):boolean {
  if(status!==401||requestGeneration!==generation)return false;
  // Invalid credentials, recovery flows, and a wrong account-deletion
  // password do not mean the already logged-in session has expired.
  if(path.startsWith('auth/')||path.startsWith('public/'))return false;
  if(path==='me'&&method==='DELETE')return false;
  return true;
}

import {createHmac} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {transaction,query} from '@/lib/db';
import {bad} from '@/lib/api-error';

type Action='login'|'registration'|'recovery'|'invitation'|'oauth';
type Config={windowMinutes:number;maxIdentifier:number;maxAddress:number};
const configs:Record<Action,Config>={
  login:{windowMinutes:15,maxIdentifier:8,maxAddress:30},
  registration:{windowMinutes:60,maxIdentifier:4,maxAddress:20},
  recovery:{windowMinutes:60,maxIdentifier:3,maxAddress:15},
  invitation:{windowMinutes:15,maxIdentifier:12,maxAddress:40},
  oauth:{windowMinutes:15,maxIdentifier:20,maxAddress:20}
};

/** An HMAC digest cannot be searched with a dictionary without the server secret. */
export function rateFingerprint(secret:string,action:Action,kind:'id'|'ip',value:string){
  return createHmac('sha256',secret).update('condovery-auth-rate-v1\0'+action+'\0'+kind+'\0'+value).digest('hex');
}
function secret(){
  const key=process.env.AUTH_RATE_LIMIT_SECRET;
  if(!key||Buffer.byteLength(key,'utf8')<32)throw new Error('AUTH_RATE_LIMIT_SECRET must be at least 32 bytes');
  return key;
}
function address(req:NextRequest){
  // Deploy behind a trusted proxy that OVERWRITES x-real-ip (do not let
  // clients supply this header). Per-account limits remain the main defense.
  const candidate=req.headers.get('x-real-ip')||req.headers.get('cf-connecting-ip')||'unknown';
  const value=candidate.trim();
  return value.length>0&&value.length<=80&&!/[\s,]/.test(value)?value:'unknown';
}
export async function limitAuthentication(req:NextRequest,action:Action,identifier:string){
  const key=secret(),config=configs[action];
  const ip=address(req);
  // Invitation codes and OAuth entry are shared resources, not user accounts.
  // Never lock out an entire condominium because many neighbors sign up.
  const subject=action==='invitation'||action==='oauth'?identifier+':'+ip:identifier.trim().toLowerCase();
  const accountHash=rateFingerprint(key,action,'id',subject);
  const ipHash=rateFingerprint(key,action,'ip',ip);
  const targets=[accountHash,ipHash].sort();
  // Serialize requests for both fingerprints so parallel guesses cannot
  // bypass count-then-insert, even on multiple Next.js instances.
  await transaction(async tx=>{
    for(const hash of targets){
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[hash]);
    }
    const counts=await tx.query<{subject_hash:string;total:number}>(
      "SELECT subject_hash,count(*)::int AS total FROM auth_rate_events "+
      "WHERE action=$1 AND subject_hash=ANY($2::char(64)[]) "+
      "AND occurred_at>now()-($3::int*interval '1 minute') GROUP BY subject_hash",
      [action,targets,config.windowMinutes]
    );
    const used=new Map(counts.rows.map(r=>[r.subject_hash.trim(),Number(r.total)]));
    if((used.get(accountHash)||0)>=config.maxIdentifier||(used.get(ipHash)||0)>=config.maxAddress)
      bad('Muitas tentativas. Tente novamente mais tarde.',429);
    await tx.query(
      "INSERT INTO auth_rate_events(action,subject_hash) VALUES($1,$2),($1,$3)",
      [action,accountHash,ipHash]);
  });
}
export async function clearAuthenticationFailures(action:Action,identifier:string){
  const digest=rateFingerprint(secret(),action,'id',identifier.trim().toLowerCase());
  // Do not clear address-wide events; they protect against password spraying.
  await query('DELETE FROM auth_rate_events WHERE action=$1 AND subject_hash=$2',[action,digest]);
}

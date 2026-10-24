// Standalone local stub for deterministic API integration tests.
// Never run in production; intended only for the isolated GitHub Actions job.
import http from 'node:http';
import crypto from 'node:crypto';

const users=new Map();
const recovery=new Map();
function userOut(u){return {id:u.id,email:u.email,email_confirmed_at:u.confirmed?new Date().toISOString():null,confirmed_at:u.confirmed?new Date().toISOString():null,
 identities:[{id:u.id,user_id:u.id,provider:'email'}],user_metadata:{name:u.name||''},app_metadata:{provider:'email'}};}
function send(res,status,data){
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:3333');
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const raw=Buffer.concat(chunks).toString('utf8');
  let body={};if(raw)body=JSON.parse(raw);
  if(url.pathname==='/health')return send(res,200,{ok:true});
  if(url.pathname==='/__test/confirm'){
    const u=users.get(url.searchParams.get('email'));if(!u)return send(res,404,{error:'not found'});
    u.confirmed=true;return send(res,200,{confirmed:true});
  }
  if(url.pathname==='/__test/recovery'){
    const token=recovery.get(url.searchParams.get('email'));
    return token?send(res,200,{token_hash:token}):send(res,404,{error:'no recovery'});
  }
  if(url.pathname==='/auth/v1/admin/users'&&req.method==='GET'){
    return send(res,200,{users:[...users.values()].map(userOut),aud:'authenticated'});
  }
  if(url.pathname==='/auth/v1/admin/users'&&req.method==='POST'){
    if(users.has(body.email))return send(res,422,{code:'email_exists',msg:'existing'});
    const u={id:crypto.randomUUID(),email:body.email,password:body.password,confirmed:body.email_confirm===true,name:body.user_metadata?.name};
    users.set(u.email,u);return send(res,200,userOut(u));
  }
  if(url.pathname.startsWith('/auth/v1/admin/users/')&&req.method==='PUT'){
    const id=url.pathname.split('/').at(-1);
    const u=[...users.values()].find(x=>x.id===id);
    if(!u)return send(res,404,{code:'user_not_found',msg:'not found'});
    if(body.password)u.password=body.password;
    return send(res,200,userOut(u));
  }
  if(url.pathname==='/auth/v1/signup'&&req.method==='POST'){
    if(users.has(body.email))return send(res,200,{user:{id:crypto.randomUUID(),email:body.email,identities:[]},session:null});
    const u={id:crypto.randomUUID(),email:body.email,password:body.password,confirmed:false,name:body.data?.name};
    users.set(u.email,u);
    return send(res,200,{user:userOut(u),session:null});
  }
  if(url.pathname==='/auth/v1/token'&&req.method==='POST'){
    const u=users.get(body.email);
    if(!u||body.password!==u.password)return send(res,400,{code:'invalid_credentials',msg:'Invalid login credentials'});
    if(!u.confirmed)return send(res,400,{code:'email_not_confirmed',msg:'Email not confirmed'});
    return send(res,200,{access_token:'mock-'+u.id,refresh_token:'mock-refresh',token_type:'bearer',expires_in:3600,user:userOut(u)});
  }
  if(url.pathname==='/auth/v1/recover'&&req.method==='POST'){
    const u=users.get(body.email);
    if(u){const token=crypto.randomBytes(24).toString('hex');recovery.set(u.email,token);}
    return send(res,200,{});
  }
  if(url.pathname==='/auth/v1/verify'&&req.method==='POST'){
    const found=[...recovery.entries()].find(([,token])=>token===body.token_hash);
    const u=found?users.get(found[0]):null;
    if(!u||body.type!=='recovery')return send(res,403,{code:'otp_expired',msg:'expired'});
    recovery.delete(u.email);
    return send(res,200,{access_token:'mock-'+u.id,refresh_token:'mock-refresh',token_type:'bearer',expires_in:3600,user:userOut(u)});
  }
  if(url.pathname==='/auth/v1/user'&&req.method==='GET'){
    const id=(req.headers.authorization||'').replace(/^Bearer mock-/,'');
    const u=[...users.values()].find(x=>x.id===id);
    return u?send(res,200,userOut(u)):send(res,401,{code:'not_authorized',msg:'no'});
  }
  return send(res,404,{code:'not_found',msg:'Mock endpoint not implemented: '+req.method+' '+url.pathname});
 }catch(e){return send(res,500,{code:'mock_error',msg:e.message});}
});
server.listen(3333,'127.0.0.1',()=>console.log('Supabase Auth stub ready on 127.0.0.1:3333'));

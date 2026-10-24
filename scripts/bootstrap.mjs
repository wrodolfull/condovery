import pg from 'pg';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const required=[
  'DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY',
  'BOOTSTRAP_ADMIN_EMAIL','BOOTSTRAP_ADMIN_PASSWORD','BOOTSTRAP_CONDO_NAME',
  'BOOTSTRAP_CONDO_SLUG','BOOTSTRAP_INVITE_CODE'
];
for(const key of required)if(!process.env[key])throw new Error('Missing '+key);
if(process.env.BOOTSTRAP_ADMIN_PASSWORD.length<12)throw new Error('Administrator password must have at least 12 characters.');
if(process.env.BOOTSTRAP_INVITE_CODE.length<10)throw new Error('Invite code must have at least 10 characters.');

const email=process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
const adminAuth=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const db=new pg.Client({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:false
});
await db.connect();
try{
  // The administrator's identity is always owned by Supabase Auth.
  // Existing Auth accounts are kept unchanged. Never reset their password.
  let authId;
  let page=1;
  while(!authId){
    const {data,error}=await adminAuth.auth.admin.listUsers({page,perPage:100});
    if(error)throw new Error('Unable to list Supabase Auth administrators: '+error.message);
    const found=data.users.find(u=>u.email?.toLowerCase()===email);
    if(found){authId=found.id;break;}
    if(data.users.length<100)break;
    if(++page>100)throw new Error('Too many Auth users to bootstrap automatically.');
  }
  if(!authId){
    const {data,error}=await adminAuth.auth.admin.createUser({
      email,password:process.env.BOOTSTRAP_ADMIN_PASSWORD,email_confirm:true,
      user_metadata:{name:'Administrador'}
    });
    if(error||!data.user)throw new Error('Supabase admin provisioning failed: '+(error?.message??'unknown'));
    authId=data.user.id;
  }
  await db.query('BEGIN');
  const slug=process.env.BOOTSTRAP_CONDO_SLUG.trim().toLowerCase();
  const inviteHash=crypto.createHash('sha256').update(process.env.BOOTSTRAP_INVITE_CODE.trim()).digest('hex');
  const towers=Array.from({length:23},(_,i)=>'Torre '+(i+1));
  const condo=await db.query(
    'INSERT INTO condominiums(name,slug,invite_code_hash,towers) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id',
    [process.env.BOOTSTRAP_CONDO_NAME,slug,inviteHash,JSON.stringify(towers)]
  );
  const condoId=condo.rows[0].id;
  await db.query(
    "INSERT INTO users(condominium_id,name,email,phone,password_hash,supabase_auth_user_id,role,status,tower,apartment) VALUES($1,'Administrador',$2,'',NULL,$3,'admin','approved','Admin','Admin') ON CONFLICT(email) DO UPDATE SET supabase_auth_user_id=EXCLUDED.supabase_auth_user_id WHERE users.supabase_auth_user_id IS NULL OR users.supabase_auth_user_id=EXCLUDED.supabase_auth_user_id",
    [condoId,email,authId]
  );
  const identity=await db.query('SELECT supabase_auth_user_id,role FROM users WHERE email=$1',[email]);
  if(identity.rows[0]?.supabase_auth_user_id!==authId||identity.rows[0].role!=='admin'){
    throw new Error('Administrator identity conflict; manual resolution required.');
  }
  const categories=[['Bolos e doces','cake-slice'],['Pães e salgados','sandwich'],['Refeições','utensils'],['Bebidas','coffee'],['Beleza','sparkles'],['Moda','shirt'],['Presentes','gift'],['Outros','shopping-bag']];
  for(let i=0;i<categories.length;i++)await db.query(
    'INSERT INTO categories(condominium_id,name,icon,sort_order) VALUES($1,$2,$3,$4) ON CONFLICT(condominium_id,name) DO NOTHING',
    [condoId,categories[i][0],categories[i][1],i]
  );
  await db.query('COMMIT');
  console.log('Condovery bootstrap finished for '+slug+' (administrator managed by Supabase Auth).');
}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}
finally{await db.end();}

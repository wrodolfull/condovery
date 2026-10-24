import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const required = ['DATABASE_URL','BOOTSTRAP_ADMIN_EMAIL','BOOTSTRAP_ADMIN_PASSWORD','BOOTSTRAP_CONDO_NAME','BOOTSTRAP_CONDO_SLUG','BOOTSTRAP_INVITE_CODE'];
for (const key of required) if (!process.env[key]) throw new Error('Missing ' + key);
if (process.env.BOOTSTRAP_ADMIN_PASSWORD.length < 12) throw new Error('Administrator password must have at least 12 characters.');
if (process.env.BOOTSTRAP_INVITE_CODE.length < 10) throw new Error('Invite code must have at least 10 characters.');
const client = new pg.Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL === 'true' ? {rejectUnauthorized:true}:false});
await client.connect();
try {
  await client.query('BEGIN');
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
  const slug = process.env.BOOTSTRAP_CONDO_SLUG.trim().toLowerCase();
  const codeHash = crypto.createHash('sha256').update(process.env.BOOTSTRAP_INVITE_CODE.trim()).digest('hex');
  const towers = Array.from({length:23},(_,i)=>'Torre '+(i+1));
  const condominium = await client.query(
    'INSERT INTO condominiums(name,slug,invite_code_hash,towers) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id',
    [process.env.BOOTSTRAP_CONDO_NAME,slug,codeHash,JSON.stringify(towers)]
  );
  const condoId=condominium.rows[0].id;
  const hash=await bcrypt.hash(process.env.BOOTSTRAP_ADMIN_PASSWORD,12);
  await client.query(
    "INSERT INTO users(condominium_id,name,email,phone,password_hash,role,status,tower,apartment) VALUES($1,'Administrador',$2,'', $3,'admin','approved','Admin','Admin') ON CONFLICT(email) DO NOTHING",
    [condoId,email,hash]
  );
  const cat=[['Bolos e doces','cake-slice'],['Pães e salgados','sandwich'],['Refeições','utensils'],['Bebidas','coffee'],['Beleza','sparkles'],['Moda','shirt'],['Presentes','gift'],['Outros','shopping-bag']];
  for(let i=0;i<cat.length;i++) await client.query(
    'INSERT INTO categories(condominium_id,name,icon,sort_order) VALUES($1,$2,$3,$4) ON CONFLICT(condominium_id,name) DO NOTHING',
    [condoId,cat[i][0],cat[i][1],i]
  );
  await client.query('COMMIT');
  console.log('Condovery ready: condominium ' + slug + ' and initial administrator ' + email + '.');
  console.log('Share the invite code privately; the application never displays its stored hash.');
} catch(e){await client.query('ROLLBACK');throw e;} finally{await client.end();}

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
const expected=[
  'Bolos e doces','Pães e salgados','Refeições','Bebidas','Lanches',
  'Sobremesas e sorvetes','Mercadinho'
];
try{
  // Legacy tenant fixture with only the original eight categories.
  const tenant=await db.query(
    "INSERT INTO condominiums(name,slug,invite_code_hash,towers) VALUES($1,$2,$3,'[]'::jsonb) RETURNING id",
    ['Condomínio Legado de Teste','legacy-categories-ci',crypto.createHash('sha256').update('CIOnlyLegacyInvite123').digest('hex')]
  );
  const id=tenant.rows[0].id;
  const legacy=[
    ['Bolos e doces','cake-slice'],['Pães e salgados','sandwich'],
    ['Refeições','utensils'],['Bebidas','coffee'],
    ['Beleza','sparkles'],['Moda','shirt'],['Presentes','gift'],['Outros','shopping-bag']
  ];
  for(let i=0;i<legacy.length;i++){
    await db.query('INSERT INTO categories(condominium_id,name,icon,sort_order) VALUES($1,$2,$3,$4)',
      [id,legacy[i][0],legacy[i][1],i]);
  }
  const old=await db.query('SELECT name,id FROM categories WHERE condominium_id=$1',[id]);
  const ids=new Map(old.rows.map(x=>[x.name,x.id]));
  // Mimic applying a new migration to an already existing condominium.
  execFileSync(process.execPath,['scripts/migrate.mjs'],{env:process.env,stdio:'pipe'});
  const upgraded=await db.query('SELECT id,name,icon FROM categories WHERE condominium_id=$1 AND is_active=true ORDER BY sort_order,name',[id]);
  assert.deepEqual(upgraded.rows.map(c=>c.name),expected);
  for(const c of upgraded.rows)if(ids.has(c.name))assert.equal(c.id,ids.get(c.name),'Retain existing category UUID');
  // Old references are preserved, but non-food choices are deactivated.
  const inactive=await db.query('SELECT name,id FROM categories WHERE condominium_id=$1 AND is_active=false ORDER BY name',[id]);
  assert.deepEqual(inactive.rows.map(c=>c.name),['Beleza','Moda','Outros','Presentes']);
  for(const c of inactive.rows)assert.equal(c.id,ids.get(c.name));
  // Reapplying migrations must never duplicate any categories.
  execFileSync(process.execPath,['scripts/migrate.mjs'],{env:process.env,stdio:'pipe'});
  const repeated=await db.query('SELECT count(*)::int AS n FROM categories WHERE condominium_id=$1 AND is_active=true',[id]);
  assert.equal(repeated.rows[0].n,7);
  // The first tenant bootstrapped before this test is also unchanged.
  const other=await db.query('SELECT count(*)::int AS n FROM categories WHERE is_active=true AND condominium_id=(SELECT id FROM condominiums WHERE slug=$1)',
    ['teste']);
  assert.equal(other.rows[0].n,7);
  console.log('Existing condominium migration PASS: 7 food categories, legacy UUIDs preserved, idempotent.');
}finally{await db.end();}

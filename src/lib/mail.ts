export function passwordRecoveryConfigured(){
  return Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_FROM&&process.env.APP_URL);
}

export async function sendPasswordResetEmail(email:string, token:string):Promise<void>{
  const key=process.env.RESEND_API_KEY;
  const from=process.env.RESEND_FROM;
  const app=process.env.APP_URL;
  if(!key||!from||!app)throw new Error('Password recovery email is not configured.');
  const origin=new URL(app).origin;
  if(process.env.NODE_ENV==='production'&&!origin.startsWith('https://')){
    throw new Error('Password recovery requires HTTPS.');
  }
  const url=origin+'/?reset='+encodeURIComponent(token);
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({
      from,to:[email],subject:'Redefina sua senha no Condovery',
      html:'<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">'+
        '<h1>Redefinição de senha</h1>'+
        '<p>Recebemos uma solicitação para redefinir a senha de sua conta Condovery.</p>'+
        '<p><a href="'+url+'" style="display:inline-block;padding:14px 18px;border-radius:24px;background:#ffcf25;color:#202020;text-decoration:none;font-weight:bold">Criar nova senha</a></p>'+
        '<p>O link expira em 30 minutos. Se não fez esta solicitação, ignore o e-mail.</p></div>'
    }),
    signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw new Error('E-mail de recuperação não foi aceito pelo serviço.');
}

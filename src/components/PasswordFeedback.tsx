'use client';

import {Check, Circle} from 'lucide-react';
import {passwordStatus} from '@/lib/password-policy';

export function PasswordFeedback({password}:{password:string}){
  const status=passwordStatus(password);
  return <div className="password-feedback" aria-label="Requisitos e força da senha">
    <div className="password-feedback-heading">
      <strong>Segurança da senha</strong>
      <span aria-live="polite">{status.length} {status.length===1?'caractere':'caracteres'} · {status.strengthLabel}</span>
    </div>
    <div className={'password-strength-meter strength-'+status.strength}
      role="progressbar" aria-label="Força estimada da senha" aria-valuemin={0} aria-valuemax={4}
      aria-valuenow={status.strength} aria-valuetext={status.strengthLabel}>
      <span style={{width:(status.strength*25)+'%'}}/>
    </div>
    <ul className="password-requirements">
      {status.requirements.map(rule=><li key={rule.id} className={rule.met?'password-rule-met':''}>
        {rule.met?<Check size={14} aria-hidden="true"/>:<Circle size={12} aria-hidden="true"/>}
        <span>{rule.label}</span>
      </li>)}
    </ul>
    {status.valid&&<p className="password-valid-message">Todos os requisitos obrigatórios foram atendidos.</p>}
  </div>;
}

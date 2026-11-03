'use client';
import {useEffect,useState} from 'react';
import {Megaphone} from 'lucide-react';

type CampaignRule={
  key:'new_shop'|'new_products'|'sunday_food';
  label:string;description:string;enabled:boolean;
  variants:{title:string;body:string}[];
};
type Api=<T>(path:string,options?:RequestInit)=>Promise<T>;

export function DiscoveryCampaignsAdmin({api,tenantId}:{api:Api;tenantId:string}){
  const [campaigns,setCampaigns]=useState<CampaignRule[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState<string|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let current=true;setLoading(true);setError('');setCampaigns([]);
    void api<{campaigns:CampaignRule[]}>('platform/discovery-campaigns')
      .then(result=>{if(current)setCampaigns(result.campaigns);})
      .catch(err=>{if(current)setError(err instanceof Error?err.message:'Não foi possível carregar campanhas.');})
      .finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[api,tenantId]);
  async function toggle(rule:CampaignRule){
    if(saving)return;
    setSaving(rule.key);setError('');
    try{
      await api('platform/discovery-campaigns',{
        method:'PATCH',body:JSON.stringify({campaign:rule.key,enabled:!rule.enabled})
      });
      setCampaigns(items=>items.map(item=>
        item.key===rule.key?{...item,enabled:!rule.enabled}:item));
    }catch(err){setError(err instanceof Error?err.message:'Não foi possível salvar.');}
    finally{setSaving(null);}
  }
  return <section className="white-panel discovery-admin" aria-label="Campanhas de descoberta">
    <div className="discovery-admin-heading">
      <Megaphone size={21}/>
      <div><h2>Notificações de descoberta</h2>
        <p>Campanhas automáticas deste condomínio. Começam desativadas; só recebem moradores que optarem por novidades.</p>
      </div>
    </div>
    {error&&<p role="alert" className="global-alert">{error}</p>}
    {loading&&<p role="status">Carregando campanhas...</p>}
    {campaigns.map(rule=><article className="discovery-rule" key={rule.key}>
      <div className="discovery-rule-title">
        <div><h3>{rule.label}</h3><p>{rule.description}</p></div>
        <button type="button" role="switch" aria-checked={rule.enabled}
          aria-label={'Ativar '+rule.label} disabled={!!saving}
          className={'discovery-rule-toggle'+(rule.enabled?' is-on':'')}
          onClick={()=>void toggle(rule)}>
          {rule.enabled?'Ativada':'Desativada'}
        </button>
      </div>
      <div className="discovery-copy-list">
        {rule.variants.map((v,i)=><div className="discovery-copy" key={i}>
          <small>Versão {i===0?'A':'B'}</small>
          <strong>{v.title}</strong><p>{v.body}</p>
        </div>)}
      </div>
    </article>)}
    <p className="discovery-policy">Regras: no máximo duas campanhas por morador em sete dias, intervalo mínimo de 48 horas, das 10h às 20h30 (horário de São Paulo). Pedidos e avisos operacionais permanecem separados.</p>
  </section>;
}

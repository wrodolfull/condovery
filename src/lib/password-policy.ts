/** Shared policy for email registration and password recovery.
 * Existing users may still sign in with their previous password.
 */
export const MIN_PASSWORD_LENGTH=8;
export const MAX_PASSWORD_LENGTH=100;

export function passwordStatus(password:string) {
  const requirements=[
    {id:'length',label:'Pelo menos 8 caracteres',met:password.length>=MIN_PASSWORD_LENGTH},
    {id:'uppercase',label:'Uma letra maiúscula',met:/\p{Lu}/u.test(password)},
    {id:'digit',label:'Um número',met:/[0-9]/.test(password)},
    {id:'special',label:'Um caractere especial (ex.: !, @, #)',met:/[^\p{L}\p{N}\s]/u.test(password)}
  ];
  const valid=requirements.every(requirement=>requirement.met)&&password.length<=MAX_PASSWORD_LENGTH;
  const categories=[
    /\p{Ll}/u.test(password),
    /\p{Lu}/u.test(password),
    /[0-9]/.test(password),
    /[^\p{L}\p{N}\s]/u.test(password)
  ].filter(Boolean).length;
  // UX-only heuristic: not an entropy estimate or proof against leaked passwords.
  let strength=0;
  if(password){
    strength=1;
    if(password.length>=8)strength++;
    if(categories>=3)strength++;
    if(password.length>=12&&categories>=4)strength++;
    if(!valid)strength=Math.min(strength,2);
  }
  const strengthLabel=['Aguardando senha','Fraca','Regular','Boa','Forte'][strength];
  return {requirements,valid,strength,strengthLabel,length:password.length};
}
export const isValidPassword=(password:string)=>passwordStatus(password).valid;

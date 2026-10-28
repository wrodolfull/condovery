/** Public legal identification. Complete these server-side values before launch. */
export function getLegalIdentity(){
  const name=process.env.LEGAL_CONTROLLER_NAME?.trim()||'';
  const registration=process.env.LEGAL_CONTROLLER_REGISTRATION?.trim()||'';
  const address=process.env.LEGAL_CONTROLLER_ADDRESS?.trim()||'';
  const value=process.env.LEGAL_PRIVACY_EMAIL?.trim()||'';
  const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?value:'';
  return {name,registration,address,email,ready:Boolean(name&&email)};
}

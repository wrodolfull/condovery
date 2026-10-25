export const PAYMENT_METHODS=['pix','credit_card','debit_card','cash'] as const;
export type PaymentMethod=typeof PAYMENT_METHODS[number];
export const PAYMENT_LABELS:Record<PaymentMethod,string>={
  pix:'Pix',credit_card:'Cartão de crédito',debit_card:'Cartão de débito',cash:'Dinheiro'
};
export function allowedPaymentMethods(raw:unknown):PaymentMethod[]{
  return Array.isArray(raw)?PAYMENT_METHODS.filter(method=>raw.includes(method)):[];
}

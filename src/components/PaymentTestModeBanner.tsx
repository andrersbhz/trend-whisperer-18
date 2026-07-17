const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-red-100 border-b border-red-300 px-4 py-2 text-center text-sm text-red-800">
        Checkout de produção não configurado. Conclua o go-live do Stripe no seu projeto Lovable.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-xs text-orange-800">
        Modo de teste — pagamentos não são reais. Cartão de teste: 4242 4242 4242 4242 · qualquer validade futura · CVC 123
      </div>
    );
  }
  return null;
}

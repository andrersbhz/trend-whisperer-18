import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, QrCode, Copy, CheckCircle2, HandCoins } from "lucide-react";
import { toast } from "sonner";
import { maskPhoneBR, maskCPF, isValidPhoneBR, isValidCPF, onlyDigits } from "@/lib/masks";
import ManualPixTab from "./ManualPixTab";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: "starter_monthly" | "pro_monthly";
  planLabel: string;
  amountBRL: number;
};

export default function CheckoutModal({ open, onOpenChange, plan, planLabel, amountBRL }: Props) {
  const [form, setForm] = useState({ email: "", name: "", phone: "", document: "" });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"card" | "pix" | "pix_manual">("card");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qrCode?: string; qrCodeBase64?: string; paymentId?: number } | null>(null);
  const [pixPolling, setPixPolling] = useState(false);
  const [paid, setPaid] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  const reset = () => {
    setClientSecret(null); setPixData(null); setPaid(false); setPixPolling(false); setIssuedKey(null);
  };

  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const validateCommon = () => {
    if (!form.email) { toast.error("Informe seu e-mail"); return false; }
    if (!form.name.trim()) { toast.error("Informe seu nome"); return false; }
    if (!isValidPhoneBR(form.phone)) { toast.error("Telefone inválido (DDD + número)"); return false; }
    return true;
  };

  const startCard = async () => {
    if (!validateCommon()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: plan,
          customerEmail: form.email,
          customerName: form.name,
          customerPhone: onlyDigits(form.phone),
          returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
      });
      if (error || !data?.clientSecret) throw new Error(error?.message || "Falha no checkout");
      setClientSecret(data.clientSecret);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar checkout");
    } finally { setLoading(false); }
  };

  const startPix = async () => {
    if (!validateCommon()) return;
    if (!isValidCPF(form.document)) return toast.error("CPF inválido");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mp-create-pix", {
        body: { plan, buyerEmail: form.email, buyerName: form.name, buyerPhone: onlyDigits(form.phone), buyerDocument: onlyDigits(form.document) },
      });
      if (error || !data?.qrCode) throw new Error(error?.message || data?.error || "Falha ao gerar Pix");
      setPixData({ qrCode: data.qrCode, qrCodeBase64: data.qrCodeBase64, paymentId: data.paymentId });
      setPixPolling(true);
      // Poll sale_notifications for this payment id
      const start = Date.now();
      const timer = setInterval(async () => {
        if (Date.now() - start > 10 * 60_000) { clearInterval(timer); setPixPolling(false); return; }
        const { data: sale } = await supabase.rpc("check_sale_status", { p_mp_payment_id: String(data.paymentId), p_stripe_session_id: null });
        if ((sale as any)?.found && (sale as any)?.license_key) {
          clearInterval(timer);
          setPixPolling(false); setPaid(true);
          toast.success("Pagamento confirmado!");
        }
      }, 4000);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar Pix");
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-[#0a0518] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">
            Assinar {planLabel} — <span className="text-[#a3ff12]">R$ {amountBRL.toFixed(2)}/mês</span>
          </DialogTitle>
        </DialogHeader>

        {paid ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-[#a3ff12] mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Pagamento aprovado!</h3>
            <p className="text-white/60 mb-4">Sua chave de licença foi enviada para <b>{form.email}</b>.</p>
            {issuedKey && (
              <div className="flex items-center gap-2 max-w-md mx-auto mb-6">
                <input readOnly value={issuedKey} className="flex-1 bg-[#141a2e] border border-[#a3ff12]/40 rounded px-3 py-2 font-mono text-[#a3ff12] text-center" />
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(issuedKey); toast.success("Copiada!"); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
            <Button onClick={() => (window.location.href = "/ativar")} className="bg-[#a3ff12] text-black font-bold">
              Ativar agora
            </Button>
          </div>
        ) : clientSecret ? (
          <div id="checkout" className="max-h-[70vh] overflow-y-auto">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>E-mail *</Label><Input required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" className="bg-[#141a2e] border-white/10" /></div>
              <div><Label>Nome *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#141a2e] border-white/10" /></div>
              <div><Label>Telefone *</Label><Input required inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhoneBR(e.target.value) })} placeholder="(11) 99999-9999" maxLength={16} className="bg-[#141a2e] border-white/10" /></div>
              <div><Label>CPF (para Pix) *</Label><Input required inputMode="numeric" value={form.document} onChange={(e) => setForm({ ...form, document: maskCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} className="bg-[#141a2e] border-white/10" /></div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-4">
              <TabsList className="bg-[#141a2e] border border-white/10">
                <TabsTrigger value="card"><CreditCard className="w-4 h-4 mr-1" /> Cartão</TabsTrigger>
                <TabsTrigger value="pix"><QrCode className="w-4 h-4 mr-1" /> Pix (MP)</TabsTrigger>
                <TabsTrigger value="pix_manual"><HandCoins className="w-4 h-4 mr-1" /> Pix manual</TabsTrigger>
              </TabsList>
              <TabsContent value="card" className="mt-4">
                <p className="text-sm text-white/60 mb-3">Cobrança mensal automática via Stripe. Cancele quando quiser pelo portal.</p>
                <Button onClick={startCard} disabled={loading} className="w-full bg-[#a3ff12] text-black font-bold py-6">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                  Pagar com cartão
                </Button>
              </TabsContent>
              <TabsContent value="pix" className="mt-4">
                {pixData ? (
                  <div className="text-center space-y-3">
                    {pixData.qrCodeBase64 && (
                      <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="Pix QR" className="w-56 h-56 mx-auto rounded-lg bg-white p-2" />
                    )}
                    <div className="p-2 bg-[#141a2e] border border-white/10 rounded font-mono text-xs break-all">{pixData.qrCode}</div>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(pixData.qrCode || ""); toast.success("Copiado!"); }}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar código Pix
                    </Button>
                    {pixPolling && <p className="text-sm text-white/60 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Aguardando pagamento…</p>}
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-white/60 mb-3">Pagamento único mensal via Pix. Renovação manual a cada 30 dias.</p>
                    <Button onClick={startPix} disabled={loading} className="w-full bg-[#a3ff12] text-black font-bold py-6">
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                      Gerar QR Code Pix
                    </Button>
                  </>
                )}
              </TabsContent>
              <TabsContent value="pix_manual" className="mt-4">
                <ManualPixTab
                  plan={plan}
                  amountBRL={amountBRL}
                  buyer={form}
                  validateBuyer={() => validateCommon() && (isValidCPF(form.document) || (toast.error("CPF inválido"), false))}
                  onPaid={() => setPaid(true)}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

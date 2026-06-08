import { useState } from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import StaticPageLayout from '@/components/blog/StaticPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

const ContactPage = () => {
  const [sending, setSending] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast({ title: 'Mensagem enviada', description: 'Retornaremos em breve. Obrigado!' });
      (e.target as HTMLFormElement).reset();
    }, 600);
  };

  return (
    <StaticPageLayout
      kicker="Fale Conosco"
      title="Contato"
      description="Sugestões de pauta, correções, parcerias ou dúvidas? Envie sua mensagem — respondemos todos os contatos."
    >
      <div className="grid md:grid-cols-3 gap-4 not-prose mb-8">
        <div className="border border-[hsl(var(--news-line))] p-5">
          <Mail className="h-5 w-5 text-[hsl(var(--news-accent))] mb-3" />
          <div className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--news-muted))]">E-mail</div>
          <div className="text-sm font-semibold mt-1">contato@a3portal.com</div>
        </div>
        <div className="border border-[hsl(var(--news-line))] p-5">
          <Phone className="h-5 w-5 text-[hsl(var(--news-accent))] mb-3" />
          <div className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--news-muted))]">Telefone</div>
          <div className="text-sm font-semibold mt-1">+55 (11) 0000-0000</div>
        </div>
        <div className="border border-[hsl(var(--news-line))] p-5">
          <MapPin className="h-5 w-5 text-[hsl(var(--news-accent))] mb-3" />
          <div className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--news-muted))]">Endereço</div>
          <div className="text-sm font-semibold mt-1">São Paulo, SP — Brasil</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 not-prose">
        <div className="grid md:grid-cols-2 gap-4">
          <Input required name="name" placeholder="Seu nome" />
          <Input required type="email" name="email" placeholder="Seu e-mail" />
        </div>
        <Input required name="subject" placeholder="Assunto" />
        <Textarea required name="message" placeholder="Sua mensagem" rows={6} />
        <Button type="submit" disabled={sending} className="bg-[hsl(var(--news-accent))] hover:brightness-110 text-white">
          {sending ? 'Enviando…' : 'Enviar mensagem'}
        </Button>
      </form>
    </StaticPageLayout>
  );
};

export default ContactPage;

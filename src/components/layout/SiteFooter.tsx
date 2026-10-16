import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ComingSoon } from '@/components/common/ComingSoon'
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  YoutubeIcon,
} from '@/components/icons/brand'
import { Input } from '@/components/ui/input'
import { Container } from './Container'

const FEATURES = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
]

const COLLECTION_LINKS = [
  { label: 'Arte digital', category: 'arte-digital' },
  { label: 'Fotografia', category: 'fotografia' },
  { label: 'Música', category: 'musica' },
  { label: 'Arte 3D', category: 'arte-3d' },
  { label: 'Utilidade', category: 'utilidade' },
] as const

const SOCIAL = [
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'Instagram', Icon: InstagramIcon },
  { label: 'Twitter', Icon: TwitterIcon },
  { label: 'LinkedIn', Icon: LinkedinIcon },
  { label: 'YouTube', Icon: YoutubeIcon },
]

export function CompatibleWallets({ className = '' }: { className?: string }) {
  return (
    <p
      className={`inline-flex h-[26px] items-center gap-2 rounded-md border border-[#55321f] bg-surface-band px-2 text-[9px] font-bold tracking-[0.01em] text-brand-accent ${className}`}
    >
      METAMASK <span aria-hidden="true">•</span> WALLETCONNECT <span aria-hidden="true">•</span>{' '}
      COINBASE
    </p>
  )
}

export function SiteFooter({ className }: { className?: string }) {
  return (
    // content-visibility: o navegador só calcula o layout do rodapé quando ele se aproxima da tela
    <footer
      className={`mt-24 pb-24 [contain-intrinsic-size:auto_640px] [content-visibility:auto] lg:pb-0 ${className ?? ''}`}
    >
      <Container>
        <div className="overflow-hidden rounded-t-sm bg-card">
          <div className="grid gap-8 p-6 md:grid-cols-2 lg:grid-cols-[265px_265px_265px_minmax(0,1fr)] lg:gap-0 lg:p-8">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-3 lg:border-r lg:border-primary lg:px-4"
              >
                <span
                  className="grid size-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
                  aria-hidden="true"
                >
                  {f.letter}
                </span>
                <h2 className="mt-2 text-[17px] leading-4 font-bold">{f.title}</h2>
                <p className="max-w-[204px] text-sm leading-[22px] text-muted-foreground">
                  {f.text}
                </p>
              </div>
            ))}
            <div className="flex flex-col gap-4 lg:px-4">
              <h2 className="max-w-[325px] text-lg leading-4 font-bold">
                Antecipe-se ao próximo lançamento
              </h2>
              <form
                className="flex h-10 max-w-[325px] rounded-md shadow-[0_0_20px_rgb(10_6_4/0.45)]"
                onSubmit={(e) => e.preventDefault()}
                aria-describedby="newsletter-note"
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  E-mail para a newsletter
                </label>
                <Input
                  id="newsletter-email"
                  type="email"
                  placeholder="digite seu e-mail..."
                  className="h-10 min-w-0 flex-1 rounded-r-none border-0 bg-surface-band px-3 text-sm placeholder:text-brand-secondary"
                />
                <ComingSoon className="w-[85px] shrink-0 rounded-r-md bg-primary text-lg leading-4 font-bold text-primary-foreground">
                  Enviar
                </ComingSoon>
              </form>
              <p
                id="newsletter-note"
                className="-mt-1 max-w-[325px] text-[13px] leading-[22px] text-muted-foreground"
              >
                Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
              </p>
            </div>
          </div>

          <div className="grid gap-3 bg-surface-band px-6 py-6 text-sm leading-[22px] sm:grid-cols-2 lg:grid-cols-[179px_179px_179px_228px] lg:items-center lg:justify-between lg:px-8 lg:py-[21px]">
            <p className="font-bold tracking-[0.1em]">KURIO</p>
            <p className="lg:w-[219px]">
              Feito para colecionadores,
              <br className="max-lg:hidden" /> criadores e cultura
            </p>
            <a href="mailto:contato@email.com" className="hover:text-brand-accent">
              contato@email.com
            </a>
            <a href="tel:+551140028922" className="hover:text-brand-accent">
              +55 11 4002 8922
            </a>
          </div>

          <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-[179px_179px_179px_228px] lg:justify-between lg:px-8">
            <FooterColumn title="Meu perfil">
              <Link to="/perfil">Meu perfil</Link>
              <ComingSoon>Minha coleção</ComingSoon>
              <ComingSoon>Atividade</ComingSoon>
              <ComingSoon>Estúdio do criador</ComingSoon>
              <Link to="/perfil/favoritos">Lista de interesse</Link>
            </FooterColumn>
            <FooterColumn title="Central de ajuda">
              <ComingSoon>Central de ajuda</ComingSoon>
              <ComingSoon>Como comprar NFTs</ComingSoon>
              <ComingSoon>Carteira e segurança</ComingSoon>
              <ComingSoon>Política do mercado</ComingSoon>
              <ComingSoon>Denunciar item</ComingSoon>
            </FooterColumn>
            <FooterColumn title="Coleções">
              {COLLECTION_LINKS.map((c) => (
                <Link key={c.category} to="/" search={{ categories: c.category }} hash="catalogo">
                  {c.label}
                </Link>
              ))}
            </FooterColumn>
            <div className="flex flex-col gap-5">
              <h2 className="text-lg leading-4 font-bold">Redes sociais</h2>
              <ul className="flex gap-2.5">
                {SOCIAL.map(({ label, Icon }) => (
                  <li key={label}>
                    <ComingSoon
                      label={`${label} da Kurio em breve`}
                      className="grid size-[30px] place-items-center rounded-[4px] border border-primary text-primary"
                    >
                      <Icon className="max-h-4 max-w-4" />
                      <span className="sr-only">{label}</span>
                    </ComingSoon>
                  </li>
                ))}
              </ul>
              <h2 className="mt-3 text-lg leading-4 font-bold">Carteiras compatíveis</h2>
              <CompatibleWallets className="-mt-2 self-start" />
            </div>
          </div>
        </div>
        <p className="text-center text-sm leading-[30px] lg:mt-1.5">
          © 2026 Kurio. Propriedade digital para todos.
        </p>
      </Container>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg leading-4 font-bold">{title}</h2>
      <ul className="flex flex-col text-sm leading-[30px]">
        {(Array.isArray(children) ? children : [children]).map((child, i) => (
          <li key={i} className="[&_a:hover]:text-brand-accent">
            {child}
          </li>
        ))}
      </ul>
    </div>
  )
}

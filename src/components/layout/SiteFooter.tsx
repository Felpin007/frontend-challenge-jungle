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
      className={`inline-flex items-center gap-2 rounded-sm border border-primary/40 bg-surface-band px-2.5 py-1 text-[9px] font-bold tracking-wide text-brand-accent ${className}`}
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
          <div className="grid gap-8 px-6 py-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:px-12">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-2 lg:border-r lg:border-primary lg:pr-6 lg:pl-0 [&:not(:first-child)]:lg:pl-4"
              >
                <span
                  className="grid size-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
                  aria-hidden="true"
                >
                  {f.letter}
                </span>
                <h2 className="text-lg font-bold">{f.title}</h2>
                <p className="text-[15px] leading-[22px] text-muted-foreground">{f.text}</p>
              </div>
            ))}
            <div className="flex flex-col gap-3 lg:pl-4">
              <h2 className="text-lg leading-4 font-bold">Antecipe-se ao próximo lançamento</h2>
              <form
                className="flex"
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
                  className="rounded-r-none border-0 bg-surface-band"
                />
                <ComingSoon className="rounded-r-md bg-primary px-4 text-lg font-bold text-primary-foreground">
                  Enviar
                </ComingSoon>
              </form>
              <p id="newsletter-note" className="text-sm leading-[22px] text-muted-foreground">
                Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
              </p>
            </div>
          </div>

          <div className="grid gap-3 bg-surface-band px-6 py-6 text-[15px] sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
            <p className="text-sm font-bold tracking-wide">KURIO</p>
            <p>Feito para colecionadores, criadores e cultura</p>
            <a href="mailto:contato@email.com" className="hover:text-brand-accent">
              contato@email.com
            </a>
            <a href="tel:+551140028922" className="hover:text-brand-accent">
              +55 11 4002 8922
            </a>
          </div>

          <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
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
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">Redes sociais</h2>
              <ul className="flex gap-2">
                {SOCIAL.map(({ label, Icon }) => (
                  <li key={label}>
                    <ComingSoon
                      label={`${label} da Kurio em breve`}
                      className="grid size-8 place-items-center rounded-sm border border-primary text-primary"
                    >
                      <Icon className="max-h-4 max-w-4" />
                      <span className="sr-only">{label}</span>
                    </ComingSoon>
                  </li>
                ))}
              </ul>
              <h2 className="mt-4 text-lg font-bold">Carteiras compatíveis</h2>
              <CompatibleWallets />
            </div>
          </div>
        </div>
        <p className="py-2 text-center text-[15px]">
          © 2026 Kurio. Propriedade digital para todos.
        </p>
      </Container>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <ul className="flex flex-col gap-3 text-[15px]">
        {(Array.isArray(children) ? children : [children]).map((child, i) => (
          <li key={i} className="[&_a:hover]:text-brand-accent">
            {child}
          </li>
        ))}
      </ul>
    </div>
  )
}

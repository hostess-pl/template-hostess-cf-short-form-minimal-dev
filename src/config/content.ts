import type { ImageMetadata } from 'astro';
import type { Locale } from './site.config';
import { appearanceTextForPublic, eventTextForPublic, languagesForPublic, publicCopyForLocale } from '@/lib/cms/i18n';
import { loadHostess } from '@/lib/hostess';

let _bundleRef: ReturnType<typeof loadHostess> | null = null
let _bundle: ReturnType<typeof buildContentBundle> | null = null

const imageModules = import.meta.glob<{ default: ImageMetadata }>('../assets/images/*', {
  eager: true,
});

function resolveImage(fileName: string): ImageMetadata {
  const match = Object.entries(imageModules).find(([path]) => path.endsWith(`/${fileName}`));
  if (match) return match[1].default;
  const hero = Object.entries(imageModules).find(([path]) => path.endsWith('/hero.jpg'));
  if (hero) {
    console.warn(`[content] Missing image asset: ${fileName}; falling back to hero.jpg`);
    return hero[1].default;
  }
  throw new Error(`Missing image asset: ${fileName}`);
}

/** Local baked asset or remote/CMS URL. Never falls back to hero for events. */
export type EventImage =
  | { kind: 'local'; meta: ImageMetadata }
  | { kind: 'remote'; src: string };

function resolveEventImage(value: string): EventImage {
  const raw = String(value || '').trim();
  if (!raw) {
    return { kind: 'remote', src: '' };
  }
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
    return { kind: 'remote', src: raw };
  }
  const match = Object.entries(imageModules).find(([path]) => path.endsWith(`/${raw}`));
  if (match) return { kind: 'local', meta: match[1].default };
  return { kind: 'remote', src: `/cms-assets/${raw.replace(/^\/+/, '')}` };
}


export type AppearanceFactIcon = 'height' | 'dress' | 'hair' | 'eyes' | 'license' | 'car';

export interface AppearanceFact {
  id: string;
  icon: AppearanceFactIcon;
  label: Record<Locale, string>;
  value: Record<Locale, string>;
}

export interface FeaturedEvent {
  id: string;
  image: EventImage;
  video?: string | null;
  date: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  alt: Record<Locale, string>;
}

export interface TimelineEntry {
  id: string;
  date: Record<Locale, string>;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
}

export interface PortfolioContent {
  nav: Record<Locale, { about: string; experience: string; gallery: string; contact: string; cta: string }>;
  hero: Record<
    Locale,
    {
      eyebrow: string;
      headline: string;
      subheadlineIntro: string;
      subheadline: string;
      cta: string;
      ctaSecondary: string;
    }
  >;
  stats: Record<Locale, { label: string; value: string }[]>;
  languagesLabel: Record<Locale, string>;
  languages: Record<Locale, { name: string; level: string }[]>;
  about: Record<
    Locale,
    {
      label: string;
      title: string;
      lead: string;
      body: string;
      education: {
        label: string;
        degrees: { name: string; university: string; year: string }[];
      };
      currentWork: {
        label: string;
        entries: { id: string; name: string; year: string }[];
      };
    }
  >;
  strengths: Record<Locale, string[]>;
  gallery: Record<Locale, { label: string; title: string; subtitle: string }>;
  background: Record<Locale, { label: string; title: string; subtitle: string }>;
  contact: Record<
    Locale,
    {
      title: string;
      subtitle: string;
      directTitle: string;
      location: string;
      form: {
        name: string;
        email: string;
        phone: string;
        message: string;
        submit: string;
        privacy: string;
        successTitle: string;
        successMessage: string;
        errorGeneric: string;
        errorName: string;
        errorEmail: string;
        errorMessage: string;
      };
    }
  >;
  footer: Record<Locale, { rights: string; siteBy: string }>;
}

function buildContentBundle() {
  const hostess = loadHostess();


  function yearsSince(dateIso: string): string {
    if (!dateIso) return '1+';
    const start = new Date(dateIso);
    if (Number.isNaN(start.getTime())) return '1+';
    const years = Math.max(1, new Date().getFullYear() - start.getFullYear());
    return `${years}+`;
  }

  function localizeText(value: string, locale: Locale): string {
    return value;
  }

  const PRESENT_LABEL: Record<Locale, string> = {
    en: 'present',
    pl: 'obecnie',
    es: 'actualidad',
  };

  function extractYear(value: string): string {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return String(parsed.getFullYear());
    const match = String(value || '').match(/\b(19|20)\d{2}\b/);
    return match?.[0] ?? '';
  }

  function eventYear(date: string): string {
    return extractYear(date) || String(date || '').trim();
  }

  function eventSortKey(date: string): string {
    const raw = String(date || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const year = extractYear(raw);
    return year ? `${year}-01-01` : '0000-01-01';
  }

  function employmentSortKey(job: { startDate?: string; endDate?: string; isOngoing?: boolean }) {
    const start = String(job.startDate || '').trim();
    if (start) return start;
    return job.isOngoing ? '9999-12-31' : '0000-01-01';
  }

  function formatYearRange(
    startDate: string | undefined,
    endDate: string | undefined,
    isOngoing: boolean | undefined,
    locale: Locale,
    fallbackDate = '',
  ): string {
    const present = PRESENT_LABEL[locale];
    const startYear = extractYear(startDate || '');
    const endYear = extractYear(endDate || '');
    if (isOngoing) {
      if (startYear && endYear) return `${startYear} – ${endYear} (${present})`;
      return startYear ? `${startYear} – ${present}` : present;
    }
    if (startYear && endYear) return `${startYear} – ${endYear}`;
    if (startYear || endYear) return startYear || endYear;
    return String(fallbackDate || '')
      .replace(/\bpresent\b/gi, present)
      .replace(/\bongoing\b/gi, present);
  }

  function formatStudyYear(entry: { startDate?: string; endDate?: string; isOngoing?: boolean }, locale: Locale): string {
    return formatYearRange(entry.startDate, entry.endDate, entry.isOngoing, locale);
  }

  function formatEmploymentYear(
    job: { startDate?: string; endDate?: string; date?: string; isOngoing?: boolean },
    locale: Locale,
  ): string {
    return formatYearRange(job.startDate, job.endDate, job.isOngoing, locale, job.date);
  }


  function buildAppearanceFacts(): AppearanceFact[] {
    const appearance = hostess.appearance ?? { height: '', dressSize: '', hairColor: '', eyeColor: '' };
    const mobility = hostess.mobility ?? { drivingLicense: '', hasCar: false };
    const hostessDoc = hostess as unknown as Record<string, unknown>;
    const hair = {
      en: appearanceTextForPublic(hostessDoc, 'en').hairColor,
      pl: appearanceTextForPublic(hostessDoc, 'pl').hairColor,
      es: appearanceTextForPublic(hostessDoc, 'es').hairColor,
    };
    const eyes = {
      en: appearanceTextForPublic(hostessDoc, 'en').eyeColor,
      pl: appearanceTextForPublic(hostessDoc, 'pl').eyeColor,
      es: appearanceTextForPublic(hostessDoc, 'es').eyeColor,
    };
    const facts: AppearanceFact[] = [];

    if (appearance.height) {
      facts.push({
        id: 'height',
        icon: 'height',
        label: { en: 'Height', pl: 'Wzrost', es: 'Altura' },
        value: { en: appearance.height, pl: appearance.height, es: appearance.height },
      });
    }
    if (appearance.dressSize) {
      facts.push({
        id: 'dress',
        icon: 'dress',
        label: { en: 'Dress size', pl: 'Rozmiar', es: 'Talla' },
        value: { en: appearance.dressSize, pl: appearance.dressSize, es: appearance.dressSize },
      });
    }
    if (hair.en || hair.pl || hair.es) {
      facts.push({
        id: 'hair',
        icon: 'hair',
        label: { en: 'Hair', pl: 'Włosy', es: 'Cabello' },
        value: hair,
      });
    }
    if (eyes.en || eyes.pl || eyes.es) {
      facts.push({
        id: 'eyes',
        icon: 'eyes',
        label: { en: 'Eyes', pl: 'Oczy', es: 'Ojos' },
        value: eyes,
      });
    }
    if (mobility.drivingLicense) {
      const licenseValue =
        mobility.drivingLicense === 'yes'
          ? { en: 'Yes', pl: 'Tak', es: 'Sí' }
          : { en: mobility.drivingLicense, pl: mobility.drivingLicense, es: mobility.drivingLicense };
      facts.push({
        id: 'license',
        icon: 'license',
        label: { en: 'License', pl: 'Prawo jazdy', es: 'Carnet' },
        value: licenseValue,
      });
    }
    if (mobility.hasCar) {
      facts.push({
        id: 'car',
        icon: 'car',
        label: { en: 'Car', pl: 'Samochód', es: 'Coche' },
        value: { en: 'Yes', pl: 'Tak', es: 'Sí' },
      });
    }

    return facts;
  }

  function mergeStrengthBadges(...groups: string[][]): string[] {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const group of groups) {
      for (const raw of group) {
        const item = raw.trim();
        if (!item) continue;
        const key = item.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
    }
    return merged;
  }

  function buildEducationDegrees(locale: Locale) {
    const entries = hostess.education.entries?.length
      ? hostess.education.entries
      : hostess.education.field || hostess.education.university
        ? [{
            id: 'study-1',
            field: hostess.education.field,
            university: hostess.education.university,
            startDate: '',
            endDate: '',
            isOngoing: hostess.education.isStudent,
          }]
        : [];

    return entries
      .filter((entry) => String(entry.field || '').trim().length > 0)
      .map((entry) => ({
        name: String(entry.field).trim(),
        university: String(entry.university || '').trim(),
        year: formatStudyYear(entry, locale),
      }));
  }

  function buildCurrentWorkEntries(locale: Locale) {
    return hostess.employment
      .filter((job) => job.isOngoing)
      .map((job) => ({
        id: job.id,
        name: job.company ? `${job.title} · ${job.company}` : job.title,
        year: formatEmploymentYear(job, locale),
      }));
  }

  const allStrengths = mergeStrengthBadges(hostess.skills, hostess.traits, hostess.languageCompetencies);
  const appearanceFacts = buildAppearanceFacts();




  const displayName = hostess.profile.displayName;
  const hostessCopy = hostess.copy ?? {};
  const copyByLocale =
    hostess.copyByLocale && typeof hostess.copyByLocale === 'object' ? hostess.copyByLocale : {};

  function copyFor(locale: Locale) {
    return publicCopyForLocale(copyByLocale as Record<string, unknown>, hostessCopy as Record<string, unknown>, locale);
  }

  const copyHeadline = String(hostessCopy.headline || '').trim();
  const copyGreeting = String(hostessCopy.greeting || '').trim();
  const copyProfile = String(hostessCopy.profile || '').trim();
  const copyAboutLead = String(hostessCopy.aboutLead || '').trim();
  const copyExperienceSummary = String(hostessCopy.experienceSummary || '').trim();
  const experienceText = String(hostess.experience.brands || '').trim();
  const heroProfileLine = copyProfile || hostess.bio.short;
  const aboutLeadLine = copyAboutLead || experienceText || hostess.bio.short;
  const aboutBodyLine = copyExperienceSummary || hostess.experience.eventTypes || '';
  const location = hostess.profile.location;
  const workCities = hostess.profile.workCities.join(', ') || location;
  const experienceYears = yearsSince(hostess.experience.since);
  const professionalStatus = hostess.profile.professionalStatus || (hostess.education.isStudent ? 'Student' : '');
  const statusStatValue = professionalStatus || workCities;
  const statusStatLabel = {
    en: professionalStatus ? 'Status' : 'Coverage',
    pl: professionalStatus ? 'Status zawodowy' : 'Zasięg',
    es: professionalStatus ? 'Estado' : 'Cobertura',
  };

  const galleryEvents: FeaturedEvent[] = [...hostess.events]
    .sort((a, b) => eventSortKey(b.date).localeCompare(eventSortKey(a.date)))
    .map((event) => {
    const eventDoc = event as unknown as Record<string, unknown>
    const enText = eventTextForPublic(eventDoc, 'en')
    const plText = eventTextForPublic(eventDoc, 'pl')
    const esText = eventTextForPublic(eventDoc, 'es')
    return {
    id: event.id,
    image: resolveEventImage(event.imageFile),
    video: event.videoFile ? `/videos/${event.videoFile}` : null,
    date: eventYear(event.date),
    title: {
      en: enText.title,
      pl: plText.title,
      es: esText.title,
    },
    description: {
      en: enText.description,
      pl: plText.description,
      es: esText.description,
    },
    alt: {
      en: enText.title ? `${displayName} at ${enText.title}` : `${displayName} portfolio`,
      pl: plText.title ? `${displayName} — ${plText.title}` : `${displayName} — portfolio`,
      es: esText.title ? `${displayName} — ${esText.title}` : `${displayName} — portfolio`,
    },
  }
  });

  const showExperienceSection = hostess.employment.length > 0;

  const backgroundEntries: TimelineEntry[] = [...hostess.employment]
    .sort((a, b) => employmentSortKey(b).localeCompare(employmentSortKey(a)))
    .map((job) => ({
    id: job.id,
    date: {
      en: formatEmploymentYear(job, 'en'),
      pl: formatEmploymentYear(job, 'pl'),
      es: formatEmploymentYear(job, 'es'),
    },
    title: {
      en: job.company ? `${job.title} · ${job.company}` : job.title,
      pl: job.company ? `${job.title} · ${job.company}` : job.title,
      es: job.company ? `${job.title} · ${job.company}` : job.title,
    },
    description: {
      en: job.description,
      pl: job.description,
      es: job.description,
    },
  }));

  const content: PortfolioContent = {
    nav: {
      en: {
        about: copyFor('en').aboutLabel || 'About',
        experience: copyFor('en').experienceLabel || 'Experience',
        gallery: copyFor('en').galleryLabel || 'Portfolio',
        contact: copyFor('en').contactLabel || 'Contact',
        cta: "Let's connect",
      },
      pl: {
        about: copyFor('pl').aboutLabel || 'O mnie',
        experience: copyFor('pl').experienceLabel || 'Doświadczenie',
        gallery: copyFor('pl').galleryLabel || 'Portfolio',
        contact: copyFor('pl').contactLabel || 'Kontakt',
        cta: 'Połączmy się',
      },
      es: {
        about: copyFor('es').aboutLabel || 'Sobre mí',
        experience: copyFor('es').experienceLabel || 'Experiencia',
        gallery: copyFor('es').galleryLabel || 'Portfolio',
        contact: copyFor('es').contactLabel || 'Contacto',
        cta: 'Conectemos',
      },
    },
    hero: {
      en: {
        eyebrow: `Professional Hostess · ${workCities}`,
        headline: copyFor('en').headline || 'A first impression that builds trust.',
        subheadlineIntro: copyFor('en').greeting || `Hi, I'm ${displayName}!`,
        subheadline: copyFor('en').profile || '',
        cta: 'Get in touch',
        ctaSecondary: 'View portfolio',
      },
      pl: {
        eyebrow: `Profesjonalna hostessa · ${workCities}`,
        headline: copyFor('pl').headline || copyHeadline || 'Pierwsze wrażenie, które buduje zaufanie.',
        subheadlineIntro: copyFor('pl').greeting || copyGreeting || `Cześć, jestem ${displayName}!`,
        subheadline: copyFor('pl').profile || heroProfileLine,
        cta: 'Skontaktuj się',
        ctaSecondary: 'Zobacz portfolio',
      },
      es: {
        eyebrow: `Azafata profesional · ${workCities}`,
        headline: copyFor('es').headline || 'Una primera impresión que genera confianza.',
        subheadlineIntro: copyFor('es').greeting || `¡Hola, soy ${displayName}!`,
        subheadline: copyFor('es').profile || '',
        cta: 'Contactar',
        ctaSecondary: 'Ver portfolio',
      },
    },
    stats: {
      en: [
        { label: 'Experience', value: experienceYears },
        { label: 'Location', value: location },
        { label: statusStatLabel.en, value: statusStatValue },
      ],
      pl: [
        { label: 'Doświadczenie', value: experienceYears },
        { label: 'Lokalizacja', value: location },
        { label: statusStatLabel.pl, value: statusStatValue },
      ],
      es: [
        { label: 'Experiencia', value: experienceYears },
        { label: 'Ubicación', value: location },
        { label: statusStatLabel.es, value: statusStatValue },
      ],
    },
    languagesLabel: {
      en: 'Languages',
      pl: 'Języki',
      es: 'Idiomas',
    },
    languages: {
      en: languagesForPublic(hostess as unknown as Record<string, unknown>, 'en'),
      pl: languagesForPublic(hostess as unknown as Record<string, unknown>, 'pl'),
      es: languagesForPublic(hostess as unknown as Record<string, unknown>, 'es'),
    },
    about: {
      en: {
        label: copyFor('en').aboutLabel || 'About',
        title: copyFor('en').aboutTitle || 'Hospitality as an art',
        lead: copyFor('en').aboutLead || '',
        body: copyFor('en').experienceSummary || '',
        education: {
          label: 'Studies',
          degrees: buildEducationDegrees('en'),
        },
        currentWork: {
          label: 'Work',
          entries: buildCurrentWorkEntries('en'),
        },
      },
      pl: {
        label: copyFor('pl').aboutLabel || 'O mnie',
        title: copyFor('pl').aboutTitle || 'Gościnność jako sztuka',
        lead: copyFor('pl').aboutLead || aboutLeadLine,
        body: copyFor('pl').experienceSummary || aboutBodyLine,
        education: {
          label: 'Studia',
          degrees: buildEducationDegrees('pl'),
        },
        currentWork: {
          label: 'Praca',
          entries: buildCurrentWorkEntries('pl'),
        },
      },
      es: {
        label: copyFor('es').aboutLabel || 'Sobre mí',
        title: copyFor('es').aboutTitle || 'La hospitalidad como arte',
        lead: copyFor('es').aboutLead || '',
        body: copyFor('es').experienceSummary || '',
        education: {
          label: 'Estudios',
          degrees: buildEducationDegrees('es'),
        },
        currentWork: {
          label: 'Trabajo',
          entries: buildCurrentWorkEntries('es'),
        },
      },
    },
    strengths: {
      en: allStrengths,
      pl: allStrengths,
      es: allStrengths,
    },
    gallery: {
      en: {
        label: copyFor('en').galleryLabel || 'Portfolio',
        title: copyFor('en').galleryTitle || 'Selected events',
        subtitle: hostess.experience.eventTypes || 'Hostess roles at conferences and events.',
      },
      pl: {
        label: copyFor('pl').galleryLabel || 'Portfolio',
        title: copyFor('pl').galleryTitle || 'Wybrane wydarzenia',
        subtitle: hostess.experience.eventTypes || 'Doświadczenie jako hostessa na eventach.',
      },
      es: {
        label: copyFor('es').galleryLabel || 'Portfolio',
        title: copyFor('es').galleryTitle || 'Eventos destacados',
        subtitle: hostess.experience.eventTypes || 'Experiencia como azafata en eventos.',
      },
    },
    background: {
      en: {
        label: copyFor('en').experienceLabel || 'Experience',
        title: copyFor('en').experienceTitle || 'Employment History',
        subtitle: '',
      },
      pl: {
        label: copyFor('pl').experienceLabel || 'Doświadczenie',
        title: copyFor('pl').experienceTitle || 'Historia zatrudnienia',
        subtitle: '',
      },
      es: {
        label: copyFor('es').experienceLabel || 'Experiencia',
        title: copyFor('es').experienceTitle || 'Historial laboral',
        subtitle: '',
      },
    },
    contact: {
      en: {
        title: copyFor('en').contactTitle || "Let's work together",
        subtitle: 'Available for conferences, brand events, and hospitality roles.',
        directTitle: 'Direct contact',
        location: `${location}${workCities ? ` · ${workCities}` : ''}`,
        form: {
          name: 'Your name',
          email: 'Email',
          phone: 'Phone (optional)',
          message: 'Tell me about the event or role',
          submit: 'Send message',
          privacy: 'I agree to be contacted regarding this inquiry.',
          successTitle: 'Message sent',
          successMessage: 'Thank you — I will get back to you shortly.',
          errorGeneric: 'Something went wrong. Please try again.',
          errorName: 'Please enter your name.',
          errorEmail: 'Please enter a valid email.',
          errorMessage: 'Please enter a message.',
        },
      },
      pl: {
        title: copyFor('pl').contactTitle || 'Porozmawiajmy',
        subtitle: 'Dostępna na konferencje, eventy marek i role w branży hospitality.',
        directTitle: 'Kontakt bezpośredni',
        location: `${location}${workCities ? ` · ${workCities}` : ''}`,
        form: {
          name: 'Imię i nazwisko',
          email: 'E-mail',
          phone: 'Telefon (opcjonalnie)',
          message: 'Opisz wydarzenie lub rolę',
          submit: 'Wyślij wiadomość',
          privacy: 'Wyrażam zgodę na kontakt w sprawie tego zapytania.',
          successTitle: 'Wiadomość wysłana',
          successMessage: 'Dziękuję — odezwę się wkrótce.',
          errorGeneric: 'Coś poszło nie tak. Spróbuj ponownie.',
          errorName: 'Podaj imię i nazwisko.',
          errorEmail: 'Podaj prawidłowy adres e-mail.',
          errorMessage: 'Wpisz wiadomość.',
        },
      },
      es: {
        title: copyFor('es').contactTitle || 'Trabajemos juntos',
        subtitle: 'Disponible para conferencias, eventos de marca y roles en hostelería.',
        directTitle: 'Contacto directo',
        location: `${location}${workCities ? ` · ${workCities}` : ''}`,
        form: {
          name: 'Tu nombre',
          email: 'Correo electrónico',
          phone: 'Teléfono (opcional)',
          message: 'Cuéntame sobre el evento o el puesto',
          submit: 'Enviar mensaje',
          privacy: 'Acepto ser contactada respecto a esta consulta.',
          successTitle: 'Mensaje enviado',
          successMessage: 'Gracias — me pondré en contacto contigo pronto.',
          errorGeneric: 'Algo salió mal. Inténtalo de nuevo.',
          errorName: 'Introduce tu nombre.',
          errorEmail: 'Introduce un correo electrónico válido.',
          errorMessage: 'Escribe un mensaje.',
        },
      },
    },
    footer: {
      en: { rights: 'All rights reserved.', siteBy: 'Site by' },
      pl: { rights: 'Wszelkie prawa zastrzeżone.', siteBy: 'Strona' },
      es: { rights: 'Todos los derechos reservados.', siteBy: 'Sitio' },
    },
  };

  const heroImage = resolveImage('hero.jpg');
  return { appearanceFacts, galleryEvents, showExperienceSection, backgroundEntries, content, heroImage };
}

function getContentBundle() {
  // Cache keyed on overlay identity from loadHostess() (ALS), not baked JSON alone.
  const hostess = loadHostess();
  if (_bundle && _bundleRef === hostess) return _bundle;
  _bundleRef = hostess;
  _bundle = buildContentBundle();
  return _bundle;
}

export { getContentBundle };

export const appearanceFacts = new Proxy({} as Record<string, unknown>, {
  get(_t, prop) {
    const obj = getContentBundle().appearanceFacts as object
    const value = Reflect.get(obj, prop)
    return typeof value === 'function' ? (value as (...args: never[]) => unknown).bind(obj) : value
  },
}) as unknown as ReturnType<typeof buildContentBundle>['appearanceFacts']

export const galleryEvents = new Proxy([] as never[], {
  get(_t, prop) {
    const arr = getContentBundle().galleryEvents as unknown as unknown[]
    const value = Reflect.get(arr as object, prop)
    return typeof value === 'function' ? (value as (...args: never[]) => unknown).bind(arr) : value
  },
}) as unknown as ReturnType<typeof buildContentBundle>['galleryEvents']

export const backgroundEntries = new Proxy([] as never[], {
  get(_t, prop) {
    const arr = getContentBundle().backgroundEntries as unknown as unknown[]
    const value = Reflect.get(arr as object, prop)
    return typeof value === 'function' ? (value as (...args: never[]) => unknown).bind(arr) : value
  },
}) as unknown as ReturnType<typeof buildContentBundle>['backgroundEntries']

export const content: PortfolioContent = new Proxy({} as PortfolioContent, {
  get(_t, prop) {
    return Reflect.get(getContentBundle().content as object, prop)
  },
})

export const heroImage = new Proxy({} as Record<string, unknown>, {
  get(_t, prop) {
    const obj = getContentBundle().heroImage as object
    const value = Reflect.get(obj, prop)
    return typeof value === 'function' ? (value as (...args: never[]) => unknown).bind(obj) : value
  },
}) as unknown as ReturnType<typeof buildContentBundle>['heroImage']

export function getShowExperienceSection(): boolean {
  return getContentBundle().showExperienceSection
}
/** @deprecated use getShowExperienceSection() — kept as live getter for Astro conditionals via helper */
export const showExperienceSection = {
  valueOf(): boolean { return getContentBundle().showExperienceSection },
  [Symbol.toPrimitive](): boolean { return getContentBundle().showExperienceSection },
} as unknown as boolean


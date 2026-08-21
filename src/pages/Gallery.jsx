import MainLayout from '../layouts/MainLayout';
import SponsorCarousel from '../components/SponsorCarousel';

const GALLERY_IMAGES = [
  {
    id: 'celebrity-guests-2014',
    title: 'Celebrity appearance',
    year: '2014',
    image: '/images/celebrity-guests.png',
    description: 'Chris Gayle and Kapil Dev',
  },
  {
    id: 'charity-invitation-2014',
    title: 'Charity invitation',
    year: '2014',
    image: '/images/charity-poster-2014.png',
    description: 'Maylands Golf and Country Club',
  },
];

export default function Gallery() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-surface-light">
        <div className="relative bg-midnight-navy py-20">
          <div className="absolute inset-0 bg-[url('/images/hero-bg-2026.png')] bg-cover bg-center opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-midnight-navy via-transparent to-transparent" />
          <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h1 className="mb-4 text-4xl font-serif font-bold text-white md:text-5xl">
              Society <span className="text-trophy-gold">Gallery</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-white/80">
              A visual history of our competition, camaraderie and charitable impact.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {GALLERY_IMAGES.map((image) => (
              <article key={image.id} className="group relative h-64 overflow-hidden rounded-xl border border-border-light bg-white shadow-lg">
                <img
                  src={image.image}
                  alt={`${image.title}: ${image.description}`}
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-6">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-trophy-gold">{image.year}</p>
                    <h2 className="font-serif text-xl text-white">{image.title}</h2>
                    <p className="mt-1 text-sm text-white/80">{image.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-12 text-center text-sm text-text-light" role="status">
            Additional society photographs will appear only after the committee verifies that they are approved for publication.
          </p>
        </div>

        <SponsorCarousel />
      </div>
    </MainLayout>
  );
}

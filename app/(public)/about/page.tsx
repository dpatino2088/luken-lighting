import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import Image from 'next/image';
import { generateMetadataWithCMS } from '@/lib/seo';
import { getSiteImages } from '@/lib/site-images';

export async function generateMetadata() {
  return generateMetadataWithCMS({
    title: 'About Luken Lighting',
    description: 'Learn about our commitment to architectural lighting that disappears into the space it illuminates.',
    path: '/about',
  });
}

export default async function AboutPage() {
  const siteImages = await getSiteImages();

  return (
    <div className="py-12 lg:py-16">
      {/* Hero */}
      <section className="relative h-[50vh] min-h-[400px] bg-gray-900 mb-20 flex items-center justify-center">
        {siteImages.about_hero?.image_url ? (
          <>
            <Image
              src={siteImages.about_hero.image_url}
              alt={siteImages.about_hero.alt_text || 'About Luken Lighting'}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/50" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800" />
        )}
        
        <Container className="relative z-10 text-center text-white">
          <h1 className="text-4xl lg:text-5xl font-light tracking-widest uppercase mb-4">
            About Luken Lighting
          </h1>
          <p className="text-xl font-light max-w-2xl mx-auto">
            The best lighting is the one you don't see
          </p>
        </Container>
      </section>

      <Container>
        {/* Our Story */}
        <section className="mb-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {siteImages.about_story?.image_url ? (
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={siteImages.about_story.image_url}
                  alt={siteImages.about_story.alt_text || 'Our Story'}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="aspect-[4/3] bg-gray-200" />
            )}
            <div>
              <h2 className="text-3xl font-light tracking-wide uppercase mb-6">
                Our Story
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Luken Lighting was founded on a clear conviction: the best fixture is the one 
                  that goes unnoticed. We create architectural lighting with clean, minimal lines 
                  designed to integrate invisibly into any space.
                </p>
                <p>
                  Our philosophy is simple — the space is the protagonist, and light is the tool 
                  that brings it to life. Every fixture we design prioritizes discretion, so that 
                  the architecture, the materials, and the atmosphere take center stage.
                </p>
                <p>
                  Today, Luken Lighting products are specified by leading architects and designers, 
                  and available through our network of authorized distributors across residential, 
                  commercial, and hospitality projects.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-20">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-light tracking-wide uppercase mb-12 text-center">
              Our Values
            </h2>
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-900 mx-auto mb-6" />
                <h3 className="text-xl font-medium uppercase tracking-wide mb-4">
                  Design Excellence
                </h3>
                <p className="text-gray-600">
                  Every product is designed with restraint — clean lines and minimal profiles that 
                  integrate seamlessly into the architecture, letting the space speak for itself.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-900 mx-auto mb-6" />
                <h3 className="text-xl font-medium uppercase tracking-wide mb-4">
                  Quality Craftsmanship
                </h3>
                <p className="text-gray-600">
                  Using premium materials and rigorous manufacturing processes, we ensure that 
                  every fixture meets the highest standards of quality and durability.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-900 mx-auto mb-6" />
                <h3 className="text-xl font-medium uppercase tracking-wide mb-4">
                  Innovation
                </h3>
                <p className="text-gray-600">
                  We continuously explore new technologies and integration methods to make our 
                  fixtures even more discreet — advancing the invisible infrastructure that 
                  brings spaces to life.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Commitment */}
        <section className="mb-20">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-light tracking-wide uppercase mb-6">
              Our Commitment
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                At Luken Lighting, we are committed to sustainable practices and responsible 
                manufacturing. Our LED technology delivers exceptional energy efficiency, reducing 
                environmental impact while lowering operational costs.
              </p>
              <p>
                We work closely with our network of authorized distributors and dealers to ensure 
                comprehensive support from initial specification through installation and beyond. 
                Our technical team is always available to provide guidance and expertise.
              </p>
            </div>
          </div>
        </section>

        {/* Quality & Standards */}
        <section className="py-20 border-t border-gray-200 mb-20">
          <h2 className="text-3xl font-light tracking-wide uppercase mb-12 text-center">
            Quality & Standards
          </h2>
          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div>
              <h3 className="text-lg font-medium uppercase tracking-wide mb-4">
                Certifications
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li>• CE Certified</li>
                <li>• RoHS Compliant</li>
                <li>• IP Rated for Various Environments</li>
                <li>• Energy Efficiency Standards</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium uppercase tracking-wide mb-4">
                Warranty
              </h3>
              <p className="text-gray-600 leading-relaxed">
                All Luken Lighting products are backed by comprehensive warranties, reflecting 
                our confidence in their quality and longevity. Contact us for specific warranty 
                details by product line.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-3xl font-light tracking-wide uppercase mb-6">
            Work With Us
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Whether you're an architect, designer, or project specifier, we're here to support 
            your vision through our authorized distributors — with exceptional lighting solutions 
            and dedicated service.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/products">
              <Button variant="primary" size="lg">
                Explore Products
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg">
                Contact Us
              </Button>
            </Link>
          </div>
        </section>
      </Container>
    </div>
  );
}


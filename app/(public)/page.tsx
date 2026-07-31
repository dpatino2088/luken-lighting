import Link from 'next/link';
import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { ProductGrid } from '@/components/ProductGrid';
import { createClient } from '@/lib/supabase/server';
import { PUBLIC_VARIANT_FEATURED } from '@/lib/supabase/publicSelects';
import { getSiteImages } from '@/lib/site-images';
import { ProductVariant, ProductCategory, InspirationProject } from '@/lib/types';

export default async function HomePage() {
  const supabase = await createClient();
  const siteImages = await getSiteImages();
  
  const { data: featuredVariants } = supabase
    ? await supabase
        .from('product_variants')
        .select(PUBLIC_VARIANT_FEATURED)
        .eq('is_active', true)
        .eq('is_featured', true)
        .eq('product.is_active', true)
        .limit(8)
    : { data: null };

  const { data: categories } = supabase
    ? await supabase
        .from('product_categories')
        .select('*')
        .order('sort_order')
    : { data: null };

  const { data: projects } = supabase
    ? await supabase
        .from('inspiration_projects')
        .select('*')
        .order('sort_order')
        .limit(6)
    : { data: null };

  const sampleCategories = [
    { id: '1', slug: 'downlights', name: 'Downlights', description: 'Recessed ceiling lights for ambient and accent lighting', hero_image_url: null },
    { id: '2', slug: 'wall-lights', name: 'Wall Lights', description: 'Minimal wall-mounted fixtures for architectural accent lighting', hero_image_url: null },
    { id: '3', slug: 'ceiling-lights', name: 'Ceiling Lights', description: 'Surface-mounted ceiling fixtures and plafones', hero_image_url: null },
    { id: '4', slug: 'pendant-lights', name: 'Pendant Lights', description: 'Suspended architectural lighting solutions', hero_image_url: null },
    { id: '5', slug: 'outdoor-lights', name: 'Outdoor Lights', description: 'Weather-resistant exterior lighting', hero_image_url: null },
    { id: '6', slug: 'bathroom-lights', name: 'Bathroom Lights', description: 'IP-rated fixtures for wet locations', hero_image_url: null },
  ];

  const displayCategories = categories || sampleCategories;
  const displayProjects = projects || [];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-screen min-h-[600px] bg-gray-900 flex items-center justify-center">
        {siteImages.homepage_hero?.image_url ? (
          <>
            <Image
              src={siteImages.homepage_hero.image_url}
              alt={siteImages.homepage_hero.alt_text || 'Luken Lighting'}
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
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-widest uppercase mb-6">
            Luken Lighting
          </h1>
          <p className="text-xl md:text-2xl font-light max-w-2xl mx-auto mb-10 leading-relaxed">
            Architectural lighting designed to disappear. Spaces designed to shine.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/products">
              <Button variant="primary" size="lg">
                View Products
              </Button>
            </Link>
            <Link href="/professionals">
              <Button variant="secondary" size="lg">
                Download Catalogue
              </Button>
            </Link>
          </div>
        </Container>
      </section>

      {/* Product Categories */}
      <section className="py-20 lg:py-28">
        <Container>
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-light tracking-widest uppercase mb-4">
              Explore by Category
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Discover our complete range of architectural lighting solutions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {displayCategories?.map((category: ProductCategory) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                className="group"
              >
                <div className="relative aspect-[4/3] bg-gray-100 mb-4 overflow-hidden">
                  {category.hero_image_url ? (
                    <Image
                      src={category.hero_image_url}
                      alt={category.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 group-hover:scale-105 transition-transform duration-500" />
                  )}
                </div>
                <h3 className="text-xl font-medium tracking-wide uppercase group-hover:text-brand-copper transition-colors">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-sm text-gray-600 mt-2">
                    {category.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* About Section */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <Container size="lg">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-light tracking-widest uppercase mb-6">
                About Luken Lighting
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  At Luken Lighting, we believe the best fixture is the one you don't see. We 
                  design architectural lighting with clean, minimal lines that integrate seamlessly 
                  into any space — because our priority is that the architecture speaks, not the luminaire.
                </p>
                <p>
                  Our products are available through our network of authorized distributors 
                  and dealers, ensuring expert guidance from specification to installation.
                </p>
              </div>
              <div className="mt-8">
                <Link href="/about">
                  <Button variant="outline">
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>
            {siteImages.homepage_about?.image_url ? (
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={siteImages.homepage_about.image_url}
                  alt={siteImages.homepage_about.alt_text || 'About Luken Lighting'}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="aspect-[4/3] bg-gray-200" />
            )}
          </div>
        </Container>
      </section>

      {/* Inspiration Section */}
      {displayProjects.length > 0 && (
        <section className="py-20 lg:py-28 bg-gray-50">
          <Container>
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-light tracking-widest uppercase mb-4">
                Inspiration
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Projects where our lighting disappears and the architecture takes center stage
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayProjects.map((project: InspirationProject) => (
                <Link
                  key={project.id}
                  href={`/inspiration/${project.slug}`}
                  className="group"
                >
                  <div className="relative aspect-[4/3] bg-gray-100 mb-4 overflow-hidden">
                    {(project.thumbnail_url || project.hero_image_url) ? (
                      <Image
                        src={project.thumbnail_url || project.hero_image_url!}
                        alt={project.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 group-hover:scale-105 transition-transform duration-500" />
                    )}
                  </div>
                  <h3 className="text-xl font-medium tracking-wide uppercase group-hover:text-brand-copper transition-colors">
                    {project.name}
                  </h3>
                  {project.location && (
                    <p className="text-sm text-gray-500 mt-1">
                      {project.location}
                      {project.year && ` — ${project.year}`}
                    </p>
                  )}
                </Link>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link href="/inspiration">
                <Button variant="outline" size="lg">
                  View All Projects
                </Button>
              </Link>
            </div>
          </Container>
        </section>
      )}

      {/* Featured Products */}
      {featuredVariants && featuredVariants.length > 0 && (
        <section className="py-20 lg:py-28">
          <Container>
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-light tracking-widest uppercase mb-4">
                Featured Products
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Our most specified architectural lighting solutions
              </p>
            </div>

            <ProductGrid products={featuredVariants as unknown as ProductVariant[]} />

            <div className="text-center mt-12">
              <Link href="/products">
                <Button variant="outline" size="lg">
                  View All Products
                </Button>
              </Link>
            </div>
          </Container>
        </section>
      )}

      {/* CTA for Professionals */}
      <section className="py-20 lg:py-28">
        <Container size="lg">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-light tracking-widest uppercase mb-6">
              For Architects & Designers
            </h2>
            <p className="text-gray-600 leading-relaxed mb-8">
              Access technical datasheets, photometric files, and comprehensive project support. 
              Our dedicated team is ready to assist with specification and custom solutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/professionals">
                <Button variant="primary" size="lg">
                  Professional Resources
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" size="lg">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
